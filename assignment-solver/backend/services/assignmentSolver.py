#!/usr/bin/env python3
import os
import io
import re
import textwrap
import sys
import json
from pathlib import Path
from typing import List, Optional

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
            # Create credentials object
            creds = Credentials(token=access_token)
            drive = build("drive", "v3", credentials=creds, cache_discovery=False)
            
            # Download file
            request = drive.files().get_media(fileId=file_id)
            file_io = io.BytesIO()
            downloader = MediaIoBaseDownload(file_io, request)
            
            done = False
            while not done:
                status, done = downloader.next_chunk()
            
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
                    print(f"Error extracting text from page: {e}")
                    continue
            
            return "\n".join(parts).strip()
            
        except Exception as e:
            print(f"Error reading PDF: {e}")
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

Instructions:
- Show numbered solutions matching the question order
- Provide detailed explanations for each step
- Include formulas, code snippets, diagrams (in text form) where applicable
- If the text includes irrelevant parts (headers/footers), ignore them
- If a question lacks enough info, state your assumptions clearly and proceed
- Format your response in a structured, academic manner
- Use proper mathematical notation where needed
- Provide practical examples where applicable

Assignment text:
{assignment_text}

Please provide complete, detailed solutions for all questions found in the assignment."""
        )
    
    def solve_assignment(self, assignment_text: str) -> str:
        """Solve assignment questions using LLM"""
        try:
            prompt = self._create_assignment_prompt()
            chain = prompt | self.llm
            result = chain.invoke({"assignment_text": assignment_text})
            return result.content
        except Exception as e:
            print(f"Error solving assignment: {e}")
            return f"Error occurred while solving assignment: {str(e)}"
    
    def solve_assignment_from_materials(self, access_token: str, materials: List[dict]) -> str:
        """Solve assignment from Google Classroom materials"""
        assignment_text = ""
        
        # Extract text from all materials
        for material in materials:
            if "driveFile" in material:
                drive_file = material["driveFile"]["driveFile"]
                file_id = drive_file["id"]
                file_title = drive_file["title"]
                
                print(f"Processing file: {file_title}")
                
                # Read PDF content
                file_content = self._read_pdf_from_url(access_token, file_id)
                if file_content:
                    assignment_text += f"\n\n=== {file_title} ===\n{file_content}"
        
        if not assignment_text.strip():
            return "No readable content found in assignment materials."
        
        return self.solve_assignment(assignment_text)
    
    def create_solution_pdf(self, solution_text: str, title: str = "Assignment Solution") -> bytes:
        """Create PDF from solution text"""
        try:
            # Create PDF in memory
            pdf_buffer = io.BytesIO()
            c = canvas.Canvas(pdf_buffer, pagesize=letter)
            width, height = letter
            margin = 40
            
            # Start text object
            textobj = c.beginText(margin, height - 50)
            textobj.setFont("Helvetica", 11)
            
            # Add title
            textobj.setFont("Helvetica-Bold", 16)
            textobj.textLine(title)
            textobj.setFont("Helvetica", 11)
            textobj.textLine("")
            textobj.textLine("")
            
            # Add content
            for paragraph in solution_text.splitlines():
                if not paragraph.strip():
                    textobj.textLine("")
                    continue
                    
                # Wrap long lines
                wrapped = textwrap.wrap(paragraph, width=95)
                for line in wrapped:
                    textobj.textLine(line)
                    
                    # Check if we need a new page
                    if textobj.getY() < 60:
                        c.drawText(textobj)
                        c.showPage()
                        textobj = c.beginText(margin, height - 50)
                        textobj.setFont("Helvetica", 11)
            
            # Finish PDF
            c.drawText(textobj)
            c.showPage()
            c.save()
            
            # Get PDF bytes
            pdf_buffer.seek(0)
            return pdf_buffer.getvalue()
            
        except Exception as e:
            print(f"Error creating PDF: {e}")
            return b""

def main():
    """CLI interface for Node.js integration"""
    if len(sys.argv) < 4:
        print(json.dumps({
            "error": "Usage: python assignment_solver.py <gemini_api_key> <access_token> <materials_json>"
        }))
        sys.exit(1)
    
    try:
        gemini_key = sys.argv[1]
        access_token = sys.argv[2]
        materials_json = sys.argv[3]
        
        # Parse materials
        materials = json.loads(materials_json)
        
        # Initialize solver
        solver = AssignmentSolver(gemini_key)
        
        # Solve assignment
        solution_text = solver.solve_assignment_from_materials(access_token, materials)
        
        # Create PDF
        pdf_bytes = solver.create_solution_pdf(solution_text, "Assignment Solution")
        
        # Return JSON response
        result = {
            "success": True,
            "solutionText": solution_text,
            "pdfBytes": pdf_bytes.hex() if pdf_bytes else ""
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "solutionText": f"Error occurred while solving assignment: {str(e)}"
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()
