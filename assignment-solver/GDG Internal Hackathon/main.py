#!/usr/bin/env python3
import os
import io
import re
import argparse
import textwrap
from pathlib import Path
from typing import List, Optional

# Google APIs
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

# LLM + utils
from dotenv import load_dotenv
from pypdf import PdfReader
from langchain.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

# PDF writing
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

# --------------------------
# Constants & folders
# --------------------------
SCOPES = [
    "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DOWNLOADS_DIR = DATA_DIR / "downloads"
OUTPUT_SOLUTIONS_DIR = DATA_DIR / "output" / "solutions"
OUTPUT_SUMMARIES_DIR = DATA_DIR / "output" / "summaries"
TOKEN_PATH = ROOT / "token.json"
CLIENT_SECRET_PATH = ROOT / "client_secret.json"

# --------------------------
# Helpers
# --------------------------
def ensure_dirs():
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_SOLUTIONS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_SUMMARIES_DIR.mkdir(parents=True, exist_ok=True)

def load_env():
    # optional .env
    load_dotenv()
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("Missing GEMINI_API_KEY env var.")
    return key

def auth_services():
    if not CLIENT_SECRET_PATH.exists():
        raise FileNotFoundError(
            "client_secret.json not found. Place your OAuth desktop client file in project root."
        )

    creds = None
    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception:
                creds = None

        if not creds or not creds.valid:
            flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRET_PATH), SCOPES)
            creds = flow.run_local_server(port=0, prompt="consent")

        with open(TOKEN_PATH, "w") as token:
            token.write(creds.to_json())

    classroom = build("classroom", "v1", credentials=creds, cache_discovery=False)
    drive = build("drive", "v3", credentials=creds, cache_discovery=False)
    return classroom, drive

