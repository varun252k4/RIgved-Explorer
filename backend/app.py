from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import requests
from dotenv import load_dotenv
import google.generativeai as genai
from functools import lru_cache
from typing import List, Optional, Dict
from pydantic import BaseModel
import random
from datetime import date
import google.generativeai as genai
from fastapi.responses import FileResponse
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import letter, A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
import tempfile


# Load environment variables
load_dotenv()
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get API key from environment variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("⚠️ Warning: GEMINI_API_KEY not found in environment variables")
else:
    print("✅ GEMINI_API_KEY loaded successfully")

app = FastAPI(
    title="RigVeda API",
    description="API for accessing RigVeda verses and translations",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

bookmarks: Dict[str, List[dict]] = {}

# -----------------------------
# Bookmark Model
# -----------------------------
class Bookmark(BaseModel):
    user_id: str
    mandala: int
    sukta: int
    rik_number: int

DATA_FILE = "../data/complete_rigveda_all_mandalas.json"

# Load JSON data once
if not os.path.exists(DATA_FILE):
    raise FileNotFoundError(f"{DATA_FILE} not found")

with open(DATA_FILE, "r", encoding="utf-8") as f:
    rigveda_data = json.load(f)


# -----------------------------
# Endpoint: List Mandalas
# -----------------------------
@app.get("/mandalas", tags=["Rigveda"])
def get_mandalas():
    mandalas = list(rigveda_data.keys())
    return {"mandalas": mandalas}


# -----------------------------
# Endpoint: List Suktas in a Mandala
# -----------------------------
@app.get("/mandala/{mandala_id}/suktas", tags=["Rigveda"])
def get_suktas(mandala_id: int):
    mandala_key = f"Mandala {mandala_id}"
    if mandala_key not in rigveda_data:
        raise HTTPException(status_code=404, detail="Mandala not found")
    suktas = list(rigveda_data[mandala_key].keys())
    return {"mandala": mandala_id, "suktas": suktas}


# -----------------------------
# Endpoint: List Riks in a Sukta
# -----------------------------
@app.get("/mandala/{mandala_id}/sukta/{sukta_id}/riks", tags=["Rigveda"])
def get_riks(mandala_id: int, sukta_id: int):
    mandala_key = f"Mandala {mandala_id}"
    sukta_key = f"Sukta {sukta_id}"

    if mandala_key not in rigveda_data or sukta_key not in rigveda_data[mandala_key]:
        raise HTTPException(status_code=404, detail="Sukta not found")

    riks = [rik["rik_number"] for rik in rigveda_data[mandala_key][sukta_key]]
    return {"mandala": mandala_id, "sukta": sukta_id, "riks": riks}


# -----------------------------
# Endpoint: Get Rik Details
# -----------------------------
@app.get("/mandala/{mandala_id}/sukta/{sukta_id}/rik/{rik_number}", tags=["Rigveda"])
def get_rik_detail(mandala_id: int, sukta_id: int, rik_number: int):
    mandala_key = f"Mandala {mandala_id}"
    sukta_key = f"Sukta {sukta_id}"

    if mandala_key not in rigveda_data or sukta_key not in rigveda_data[mandala_key]:
        raise HTTPException(status_code=404, detail="Rik not found")

    rik_item = next(
        (rik for rik in rigveda_data[mandala_key][sukta_key] if rik["rik_number"] == rik_number),
        None
    )

    if not rik_item:
        raise HTTPException(status_code=404, detail="Rik not found")

    return rik_item

# -----------------------------
# Cached Search Helper
# -----------------------------
@lru_cache(maxsize=128)
def cached_search(query: str, fields_tuple: tuple, page: int, page_size: int):
    results = []
    fields = list(fields_tuple)

    for mandala_key, suktas in rigveda_data.items():
        mandala_id = int(mandala_key.split(" ")[1])
        for sukta_key, riks in suktas.items():
            sukta_id = int(sukta_key.split(" ")[1])
            for rik in riks:
                translation_text = rik.get("translation", "")
                if query.lower() in translation_text.lower():
                    result_item = {
                        "mandala": mandala_id,
                        "sukta": sukta_id,
                        "rik_number": rik.get("rik_number")
                    }

                    if "devanagari" in fields:
                        result_item["devanagari"] = rik.get("samhita", {}).get("devanagari", {}).get("text", "")

                    if "transliteration" in fields:
                        result_item["transliteration"] = rik.get("padapatha", {}).get("transliteration", {}).get("text", "")

                    if "translation" in fields:
                        result_item["translation"] = translation_text

                    if "deity" in fields:
                        result_item["deity"] = rik.get("deity", "")

                    results.append(result_item)

    # Pagination
    total_results = len(results)
    start = (page - 1) * page_size
    end = start + page_size
    paginated_results = results[start:end]

    return {
        "query": query,
        "fields": fields,
        "page": page,
        "page_size": page_size,
        "total_results": total_results,
        "results": paginated_results
    }


# -----------------------------
# Endpoint: Search (with caching & pagination)
# -----------------------------
@app.get("/search", tags=["Rigveda"])
def search_rigveda(
    query: str = Query(..., min_length=1, description="Search keyword in English translation"),
    fields: List[str] = Query(["translation"], description="Fields to return: devanagari, transliteration, translation, deity"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Number of results per page")
):
    return cached_search(query, tuple(fields), page, page_size)

# -----------------------------
# Endpoint: Add Bookmark
# -----------------------------
@app.post("/bookmark", tags=["Rigveda"])
def add_bookmark(bookmark: Bookmark):
    mandala_key = f"Mandala {bookmark.mandala}"
    sukta_key = f"Sukta {bookmark.sukta}"

    if mandala_key not in rigveda_data or sukta_key not in rigveda_data[mandala_key]:
        raise HTTPException(status_code=404, detail="Verse not found")

    rik_item = next(
        (rik for rik in rigveda_data[mandala_key][sukta_key] if rik["rik_number"] == bookmark.rik_number),
        None
    )

    if not rik_item:
        raise HTTPException(status_code=404, detail="Verse not found")

    # Add bookmark
    if bookmark.user_id not in bookmarks:
        bookmarks[bookmark.user_id] = []

    if rik_item not in bookmarks[bookmark.user_id]:
        bookmarks[bookmark.user_id].append({
            "mandala": bookmark.mandala,
            "sukta": bookmark.sukta,
            "rik_number": bookmark.rik_number,
            "devanagari": rik_item.get("samhita", {}).get("devanagari", {}).get("text", ""),
            "translation": rik_item.get("translation", "")
        })

    return {"message": "Bookmark added", "bookmarks": bookmarks[bookmark.user_id]}


# -----------------------------
# Endpoint: Get Bookmarks
# -----------------------------
@app.get("/bookmarks/{user_id}", tags=["Rigveda"])
def get_bookmarks(user_id: str):
    if user_id not in bookmarks or not bookmarks[user_id]:
        raise HTTPException(status_code=404, detail="No bookmarks found for user")
    return {"user_id": user_id, "bookmarks": bookmarks[user_id]}


# -----------------------------
# Endpoint: Remove Bookmark
# -----------------------------
@app.delete("/bookmark", tags=["Rigveda"])
def remove_bookmark(bookmark: Bookmark):
    if bookmark.user_id not in bookmarks:
        raise HTTPException(status_code=404, detail="User has no bookmarks")

    before_count = len(bookmarks[bookmark.user_id])
    bookmarks[bookmark.user_id] = [
        b for b in bookmarks[bookmark.user_id]
        if not (b["mandala"] == bookmark.mandala and
                b["sukta"] == bookmark.sukta and
                b["rik_number"] == bookmark.rik_number)
    ]

    if len(bookmarks[bookmark.user_id]) == before_count:
        raise HTTPException(status_code=404, detail="Bookmark not found")

    return {"message": "Bookmark removed", "bookmarks": bookmarks[bookmark.user_id]}

# -----------------------------
# Endpoint: Random Verse
# -----------------------------
@app.get("/random", tags=["Rigveda"])
def random_verse(fields: list[str] = Query(["translation", "devanagari"], description="Fields to return")):
    mandala_key = random.choice(list(rigveda_data.keys()))
    sukta_key = random.choice(list(rigveda_data[mandala_key].keys()))
    rik_item = random.choice(rigveda_data[mandala_key][sukta_key])

    mandala_id = int(mandala_key.split(" ")[1])
    sukta_id = int(sukta_key.split(" ")[1])

    result = {
        "mandala": mandala_id,
        "sukta": sukta_id,
        "rik_number": rik_item.get("rik_number")
    }

    if "devanagari" in fields:
        result["devanagari"] = rik_item.get("samhita", {}).get("devanagari", {}).get("text", "")

    if "transliteration" in fields:
        result["transliteration"] = rik_item.get("padapatha", {}).get("transliteration", {}).get("text", "")

    if "translation" in fields:
        result["translation"] = rik_item.get("translation", "")

    if "deity" in fields:
        result["deity"] = rik_item.get("deity", "")

    return result


# -----------------------------
# Endpoint: Daily Verse
# -----------------------------
@app.get("/daily-verse", tags=["Rigveda"])
def daily_verse(fields: list[str] = Query(["translation", "devanagari"], description="Fields to return")):
    # Use today's date to seed random generator for consistency
    today = date.today()
    random.seed(today.toordinal())

    mandala_key = random.choice(list(rigveda_data.keys()))
    sukta_key = random.choice(list(rigveda_data[mandala_key].keys()))
    rik_item = random.choice(rigveda_data[mandala_key][sukta_key])

    mandala_id = int(mandala_key.split(" ")[1])
    sukta_id = int(sukta_key.split(" ")[1])

    result = {
        "mandala": mandala_id,
        "sukta": sukta_id,
        "rik_number": rik_item.get("rik_number")
    }

    if "devanagari" in fields:
        result["devanagari"] = rik_item.get("samhita", {}).get("devanagari", {}).get("text", "")

    if "transliteration" in fields:
        result["transliteration"] = rik_item.get("padapatha", {}).get("transliteration", {}).get("text", "")

    if "translation" in fields:
        result["translation"] = rik_item.get("translation", "")

    if "deity" in fields:
        result["deity"] = rik_item.get("deity", "")

    return result


# Configure Gemini API
api_key = os.getenv("GEMINI_API_KEY")
model = None


if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.5-flash')
        print("✅ Gemini API configured successfully")
    except Exception as e:
        print(f"❌ Error configuring Gemini API: {e}")
else:
    print("⚠️ Warning: GEMINI_API_KEY not found in environment variables")

@app.post("/ai-assistant", tags=["Rigveda"])
def ai_assistant(
    query: str,
    max_results: int = 5,
    fields: list[str] = Query(["translation"], description="Fields to return for context")
):
    """Ask questions about a hymn and get explanations using Gemini AI."""
    if not model:
        raise HTTPException(
            status_code=500,
            detail="Gemini API not configured. Please check your .env file."
        )

    # Step 1: Search relevant verses in translation
    search_results = []
    search_terms = query.lower().split()
    
    for mandala_key, suktas in rigveda_data.items():
        mandala_id = int(mandala_key.split(" ")[1])
        for sukta_key, riks in suktas.items():
            sukta_id = int(sukta_key.split(" ")[1])
            for rik in riks:
                translation_text = rik.get("translation", "").lower()
                # Check if any search term is in the translation
                if any(term in translation_text for term in search_terms):
                    result_item = {
                        "mandala": mandala_id,
                        "sukta": sukta_id,
                        "rik_number": rik.get("rik_number")
                    }
                    if "devanagari" in fields:
                        result_item["devanagari"] = rik.get("samhita", {}).get("devanagari", {}).get("text", "")
                    if "transliteration" in fields:
                        result_item["transliteration"] = rik.get("padapatha", {}).get("transliteration", {}).get("text", "")
                    if "translation" in fields:
                        result_item["translation"] = translation_text

                    search_results.append(result_item)

    search_results = search_results[:max_results]  # limit results

    if not search_results:
        return {
            "query": query,
            "context": [],
            "answer": (
                "I apologize, but I couldn't find any verses in the Rigveda that specifically mention your query. "
                "Could you try:\n"
                "1. Using different keywords or terms\n"
                "2. Being more specific about what aspect you're interested in\n"
                "3. Checking if there's a different way to phrase your question"
            )
        }

    # Step 2: Create prompt for Gemini
    context_text = ""
    for res in search_results:
        context_text += f"Mandala {res['mandala']}, Sukta {res['sukta']}, Rik {res['rik_number']}:\n"
        if "translation" in res:
            context_text += f"Translation: {res['translation']}\n"
        if "devanagari" in res:
            context_text += f"Devanagari: {res['devanagari']}\n"
        if "transliteration" in res:
            context_text += f"Transliteration: {res['transliteration']}\n"
        context_text += "\n"

    prompt = f"""
You are an expert on Rigveda, one of the most ancient and sacred texts of Hinduism.

A user asked: "{query}"

Here is the relevant Rigveda context that mentions this topic:
{context_text}

Based on the above verses from the Rigveda:
1. Explain the concept/deity/topic the user asked about
2. Provide specific references to the verses shown above
3. Explain the significance in Vedic literature
4. If relevant, mention how this connects to broader Hindu philosophy
5. What is the puprose of this verse

Please keep your answer focused on what is mentioned in these specific verses while providing clear explanations.
"""

    try:
        # Generate content using Gemini API
        response = model.generate_content(prompt)
        answer = response.text
    except Exception as e:
        return {"error": str(e)}

    return {
        "query": query,
        "context": search_results,
        "answer": answer
    }
# -----------------------------
# Endpoint: Get Sukta View with Audio Link
# -----------------------------

@app.get("/mandala/{mandala_id}/sukta/{sukta_id}/view", tags=["Rigveda"])
def get_sukta_view(mandala_id: int, sukta_id: int):
    mandala_key = f"Mandala {mandala_id:01d}"
    sukta_key = f"Sukta {sukta_id}"

    if mandala_key not in rigveda_data or sukta_key not in rigveda_data[mandala_key]:
        raise HTTPException(status_code=404, detail="Sukta not found")

    riks = rigveda_data[mandala_key][sukta_key]

    # Construct audio link based on mandala/sukta
    audio_url = f"https://sri-aurobindo.co.in/workings/matherials/rigveda/{mandala_id:02d}/{mandala_id:02d}-{sukta_id:03d}.mp3"

    # Collect sukta text
    sukta_text = {
        "mandala": mandala_id,
        "sukta": sukta_id,
        "audio_url": audio_url,
        "riks": []
    }

    for rik in riks:
        sukta_text["riks"].append({
            "rik_number": rik["rik_number"],
            "samhita_devanagari": rik.get("samhita", {}).get("devanagari", {}).get("text", ""),
            "padapatha_devanagari": rik.get("padapatha", {}).get("devanagari", {}).get("text", ""),
            "transliteration": rik.get("padapatha", {}).get("transliteration", {}).get("text", "")
        })

    return sukta_text

def setup_sanskrit_font():
    """Setup and register Sanskrit font with proper fallback"""
    try:
        # URL for Noto Sans Devanagari font
        font_url = "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf"
        
        # Use temp directory to avoid permission issues
        temp_dir = tempfile.gettempdir()
        font_path = os.path.join(temp_dir, "NotoSansDevanagari-Regular.ttf")
        
        # Download if not exists
        if not os.path.exists(font_path):
            print("Downloading Sanskrit font...")
            r = requests.get(font_url, timeout=30)
            r.raise_for_status()
            with open(font_path, "wb") as f:
                f.write(r.content)
            print("Font downloaded successfully")
        
        # Register the font
        pdfmetrics.registerFont(TTFont('NotoDevanagari', font_path))
        
        # Create a font family for fallback
        pdfmetrics.registerFontFamily(
            'NotoDevanagari',
            normal='NotoDevanagari',
            bold='NotoDevanagari',
            italic='NotoDevanagari',
            boldItalic='NotoDevanagari'
        )
        
        return True
        
    except Exception as e:
        print(f"Font setup error: {e}")
        return False

@app.get("/export_pdf/{mandala}/{sukta}")
def export_pdf(mandala: int, sukta: int, 
               include_padapatha: bool = True, 
               include_transliteration: bool = True, 
               include_translation: bool = True):
    """
    Export selected Sukta as a PDF with Devanagari, Padapatha, Transliteration, and Translation
    """
    
    # Setup Sanskrit font
    if not setup_sanskrit_font():
        return {"error": "Failed to setup Sanskrit font"}

    # Fetch Sukta data
    mandala_key = f"Mandala {mandala}"
    if mandala_key not in rigveda_data:
        return {"error": "Mandala not found"}

    mandala_data = rigveda_data[mandala_key]

    sukta_key = f"Sukta {sukta}"
    if sukta_key not in mandala_data:
        return {"error": "Sukta not found"}

    sukta_data = mandala_data[sukta_key]

    # PDF file path
    file_path = f"exports/mandala_{mandala}_sukta_{sukta}.pdf"
    os.makedirs("exports", exist_ok=True)

    # Create custom styles
    styles = getSampleStyleSheet()
    
    # Sanskrit text style
    sanskrit_style = ParagraphStyle(
        'SanskritStyle',
        parent=styles['Normal'],
        fontName='NotoDevanagari',
        fontSize=12,
        leading=16,
        alignment=TA_LEFT,
        wordWrap='CJK'  # Important for complex scripts
    )
    
    # English text style
    english_style = ParagraphStyle(
        'EnglishStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        alignment=TA_LEFT
    )
    
    # Title style
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Title'],
        fontName='Helvetica-Bold',
        fontSize=16,
        alignment=TA_CENTER,
        spaceAfter=12
    )

    doc = SimpleDocTemplate(
        file_path,
        pagesize=A4,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72
    )
    
    content = []

    # Title
    content.append(Paragraph(f"<b>Rigveda Mandala {mandala}, Sukta {sukta}</b>", title_style))
    content.append(Spacer(1, 12))

    # Loop through Riks
    for rik_index, rik in enumerate(sukta_data, 1):
        # Add Rik number
        content.append(Paragraph(f"<b>Rik {rik_index}:</b>", english_style))
        content.append(Spacer(1, 6))

        # Devanagari text
        devanagari_text = rik.get("samhita", {}).get("devanagari", {}).get("text", "")
        if devanagari_text:
            # Clean and prepare Sanskrit text
            clean_sanskrit = devanagari_text.replace('\n', '<br/>')
            content.append(Paragraph(clean_sanskrit, sanskrit_style))
            content.append(Spacer(1, 6))

        # Padapatha section
        if include_padapatha:
            padapatha_devanagari = rik.get("padapatha", {}).get("devanagari", {}).get("text", "")
            if padapatha_devanagari:
                content.append(Paragraph("<i>Padapatha:</i>", english_style))
                clean_padapatha = padapatha_devanagari.replace('\n', '<br/>')
                content.append(Paragraph(clean_padapatha, sanskrit_style))
                content.append(Spacer(1, 6))

        # Transliteration section
        # if include_transliteration:
        #     transliteration_text = rik.get("padapatha", {}).get("transliteration", {}).get("text", "")
        #     if transliteration_text:
        #         content.append(Paragraph(f"<i>Transliteration:</i> {transliteration_text}", english_style))
        #         content.append(Spacer(1, 6))

        # Translation section
        if include_translation:
            translation_text = rik.get("translation", "")
            if translation_text:
                content.append(Paragraph(f"<i>Translation:</i> {translation_text}", english_style))
                content.append(Spacer(1, 12))

        # Add page break after every 5 Riks to avoid overflow
        if rik_index % 5 == 0:
            content.append(Spacer(1, 12))

    try:
        # Build PDF
        doc.build(content)
        return FileResponse(file_path, media_type="application/pdf", filename=os.path.basename(file_path))
    
    except Exception as e:
        return {"error": f"PDF generation failed: {str(e)}"}
    
    
# -----------------------------
# MAIN: Run the app
# -----------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)