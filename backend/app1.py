from fastapi import FastAPI, HTTPException, Query, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import json
import os
from dotenv import load_dotenv
import google.generativeai as genai
from typing import List, Optional, Dict
from pydantic import BaseModel, Field, EmailStr
import random
from datetime import date, datetime, timedelta
from contextlib import asynccontextmanager
import sqlite3
from pathlib import Path
import hashlib
import secrets
import io
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import jwt

# Load environment variables
load_dotenv()

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Database setup
DB_PATH = "rigveda.db"

def init_db():
    """Initialize SQLite database"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Users table
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT UNIQUE NOT NULL,
                  email TEXT UNIQUE NOT NULL,
                  password_hash TEXT NOT NULL,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    # Bookmarks table
    c.execute('''CREATE TABLE IF NOT EXISTS bookmarks
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER NOT NULL,
                  mandala INTEGER NOT NULL,
                  sukta INTEGER NOT NULL,
                  rik_number INTEGER NOT NULL,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  UNIQUE(user_id, mandala, sukta, rik_number),
                  FOREIGN KEY (user_id) REFERENCES users(id))''')
    
    # User notes table
    c.execute('''CREATE TABLE IF NOT EXISTS notes
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER NOT NULL,
                  mandala INTEGER NOT NULL,
                  sukta INTEGER NOT NULL,
                  rik_number INTEGER NOT NULL,
                  note TEXT NOT NULL,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (user_id) REFERENCES users(id))''')
    
    # Create indexes
    c.execute('CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')
    
    conn.commit()
    conn.close()

# Data loader with caching
class RigVedaDataLoader:
    def __init__(self, data_file: str):
        self.data_file = data_file
        self._data = None
    
    def load_data(self):
        """Load data once and cache it"""
        if self._data is None:
            if not os.path.exists(self.data_file):
                raise FileNotFoundError(f"{self.data_file} not found")
            with open(self.data_file, "r", encoding="utf-8") as f:
                self._data = json.load(f)
        return self._data
    
    def get_verse(self, mandala: int, sukta: int, rik_number: int):
        """Fast verse lookup"""
        data = self.load_data()
        mandala_key = f"Mandala {mandala}"
        sukta_key = f"Sukta {sukta}"
        
        if mandala_key not in data or sukta_key not in data[mandala_key]:
            return None
        
        return next(
            (rik for rik in data[mandala_key][sukta_key] if rik["rik_number"] == rik_number),
            None
        )

# Lifecycle management
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    print("✅ Database initialized")
    yield
    # Shutdown
    pass

app = FastAPI(
    title="RigVeda API",
    description="API with Authentication, Export & Search",
    version="2.1.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize data loader
DATA_FILE = "../data/complete_rigveda_all_mandalas.json"
loader = RigVedaDataLoader(DATA_FILE)

# Security
security = HTTPBearer()

# ==================== MODELS ====================

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str

class Bookmark(BaseModel):
    mandala: int
    sukta: int
    rik_number: int

class Note(BaseModel):
    mandala: int
    sukta: int
    rik_number: int
    note: str

class ExportRequest(BaseModel):
    verses: List[Dict[str, int]]  # [{"mandala": 1, "sukta": 1, "rik_number": 1}, ...]
    format: str = Field("pdf", pattern="^(pdf|txt)$")
    include_devanagari: bool = True
    include_transliteration: bool = True
    include_translation: bool = True

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_access_token(data: dict) -> str:
    """Create JWT token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify JWT token"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(payload: dict = Depends(verify_token)) -> int:
    """Get current user ID from token"""
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id

# ==================== AUTH ENDPOINTS ====================

