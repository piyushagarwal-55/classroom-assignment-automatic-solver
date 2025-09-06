#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import io
import re
import textwrap
import sys
import json
from pathlib import Path
from typing import List, Optional

# Set UTF-8 encoding for output
if sys.platform == "win32":
    import codecs
    import locale
    
    # Set console encoding to UTF-8
    try:
        sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
        sys.stderr = codecs.getwriter("utf-8")(sys.stderr.detach())
    except Exception:
        # Fallback - just print ASCII-safe messages
        pass
    
    # Set environment variable for Python encoding
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Google APIs
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2.credentials import Credentials

# LLM + utils
from dotenv import load_dotenv
from pypdf import PdfReader
from langchain.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

# PDF writing
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

def safe_print(message):
    """Print function that handles encoding issues on Windows and outputs to stderr for debugging"""
    try:
        print(message, file=sys.stderr)
    except UnicodeEncodeError:
        # If there's a Unicode error, print a safe ASCII version
        safe_message = message.encode('ascii', 'replace').decode('ascii')
        print(safe_message, file=sys.stderr)

class AssignmentSolver:
    def __init__(self, gemini_api_key: str):
        self.gemini_api_key = gemini_api_key
        self.llm = self._get_llm()
        
    def _get_llm(self):
        """Initialize LLM with Gemini API key"""
        if not self.gemini_api_key or not isinstance(self.gemini_api_key, str):
            raise RuntimeError("Invalid Gemini API key.")
        return ChatGoogleGenerativeAI(
            model="gemini-2.0-flash-exp", 
            google_api_key=self.gemini_api_key, 
            temperature=0.2
        )
    
    def _read_pdf_from_url(self, access_token: str, file_id: str) -> str:
        """Download and read PDF content from Google Drive"""
        try:
            safe_print(f"[PDF] Attempting to read PDF from Google Drive: {file_id}")
            
            # Create OAuth2 client with your app's credentials
            from google.oauth2.credentials import Credentials
            from google.auth.transport.requests import Request
            
            # Create a proper credentials object
            creds = Credentials(
                token=access_token,
                client_id=os.getenv('GOOGLE_CLIENT_ID'),
                client_secret=os.getenv('GOOGLE_CLIENT_SECRET')
            )
            
            # Build the Drive service
            drive = build("drive", "v3", credentials=creds, cache_discovery=False)
            
            safe_print(f"[PDF] Drive service built successfully, downloading file...")
            
            # Download file
            request = drive.files().get_media(fileId=file_id)
            file_io = io.BytesIO()
            downloader = MediaIoBaseDownload(file_io, request)
            
            done = False
            while not done:
                status, done = downloader.next_chunk()
                if status:
                    safe_print(f"[PDF] Download progress: {int(status.progress() * 100)}%")
            
            safe_print(f"[PDF] File downloaded successfully, reading PDF content...")
            
            # Read PDF content
            file_io.seek(0)
            reader = PdfReader(file_io)
            
            parts = []
            for page in reader.pages:
                try:
                    text = page.extract_text()
                    if text:
                        parts.append(text)
                except Exception as e:
                    safe_print(f"Error extracting text from page: {e}")
                    continue
            
            return "\n".join(parts).strip()
            
        except Exception as e:
            safe_print(f"Error reading PDF: {e}")
            return ""
    
    def _extract_questions(self, text: str) -> List[str]:
        """Extract questions from assignment text"""
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
            # Check for question patterns
            if re.match(r"^(\d+[\).]\s+|[a-zA-Z]\)\s+|-|\*)", ln) or ln.endswith("?"):
                flush()
                buf.append(ln)
                flush()
            else:
                buf.append(ln)
        flush()

        if not chunks:
            # Fallback to paragraph splitting
            paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
            return paras[:20]
        return chunks[:50]
    
    def _create_assignment_prompt(self):
        """Create the assignment solving prompt"""
        return ChatPromptTemplate.from_template(
            """You are a careful, step-by-step problem solver and academic expert. 
You are given the raw text of an assignment file. Extract distinct questions and SOLVE them clearly and comprehensively.

CRITICAL FORMATTING REQUIREMENTS:
- Use ONLY standard ASCII characters (32-126)
- NO emojis, Unicode symbols, or special characters
- Use simple text formatting:
  * Asterisks (*) for emphasis
  * Dashes (-) for bullets
  * Standard quotes (" and ')
  * Basic math symbols: +, -, *, /, =, <, >
- Replace complex symbols:
  * Use "x" instead of "×"
  * Use "/" instead of "÷"
  * Use "<=" instead of "≤"
  * Use ">=" instead of "≥"
  * Use "!=" instead of "≠"
- Use regular dashes (-) not em-dashes
- Use standard spacing and line breaks

CONTENT REQUIREMENTS:
- Show numbered solutions matching question order (1., 2., 3., etc.)
- Provide detailed explanations for each step
- Include formulas using ASCII characters only
- Include code snippets in plain text format when needed
- If text includes irrelevant parts, ignore them
- If a question lacks info, state assumptions clearly
- Format response in structured, academic manner
- Provide practical examples where applicable
- Keep all content in plain text format

EXAMPLE FORMATTING:
1. Problem: Calculate force using F = ma
   
   Solution:
   Given: mass = 10 kg, acceleration = 9.8 m/s^2
   
   Formula: F = m * a
   Calculation: F = 10 * 9.8 = 98 N
   
   Therefore, the force is 98 Newtons.

Assignment text:
{assignment_text}

Provide complete, detailed solutions using ONLY ASCII characters."""
        )
    
    
    def solve_assignment(self, assignment_text: str) -> str:
        """Solve assignment questions using LLM"""
        try:
            safe_print(f"Starting assignment solution process...")
            safe_print(f"Assignment text length: {len(assignment_text)} characters")
            
            prompt = self._create_assignment_prompt()
            chain = prompt | self.llm
            
            safe_print("Sending request to LLM...")
            result = chain.invoke({"assignment_text": assignment_text})
            
            solution_text = result.content
            safe_print(f"LLM response received (length: {len(solution_text)} characters)")
            
            # Clean the solution text for better PDF compatibility
            cleaned_solution = self._clean_text_for_pdf(solution_text)
            safe_print(f"Solution text cleaned (length: {len(cleaned_solution)} characters)")
            
            return cleaned_solution
            
        except Exception as e:
            error_msg = f"Error solving assignment: {e}"
            safe_print(error_msg)
            return f"Error occurred while solving assignment: {str(e)}\n\nPlease try again or contact support if the issue persists."
    
    def solve_assignment_from_materials(self, access_token: str, materials: List[dict]) -> str:
        """Solve assignment from Google Classroom materials"""
        assignment_text = ""
        
        # Extract text from all materials
        for material in materials:
            if "driveFile" in material:
                drive_file = material["driveFile"]["driveFile"]
                file_id = drive_file["id"]
                file_title = drive_file["title"]
                
                safe_print(f"Processing file: {file_title}")
                
                # Read PDF content
                file_content = self._read_pdf_from_url(access_token, file_id)
                if file_content:
                    assignment_text += f"\n\n=== {file_title} ===\n{file_content}"
        
        if not assignment_text.strip():
            return "No readable content found in assignment materials."
        
        return self.solve_assignment(assignment_text)
    
    def _clean_text_for_pdf(self, text: str) -> str:
        """Clean text to be PDF-safe by removing unsupported characters"""
        if not text:
            return ""
        
        # Replace common Unicode characters with ASCII equivalents
        replacements = {
            # Quotes
            '"': '"', '"': '"', ''': "'", ''': "'",
            # Dashes
            '–': '-', '—': '-', '―': '-',
            # Arrows and symbols
            '→': '->', '←': '<-', '↑': '^', '↓': 'v',
            '✓': '[CHECK]', '✗': '[X]', '★': '*', '☆': '*',
            # Mathematical symbols
            '×': 'x', '÷': '/', '≤': '<=', '≥': '>=', '≠': '!=',
            '∑': 'SUM', '∏': 'PRODUCT', '∆': 'DELTA', '∞': 'INFINITY',
            # Bullets
            '•': '* ', '◦': '- ', '▪': '- ', '▫': '- ',
            # Other symbols
            '©': '(C)', '®': '(R)', '™': '(TM)', '°': 'deg',
        }
        
        # Apply replacements
        cleaned_text = text
        for unicode_char, ascii_replacement in replacements.items():
            cleaned_text = cleaned_text.replace(unicode_char, ascii_replacement)
        
        # Remove any remaining non-ASCII characters
        # Keep only printable ASCII characters (32-126) plus newlines and tabs
        cleaned_text = ''.join(char for char in cleaned_text 
                              if ord(char) < 128 and (char.isprintable() or char in '\n\r\t'))
        
        return cleaned_text
    
    def create_solution_pdf(self, solution_text: str, title: str = "Assignment Solution") -> bytes:
        """Create PDF from solution text with proper encoding handling"""
        try:
            # Clean the solution text to be PDF-safe
            clean_solution = self._clean_text_for_pdf(solution_text)
            clean_title = self._clean_text_for_pdf(title)
            
            safe_print(f"Creating PDF with cleaned text (length: {len(clean_solution)} chars)")
            
            # Create PDF in memory with proper encoding
            pdf_buffer = io.BytesIO()
            
            # Import additional ReportLab modules for better text handling
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
            from reportlab.lib.units import inch
            from reportlab.lib.enums import TA_LEFT, TA_CENTER
            
            # Create document with proper encoding
            doc = SimpleDocTemplate(
                pdf_buffer,
                pagesize=letter,
                rightMargin=40,
                leftMargin=40,
                topMargin=50,
                bottomMargin=50
            )
            
            # Get styles
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=16,
                spaceAfter=30,
                alignment=TA_CENTER,
                fontName='Helvetica-Bold'
            )
            
            body_style = ParagraphStyle(
                'CustomBody',
                parent=styles['Normal'],
                fontSize=11,
                spaceAfter=12,
                alignment=TA_LEFT,
                fontName='Helvetica',
                leftIndent=0,
                rightIndent=0
            )
            
            # Build content
            story = []
            
            # Add title
            title_para = Paragraph(clean_title, title_style)
            story.append(title_para)
            story.append(Spacer(1, 0.2*inch))
            
            # Process solution text into paragraphs
            paragraphs = clean_solution.split('\n\n')
            
            for para_text in paragraphs:
                if para_text.strip():
                    # Clean and escape HTML entities for ReportLab
                    clean_para = para_text.strip()
                    clean_para = clean_para.replace('&', '&amp;')
                    clean_para = clean_para.replace('<', '&lt;')
                    clean_para = clean_para.replace('>', '&gt;')
                    
                    # Create paragraph
                    para = Paragraph(clean_para, body_style)
                    story.append(para)
                    story.append(Spacer(1, 0.1*inch))
            
            # Build PDF
            doc.build(story)
            
            # Get PDF bytes
            pdf_buffer.seek(0)
            pdf_bytes = pdf_buffer.getvalue()
            
            safe_print(f"PDF created successfully (size: {len(pdf_bytes)} bytes)")
            return pdf_bytes
            
        except Exception as e:
            safe_print(f"Error creating PDF: {e}")
            # Create a simple error PDF
            try:
                pdf_buffer = io.BytesIO()
                c = canvas.Canvas(pdf_buffer, pagesize=letter)
                c.setFont("Helvetica", 12)
                c.drawString(40, 750, "Error generating assignment solution PDF")
                c.drawString(40, 730, f"Error: {str(e)}")
                c.drawString(40, 710, "Please try again or contact support.")
                c.save()
                pdf_buffer.seek(0)
                return pdf_buffer.getvalue()
            except:
                return b""

