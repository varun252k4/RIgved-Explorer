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
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# Load environment variables
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bookmarks: Dict[str, List[dict]] = {}

# Bookmark Model
class Bookmark(BaseModel):
    user_id: str
    mandala: int
    sukta: int
    rik_number: int

DATA_FILE = "./data/complete_rigveda_all_mandalas.json"

# Load JSON data once
if not os.path.exists(DATA_FILE):
    raise FileNotFoundError(f"{DATA_FILE} not found")

with open(DATA_FILE, "r", encoding="utf-8") as f:
    rigveda_data = json.load(f)

# Global variables for search optimization
vectorizer = None
verse_vectors = None
verse_metadata = []

def initialize_search_index():
    """Initialize TF-IDF vectorizer and compute vectors for all verses"""
    global vectorizer, verse_vectors, verse_metadata
    
    print("🔍 Building search index with cosine similarity...")
    
    texts = []
    verse_metadata.clear()
    
    for mandala_key, suktas in rigveda_data.items():
        mandala_id = int(mandala_key.split(" ")[1])
        for sukta_key, riks in suktas.items():
            sukta_id = int(sukta_key.split(" ")[1])
            for rik in riks:
                translation_text = rik.get("translation", "")
                texts.append(translation_text)
                
                # Store metadata for each verse
                verse_metadata.append({
                    "mandala": mandala_id,
                    "sukta": sukta_id,
                    "rik_number": rik.get("rik_number"),
                    "devanagari": rik.get("samhita", {}).get("devanagari", {}).get("text", ""),
                    "transliteration": rik.get("padapatha", {}).get("transliteration", {}).get("text", ""),
                    "translation": translation_text,
                    "deity": rik.get("deity", "")
                })
    
    # Create TF-IDF vectorizer
    vectorizer = TfidfVectorizer(
        lowercase=True,
        stop_words='english',
        max_features=5000,
        ngram_range=(1, 2)  # Include bigrams for better context
    )
    
    # Fit and transform all texts
    verse_vectors = vectorizer.fit_transform(texts)
    
    print(f"✅ Search index built with {len(texts)} verses")

# Initialize search index on startup
initialize_search_index()

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
# Cosine Similarity Search
# -----------------------------
def cosine_similarity_search(query: str, fields: List[str], page: int, page_size: int, min_similarity: float = 0.4):
    """
    Search using cosine similarity between query and verse translations
    
    Args:
        query: Search query string
        fields: Fields to include in results
        page: Page number for pagination
        page_size: Number of results per page
        min_similarity: Minimum similarity threshold (0-1)
    """
    global vectorizer, verse_vectors, verse_metadata
    
    if vectorizer is None or verse_vectors is None:
        raise HTTPException(status_code=500, detail="Search index not initialized")
    
    # Transform query using the same vectorizer
    query_vector = vectorizer.transform([query])
    
    # Calculate cosine similarities
    similarities = cosine_similarity(query_vector, verse_vectors).flatten()
    
    # Get indices sorted by similarity (highest first)
    sorted_indices = np.argsort(similarities)[::-1]
    
    # Filter by minimum similarity threshold
    filtered_results = []
    for idx in sorted_indices:
        similarity_score = similarities[idx]
        if similarity_score < min_similarity:
            break
            
        metadata = verse_metadata[idx]
        result_item = {
            "mandala": metadata["mandala"],
            "sukta": metadata["sukta"],
            "rik_number": metadata["rik_number"],
            "similarity_score": float(similarity_score)
        }
        
        # Add requested fields
        if "devanagari" in fields:
            result_item["devanagari"] = metadata["devanagari"]
        
        if "transliteration" in fields:
            result_item["transliteration"] = metadata["transliteration"]
        
        if "translation" in fields:
            result_item["translation"] = metadata["translation"]
        
        if "deity" in fields:
            result_item["deity"] = metadata["deity"]
        
        filtered_results.append(result_item)
    
    # Pagination
    total_results = len(filtered_results)
    start = (page - 1) * page_size
    end = start + page_size
    paginated_results = filtered_results[start:end]
    
    return {
        "query": query,
        "fields": fields,
        "page": page,
        "page_size": page_size,
        "total_results": total_results,
        "min_similarity": min_similarity,
        "results": paginated_results
    }