@app.post("/register", tags=["Auth"], response_model=Token)
def register(user: UserRegister):
    """Register new user"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Check if user exists
    c.execute("SELECT id FROM users WHERE email = ? OR username = ?", 
              (user.email, user.username))
    if c.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Create user
    password_hash = hash_password(user.password)
    c.execute("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
              (user.username, user.email, password_hash))
    conn.commit()
    user_id = c.lastrowid
    conn.close()
    
    # Generate token
    token = create_access_token({"user_id": user_id, "username": user.username})
    
    return Token(
        access_token=token,
        user_id=user_id,
        username=user.username
    )

@app.post("/login", tags=["Auth"], response_model=Token)
def login(credentials: UserLogin):
    """Login user"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    password_hash = hash_password(credentials.password)
    c.execute("SELECT id, username FROM users WHERE email = ? AND password_hash = ?",
              (credentials.email, password_hash))
    result = c.fetchone()
    conn.close()
    
    if not result:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_id, username = result
    token = create_access_token({"user_id": user_id, "username": username})
    
    return Token(
        access_token=token,
        user_id=user_id,
        username=username
    )

@app.get("/me", tags=["Auth"])
def get_current_user_info(user_id: int = Depends(get_current_user)):
    """Get current user info"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT username, email, created_at FROM users WHERE id = ?", (user_id,))
    result = c.fetchone()
    conn.close()
    
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": user_id,
        "username": result[0],
        "email": result[1],
        "created_at": result[2]
    }

# ==================== RIGVEDA ENDPOINTS ====================

@app.get("/mandalas", tags=["Rigveda"])
def get_mandalas():
    data = loader.load_data()
    mandalas = []
    for mandala_key in data.keys():
        mandala_id = int(mandala_key.split(" ")[1])
        sukta_count = len(data[mandala_key])
        mandalas.append({
            "mandala_id": mandala_id,
            "sukta_count": sukta_count
        })
    return {"mandalas": mandalas}

@app.get("/mandala/{mandala_id}/suktas", tags=["Rigveda"])
def get_suktas(mandala_id: int):
    data = loader.load_data()
    mandala_key = f"Mandala {mandala_id}"
    if mandala_key not in data:
        raise HTTPException(status_code=404, detail="Mandala not found")
    
    suktas = []
    for sukta_key in data[mandala_key].keys():
        sukta_id = int(sukta_key.split(" ")[1])
        rik_count = len(data[mandala_key][sukta_key])
        suktas.append({
            "sukta_id": sukta_id,
            "rik_count": rik_count
        })
    
    return {"mandala": mandala_id, "suktas": suktas}

@app.get("/mandala/{mandala_id}/sukta/{sukta_id}/rik/{rik_number}", tags=["Rigveda"])
def get_rik_detail(mandala_id: int, sukta_id: int, rik_number: int):
    rik = loader.get_verse(mandala_id, sukta_id, rik_number)
    if not rik:
        raise HTTPException(status_code=404, detail="Rik not found")
    return rik

# ==================== FIXED SEARCH ====================

@app.get("/search", tags=["Search"])
def search_rigveda(
    query: str = Query(..., min_length=1),
    fields: List[str] = Query(["translation"], description="Fields to return"),
    deity: Optional[str] = None,
    mandala: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100)
):
    """Search verses - FIXED VERSION"""
    data = loader.load_data()
    results = []
    query_lower = query.lower()
    
    for mandala_key, suktas in data.items():
        mandala_id = int(mandala_key.split(" ")[1])
        
        # Filter by mandala if specified
        if mandala and mandala_id != mandala:
            continue
        
        for sukta_key, riks in suktas.items():
            sukta_id = int(sukta_key.split(" ")[1])
            
            for rik in riks:
                translation = rik.get("translation", "").lower()
                rik_deity = rik.get("deity", "").lower()
                
                # Search in translation
                if query_lower not in translation:
                    continue
                
                # Filter by deity if specified
                if deity and deity.lower() not in rik_deity:
                    continue
                
                # Build result
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
                    result_item["translation"] = rik.get("translation", "")
                
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
        "filters": {
            "deity": deity,
            "mandala": mandala
        },
        "total_results": total_results,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_results + page_size - 1) // page_size,
        "results": paginated_results
    }

# ==================== BOOKMARKS (Protected) ====================

@app.post("/bookmark", tags=["Bookmarks"])
def add_bookmark(bookmark: Bookmark, user_id: int = Depends(get_current_user)):
    """Add bookmark (requires authentication)"""
    rik = loader.get_verse(bookmark.mandala, bookmark.sukta, bookmark.rik_number)
    if not rik:
        raise HTTPException(status_code=404, detail="Verse not found")
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    try:
        c.execute('''INSERT INTO bookmarks (user_id, mandala, sukta, rik_number)
                    VALUES (?, ?, ?, ?)''',
                 (user_id, bookmark.mandala, bookmark.sukta, bookmark.rik_number))
        conn.commit()
        message = "Bookmark added"
    except sqlite3.IntegrityError:
        message = "Bookmark already exists"
    
    conn.close()
    return {"message": message}

@app.get("/bookmarks", tags=["Bookmarks"])
def get_bookmarks(user_id: int = Depends(get_current_user)):
    """Get user's bookmarks"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''SELECT mandala, sukta, rik_number, created_at 
                FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC''',
             (user_id,))
    
    bookmarks = []
    for row in c.fetchall():
        mandala, sukta, rik_number, created_at = row
        rik = loader.get_verse(mandala, sukta, rik_number)
        if rik:
            bookmarks.append({
                "mandala": mandala,
                "sukta": sukta,
                "rik_number": rik_number,
                "translation": rik.get("translation", ""),
                "created_at": created_at
            })
    
    conn.close()
    return {"bookmarks": bookmarks}

@app.delete("/bookmark", tags=["Bookmarks"])
def remove_bookmark(bookmark: Bookmark, user_id: int = Depends(get_current_user)):
    """Remove bookmark"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''DELETE FROM bookmarks 
                WHERE user_id = ? AND mandala = ? AND sukta = ? AND rik_number = ?''',
             (user_id, bookmark.mandala, bookmark.sukta, bookmark.rik_number))
    
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Bookmark not found")
    
    conn.commit()
    conn.close()
    return {"message": "Bookmark removed"}