def main():
    """CLI interface for Node.js integration with enhanced error handling"""
    if len(sys.argv) < 4:
        error_result = {
            "success": False,
            "error": "Usage: python assignment_solver.py <gemini_api_key> <access_token> <materials_json>",
            "solutionText": "Invalid command line arguments provided."
        }
        print(json.dumps(error_result))
        sys.exit(1)
    
    try:
        gemini_key = sys.argv[1]
        access_token = sys.argv[2]
        materials_json = sys.argv[3]
        
        safe_print("🚀 Starting assignment solver...")
        safe_print(f"📊 Arguments received: API key length={len(gemini_key)}, materials length={len(materials_json)}")
        
        # Parse materials with validation
        try:
            materials = json.loads(materials_json)
            safe_print(f"📋 Materials parsed: {len(materials)} items")
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in materials: {e}")
        
        # Initialize solver
        safe_print("🔧 Initializing solver...")
        solver = AssignmentSolver(gemini_key)
        
        # Solve assignment
        safe_print("🧠 Solving assignment...")
        solution_text = solver.solve_assignment_from_materials(access_token, materials)
        
        if not solution_text or len(solution_text.strip()) < 10:
            raise ValueError("Solution text is too short or empty")
        
        safe_print(f"✅ Solution generated: {len(solution_text)} characters")
        
        # Create PDF
        safe_print("📄 Creating PDF...")
        pdf_bytes = solver.create_solution_pdf(solution_text, "Assignment Solution")
        
        if not pdf_bytes:
            raise ValueError("PDF generation failed - no bytes returned")
        
        safe_print(f"📦 PDF created: {len(pdf_bytes)} bytes")
        
        # Return JSON response
        result = {
            "success": True,
            "solutionText": solution_text,
            "pdfBytes": pdf_bytes.hex()
        }
        
        safe_print("🎉 Assignment solving completed successfully!")
        print(json.dumps(result))
        
    except Exception as e:
        safe_print(f"❌ Error occurred: {e}")
        error_result = {
            "success": False,
            "error": str(e),
            "solutionText": f"Error occurred while solving assignment: {str(e)}\n\nPlease try again or contact support if the issue persists."
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()