def read_txt(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")

def read_pdf(path: Path) -> str:
    reader = PdfReader(str(path))
    parts = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            pass
    return "\n".join(parts).strip()

def read_any_text(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        return read_pdf(path)
    return read_txt(path)

def extract_questions(text: str) -> List[str]:
    lines = [ln.strip() for ln in text.splitlines()]
    chunks = []
    buf: List[str] = []
    def flush():
        nonlocal buf, chunks
        if buf:
            joined = " ".join(buf).strip()
            if joined:
                chunks.append(joined)
            buf = []

    for ln in lines:
        if not ln:
            flush()
            continue
        if re.match(r"^(\d+[\).]\s+|[a-zA-Z]\)\s+|-|\*)", ln) or ln.endswith("?"):
            flush()
            buf.append(ln)
            flush()
        else:
            buf.append(ln)
    flush()

    if not chunks:
        paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
        return paras[:20]
    return chunks[:50]

def clean_filename(name: str) -> str:
    name = re.sub(r"[^\w\-. ]", "_", name).strip()
    return re.sub(r"\s+", "_", name)[:140] or "untitled"

# --------------------------
# Google Classroom fetching
# --------------------------
def list_courses(classroom) -> List[dict]:
    courses = []
    page_token = None
    while True:
        resp = classroom.courses().list(pageSize=100, pageToken=page_token).execute()
        courses.extend(resp.get("courses", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return courses

def list_assignments(classroom, course_id: str, max_items: int) -> List[dict]:
    items = []
    page_token = None
    while True:
        resp = classroom.courses().courseWork().list(
            courseId=course_id, pageSize=50, pageToken=page_token
        ).execute()
        for cw in resp.get("courseWork", []):
            if cw.get("workType") == "ASSIGNMENT" or cw.get("assignment_submission"):
                items.append(cw)
        if len(items) >= max_items:
            break
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return items[:max_items]

def list_materials(classroom, course_id: str, max_items: int) -> List[dict]:
    items = []
    page_token = None
    while True:
        resp = classroom.courses().courseWorkMaterials().list(
            courseId=course_id, pageSize=50, pageToken=page_token
        ).execute()
        items.extend(resp.get("courseWorkMaterial", []))
        if len(items) >= max_items:
            break
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return items[:max_items]

def _download_google_file_export(drive, file_id: str, mime_type: str, out_path: Path):
    request = drive.files().export_media(fileId=file_id, mimeType=mime_type)
    fh = io.FileIO(str(out_path), "wb")
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()

def _download_drive_file(drive, file_id: str, out_path: Path):
    request = drive.files().get_media(fileId=file_id)
    fh = io.FileIO(str(out_path), "wb")
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()

def download_materials_files(drive, materials: List[dict]) -> List[Path]:
    paths: List[Path] = []
    for m in materials or []:
        if "driveFile" in m:
            drive_info = m["driveFile"]["driveFile"]
            fid = drive_info["id"]
            meta = drive.files().get(fileId=fid, fields="id,name,mimeType").execute()
            name = meta["name"]
            mt = meta["mimeType"]
            safe = clean_filename(name)

            if mt.startswith("application/vnd.google-apps"):
                # Export Google Docs/Slides/Sheets to text where possible
                if mt == "application/vnd.google-apps.document":
                    out = DOWNLOADS_DIR / f"{safe}.txt"
                    _download_google_file_export(drive, fid, "text/plain", out)
                    paths.append(out)
                elif mt == "application/vnd.google-apps.presentation":
                    out = DOWNLOADS_DIR / f"{safe}.txt"
                    _download_google_file_export(drive, fid, "text/plain", out)
                    paths.append(out)
                elif mt == "application/vnd.google-apps.spreadsheet":
                    out = DOWNLOADS_DIR / f"{safe}.csv"
                    _download_google_file_export(drive, fid, "text/csv", out)
                    paths.append(out)
                else:
                    # skip other Google types
                    continue
            else:
                # Binary file (pdf, docx, etc.)
                ext = ""
                if "." in name:
                    ext = name[name.rfind("."):]
                out = DOWNLOADS_DIR / f"{safe}{ext}"
                _download_drive_file(drive, fid, out)
                paths.append(out)
        # links/youtube/forms are skipped for this pipeline
    return paths

def collect_files_from_coursework(drive, cw: dict) -> List[Path]:
    materials = cw.get("materials", [])
    return download_materials_files(drive, materials)

# --------------------------
# LLM tasks (Gemini via LangChain)
# --------------------------
def get_llm(gemini_key: str):
    # validate key locally (simple check)
    if not gemini_key or not isinstance(gemini_key, str):
        raise RuntimeError("Invalid Gemini API key.")
    return ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=gemini_key, temperature=0.2)

ASSIGNMENT_PROMPT = ChatPromptTemplate.from_template(
    """You are a careful, step-by-step problem solver. 
You are given the raw text of one assignment file. Extract distinct questions and SOLVE them clearly.
- Show numbered solutions matching the question order.
- If the text includes irrelevant parts (headers/footers), ignore them.
- If a question lacks enough info, state the assumption and proceed.

Assignment text:
{assignment_text}
"""
)

NOTES_SUMMARY_PROMPT = ChatPromptTemplate.from_template(
    """You are a concise academic summarizer. Summarize the following notes into a tight study note:
- Key bullet points
- Definitions/formulas (if any)
- 3–5 takeaway lines

Notes text:
{notes_text}
"""
)

QUESTIONS_PROMPT = ChatPromptTemplate.from_template(
    """You are given a set of questions extracted from a file. Provide clear, correct solutions.
Use step-by-step reasoning and label answers.

Questions:
{questions}
"""
)

def solve_assignment_text(llm, text: str) -> str:
    # combine prompt + llm via pipe operator (works with langchain-google-genai integration)
    chain = ASSIGNMENT_PROMPT | llm
    return chain.invoke({"assignment_text": text}).content

def summarize_notes_text(llm, text: str) -> str:
    chain = NOTES_SUMMARY_PROMPT | llm
    return chain.invoke({"notes_text": text}).content

def solve_questions_list(llm, qs: List[str]) -> str:
    joined = "\n\n".join(f"Q{i+1}. {q}" for i, q in enumerate(qs))
    chain = QUESTIONS_PROMPT | llm
    return chain.invoke({"questions": joined}).content

# --------------------------
# PDF writer
# --------------------------
def write_text_to_pdf(out_path: Path, text: str, title: Optional[str] = None):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(out_path), pagesize=letter)
    width, height = letter
    margin = 40
    textobj = c.beginText(margin, height - 50)
    textobj.setFont("Helvetica", 11)

    if title:
        textobj.setFont("Helvetica-Bold", 14)
        textobj.textLine(title)
        textobj.setFont("Helvetica", 11)
        textobj.textLine("")

    for paragraph in text.splitlines():
        if not paragraph.strip():
            textobj.textLine("")
            continue
        # wrap paragraph into multiple lines for PDF width
        wrapped = textwrap.wrap(paragraph, width=95)
        for ln in wrapped:
            textobj.textLine(ln)
            # If text reaches bottom, flush page
            if textobj.getY() < 60:
                c.drawText(textobj)
                c.showPage()
                textobj = c.beginText(margin, height - 50)
                textobj.setFont("Helvetica", 11)
    c.drawText(textobj)
    c.showPage()
    c.save()

# --------------------------
# Main pipeline (PDF outputs)
# --------------------------
def handle_questions_file(llm, questions_path: Optional[Path]) -> Optional[Path]:
    if not questions_path:
        return None
    if not questions_path.exists():
        raise FileNotFoundError(f"questions_file not found: {questions_path}")

    text = read_any_text(questions_path)
    qs = extract_questions(text)
    if not qs:
        qs = [text]

    result = solve_questions_list(llm, qs)
    out_name = clean_filename(questions_path.stem) + "-solutions.pdf"
    out_path = OUTPUT_SOLUTIONS_DIR / out_name
    write_text_to_pdf(out_path, result, title=f"Solutions for {questions_path.name}")
    return out_path

def process_assignments(classroom, drive, llm, course_ids: List[str], max_items: int) -> List[Path]:
    out_paths: List[Path] = []
    for cid in course_ids:
        items = list_assignments(classroom, cid, max_items=max_items)
        for cw in items:
            files = collect_files_from_coursework(drive, cw)
            if not files:
                continue
            for f in files:
                text = read_any_text(f)
                if not text.strip():
                    continue
                result = solve_assignment_text(llm, text)
                base = clean_filename(f.stem) + "-solutions.pdf"
                out = OUTPUT_SOLUTIONS_DIR / base
                write_text_to_pdf(out, result, title=f"Solutions for {f.name}")
                out_paths.append(out)
    return out_paths

def process_notes(classroom, drive, llm, course_ids: List[str], max_items: int) -> List[Path]:
    out_paths: List[Path] = []
    for cid in course_ids:
        items = list_materials(classroom, cid, max_items=max_items)
        for mat in items:
            files = download_materials_files(drive, mat.get("materials", []))
            if not files:
                continue
            for f in files:
                text = read_any_text(f)
                if not text.strip():
                    continue
                result = summarize_notes_text(llm, text)
                base = clean_filename(f.stem) + "-summary.pdf"
                out = OUTPUT_SUMMARIES_DIR / base
                write_text_to_pdf(out, result, title=f"Summary for {f.name}")
                out_paths.append(out)
    return out_paths

def resolve_course_ids(classroom, maybe_course_id: Optional[str]) -> List[str]:
    if maybe_course_id:
        return [maybe_course_id]
    return [c["id"] for c in list_courses(classroom)]

def main():
    parser = argparse.ArgumentParser(add_help=True, description="Classroom -> LLM -> PDF")
    parser.add_argument("--mode", choices=["assignments", "notes", "all"], default="all")
    parser.add_argument("--course_id", type=str, default=None)
    parser.add_argument("--questions_file", type=str, default=None)
    parser.add_argument("--max_items", type=int, default=5)
    args = parser.parse_args()

    ensure_dirs()
    gemini_key = load_env()
    llm = get_llm(gemini_key)

    output_paths: List[Path] = []

    # ✅ Only authenticate if Classroom/Drive is needed
    classroom = drive = None
    if args.mode in ("assignments", "notes", "all") and not args.questions_file:
        classroom, drive = auth_services()

    # Process assignments/notes if selected
    if args.mode in ("assignments", "all") and classroom:
        course_ids = resolve_course_ids(classroom, args.course_id)
        output_paths += process_assignments(classroom, drive, llm, course_ids, max_items=args.max_items)

    if args.mode in ("notes", "all") and classroom:
        course_ids = resolve_course_ids(classroom, args.course_id)
        output_paths += process_notes(classroom, drive, llm, course_ids, max_items=args.max_items)

    # ✅ Handle local questions PDF directly
    if args.questions_file:
        qp = Path(args.questions_file)
        res = handle_questions_file(llm, qp)
        if res:
            output_paths.append(res)

    for p in output_paths:
        print(str(p.resolve()))

if __name__ == "__main__":
    main()