# ==================== NOTES ====================

@app.post("/note", tags=["Notes"])
def add_note(note: Note, user_id: int = Depends(get_current_user)):
    """Add note to verse"""
    rik = loader.get_verse(note.mandala, note.sukta, note.rik_number)
    if not rik:
        raise HTTPException(status_code=404, detail="Verse not found")
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''INSERT INTO notes (user_id, mandala, sukta, rik_number, note)
                VALUES (?, ?, ?, ?, ?)''',
             (user_id, note.mandala, note.sukta, note.rik_number, note.note))
    conn.commit()
    conn.close()
    
    return {"message": "Note added"}

@app.get("/notes", tags=["Notes"])
def get_notes(
    user_id: int = Depends(get_current_user),
    mandala: Optional[int] = None,
    sukta: Optional[int] = None
):
    """Get user's notes"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    sql = "SELECT mandala, sukta, rik_number, note, created_at FROM notes WHERE user_id = ?"
    params = [user_id]
    
    if mandala:
        sql += " AND mandala = ?"
        params.append(mandala)
    if sukta:
        sql += " AND sukta = ?"
        params.append(sukta)
    
    sql += " ORDER BY created_at DESC"
    c.execute(sql, params)
    
    notes = [{"mandala": r[0], "sukta": r[1], "rik_number": r[2], 
              "note": r[3], "created_at": r[4]} for r in c.fetchall()]
    
    conn.close()
    return {"notes": notes}

# ==================== EXPORT FUNCTIONALITY ====================

@app.post("/export", tags=["Export"])
def export_verses(export_request: ExportRequest, user_id: int = Depends(get_current_user)):
    """Export verses to PDF or TXT"""
    
    # Fetch all verses
    verses_data = []
    for verse_ref in export_request.verses:
        rik = loader.get_verse(verse_ref["mandala"], verse_ref["sukta"], verse_ref["rik_number"])
        if rik:
            verses_data.append({
                "reference": f"Mandala {verse_ref['mandala']}, Sukta {verse_ref['sukta']}, Rik {verse_ref['rik_number']}",
                "rik": rik
            })
    
    if not verses_data:
        raise HTTPException(status_code=404, detail="No verses found")
    
    if export_request.format == "txt":
        return export_to_txt(verses_data, export_request)
    else:
        return export_to_pdf(verses_data, export_request)

def export_to_txt(verses_data: List[dict], export_request: ExportRequest) -> StreamingResponse:
    """Export to TXT format"""
    content = "RIGVEDA VERSES EXPORT\n"
    content += "=" * 80 + "\n\n"
    
    for verse in verses_data:
        content += f"{verse['reference']}\n"
        content += "-" * 80 + "\n\n"
        
        if export_request.include_devanagari:
            devanagari = verse['rik'].get('samhita', {}).get('devanagari', {}).get('text', '')
            if devanagari:
                content += f"Devanagari:\n{devanagari}\n\n"
        
        if export_request.include_transliteration:
            trans = verse['rik'].get('padapatha', {}).get('transliteration', {}).get('text', '')
            if trans:
                content += f"Transliteration:\n{trans}\n\n"
        
        if export_request.include_translation:
            translation = verse['rik'].get('translation', '')
            if translation:
                content += f"Translation:\n{translation}\n\n"
        
        content += "\n"
    
    buffer = io.BytesIO(content.encode('utf-8'))
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="text/plain",
        headers={
            "Content-Disposition": f"attachment; filename=rigveda_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        }
    )

def export_to_pdf(verses_data: List[dict], export_request: ExportRequest) -> StreamingResponse:
    """Export to PDF format"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*inch, bottomMargin=1*inch)
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor='darkblue',
        spaceAfter=30,
        alignment=TA_CENTER
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor='darkred',
        spaceAfter=12
    )
    
    normal_style = styles['Normal']
    normal_style.fontSize = 10
    normal_style.leading = 14
    
    # Build document
    story = []
    
    # Title
    story.append(Paragraph("Rigveda Verses Export", title_style))
    story.append(Spacer(1, 0.3*inch))
    
    # Verses
    for verse in verses_data:
        # Reference
        story.append(Paragraph(verse['reference'], heading_style))
        story.append(Spacer(1, 0.1*inch))
        
        # Devanagari
        if export_request.include_devanagari:
            devanagari = verse['rik'].get('samhita', {}).get('devanagari', {}).get('text', '')
            if devanagari:
                story.append(Paragraph(f"<b>Devanagari:</b>", normal_style))
                story.append(Paragraph(devanagari, normal_style))
                story.append(Spacer(1, 0.1*inch))
        
        # Transliteration
        if export_request.include_transliteration:
            trans = verse['rik'].get('padapatha', {}).get('transliteration', {}).get('text', '')
            if trans:
                story.append(Paragraph(f"<b>Transliteration:</b>", normal_style))
                story.append(Paragraph(trans, normal_style))
                story.append(Spacer(1, 0.1*inch))
        
        # Translation
        if export_request.include_translation:
            translation = verse['rik'].get('translation', '')
            if translation:
                story.append(Paragraph(f"<b>Translation:</b>", normal_style))
                story.append(Paragraph(translation, normal_style))
                story.append(Spacer(1, 0.1*inch))
        
        story.append(Spacer(1, 0.3*inch))
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=rigveda_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        }
    )

# ==================== RANDOM & DAILY ====================

@app.get("/random", tags=["Rigveda"])
def random_verse():
    data = loader.load_data()
    mandala_key = random.choice(list(data.keys()))
    sukta_key = random.choice(list(data[mandala_key].keys()))
    rik = random.choice(data[mandala_key][sukta_key])
    
    return {
        "mandala": int(mandala_key.split(" ")[1]),
        "sukta": int(sukta_key.split(" ")[1]),
        "rik_number": rik["rik_number"],
        "devanagari": rik.get("samhita", {}).get("devanagari", {}).get("text", ""),
        "translation": rik.get("translation", "")
    }

@app.get("/daily-verse", tags=["Rigveda"])
def daily_verse():
    today = date.today()
    random.seed(today.toordinal())
    return random_verse()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)