# -----------------------------
# Endpoint: Search with Cosine Similarity
# -----------------------------
@app.get("/search", tags=["Rigveda"])
def search_rigveda(
    query: str = Query(..., min_length=1, description="Search keyword in English translation"),
    fields: List[str] = Query(["translation"], description="Fields to return: devanagari, transliteration, translation, deity"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Number of results per page"),
    min_similarity: float = Query(0.4, ge=0.0, le=1.0, description="Minimum similarity threshold (0-1)")
):
    """
    Search Rigveda verses using cosine similarity for semantic matching.
    Returns results ranked by relevance with similarity scores.
    """
    return cosine_similarity_search(query, fields, page, page_size, min_similarity)



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

    # Use cosine similarity search instead of keyword search
    search_response = cosine_similarity_search(
        query=query,
        fields=fields,
        page=1,
        page_size=max_results,
        min_similarity=0.1
    )
    
    search_results = search_response["results"]

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

    # Create prompt for Gemini
    context_text = ""
    for res in search_results:
        context_text += f"Mandala {res['mandala']}, Sukta {res['sukta']}, Rik {res['rik_number']} (Relevance: {res['similarity_score']:.2f}):\n"
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
    understand what actually user want to know

    Here is the relevant Rigveda context that mentions this topic:
    {context_text}

    Based on the above verses from the Rigveda:
    1. Understand the concept/deity/topic the user asked about
    2. Understand the significance in Vedic literature
    3. If relevant, mention how this connects to broader Hindu philosophy
    4. Understand what is the purpose of this verse
    and then give the answer to user what user want based on above points. 


    Please keep your answer focused on what is mentioned in these specific verses while providing clear explanations.
    """

    try:
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

    audio_url = f"https://sri-aurobindo.co.in/workings/matherials/rigveda/{mandala_id:02d}/{mandala_id:02d}-{sukta_id:03d}.mp3"

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
            "transliteration": rik.get("padapatha", {}).get("transliteration", {}).get("text", ""),
            "translation": rik.get("translation", {})
        })

    return sukta_text

def setup_sanskrit_font():
    """Setup and register Sanskrit font with proper fallback"""
    try:
        font_url = "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf"
        temp_dir = tempfile.gettempdir()
        font_path = os.path.join(temp_dir, "NotoSansDevanagari-Regular.ttf")
        
        if not os.path.exists(font_path):
            print("Downloading Sanskrit font...")
            r = requests.get(font_url, timeout=30)
            r.raise_for_status()
            with open(font_path, "wb") as f:
                f.write(r.content)
            print("Font downloaded successfully")
        
        pdfmetrics.registerFont(TTFont('NotoDevanagari', font_path))
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
    """Export selected Sukta as a PDF"""
    
    if not setup_sanskrit_font():
        return {"error": "Failed to setup Sanskrit font"}

    mandala_key = f"Mandala {mandala}"
    if mandala_key not in rigveda_data:
        return {"error": "Mandala not found"}

    mandala_data = rigveda_data[mandala_key]
    sukta_key = f"Sukta {sukta}"
    if sukta_key not in mandala_data:
        return {"error": "Sukta not found"}

    sukta_data = mandala_data[sukta_key]
    file_path = f"exports/mandala_{mandala}_sukta_{sukta}.pdf"
    os.makedirs("exports", exist_ok=True)

    styles = getSampleStyleSheet()
    
    sanskrit_style = ParagraphStyle(
        'SanskritStyle',
        parent=styles['Normal'],
        fontName='NotoDevanagari',
        fontSize=12,
        leading=16,
        alignment=TA_LEFT,
        wordWrap='CJK'
    )
    
    english_style = ParagraphStyle(
        'EnglishStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        alignment=TA_LEFT
    )
    
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
    content.append(Paragraph(f"<b>Rigveda Mandala {mandala}, Sukta {sukta}</b>", title_style))
    content.append(Spacer(1, 12))

    for rik_index, rik in enumerate(sukta_data, 1):
        content.append(Paragraph(f"<b>Rik {rik_index}:</b>", english_style))
        content.append(Spacer(1, 6))

        devanagari_text = rik.get("samhita", {}).get("devanagari", {}).get("text", "")
        if devanagari_text:
            clean_sanskrit = devanagari_text.replace('\n', '<br/>')
            content.append(Paragraph(clean_sanskrit, sanskrit_style))
            content.append(Spacer(1, 6))

        if include_padapatha:
            padapatha_devanagari = rik.get("padapatha", {}).get("devanagari", {}).get("text", "")
            if padapatha_devanagari:
                content.append(Paragraph("<i>Padapatha:</i>", english_style))
                clean_padapatha = padapatha_devanagari.replace('\n', '<br/>')
                content.append(Paragraph(clean_padapatha, sanskrit_style))
                content.append(Spacer(1, 6))

        if include_translation:
            translation_text = rik.get("translation", "")
            if translation_text:
                content.append(Paragraph(f"<i>Translation:</i> {translation_text}", english_style))
                content.append(Spacer(1, 12))

        if rik_index % 5 == 0:
            content.append(Spacer(1, 12))

    try:
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