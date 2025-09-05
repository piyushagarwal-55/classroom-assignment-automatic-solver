# Classroom → LLM → PDF (terminal-only)

This project fetches files (assignments, notes) from Google Classroom, sends text to a Large Language Model (Gemini via LangChain), and writes **PDF** outputs (solutions/summaries) into your project `data/output/` folders. The terminal prints **only** the absolute path(s) of the generated PDF file(s), one per line.

---

## Structure

```
classroom_llm_pdf_project/
├─ main.py                 # single-file pipeline (terminal-only)
├─ client_secret.json      # (from Google Cloud Console - NOT included)
├─ .env.example
├─ requirements.txt
├─ README.md
└─ data/
   ├─ downloads/
   ├─ questions/
   │  └─ sample_questions.txt
   └─ output/
      ├─ solutions/
      └─ summaries/
```

---

## Quick setup (one-time)

1. Create a Python venv:
```bash
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows (PowerShell)
.venv\Scripts\Activate.ps1
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Google setup:
- Create or pick a Google Cloud Project.
- Enable **Google Classroom API** and **Google Drive API**.
- Create **OAuth 2.0 Client ID (Desktop app)** and download `client_secret.json`. Place it in the project root.

4. Set your Gemini API key (environment variable):
```bash
# macOS/Linux
export GEMINI_API_KEY="YOUR_GEMINI_KEY"

# Windows (PowerShell)
$env:GEMINI_API_KEY="YOUR_GEMINI_KEY"
```

---

## How to run

Examples (the script will print just PDF paths, nothing else):

1. Solve both Classroom assignments & notes and process a local questions file:
```bash
python main.py --mode all --questions_file data/questions/sample_questions.txt --max_items 3
```

2. Only summarize notes:
```bash
python main.py --mode notes
```

3. Only process assignments for a specific course:
```bash
python main.py --mode assignments --course_id YOUR_COURSE_ID
```

**First run** will open a browser for Google OAuth (to produce `token.json`). After that, runs are headless and the script prints only the PDF output paths.

---

## Output locations

- Solutions → `data/output/solutions/*-solutions.pdf`
- Summaries → `data/output/summaries/*-summary.pdf`

---

## Notes & customization

- The prompts are defined in `main.py`. Edit them if you want different tone/length.
- The script exports Google Docs/Slides to text where possible. Binary files (PDFs, DOCX) are downloaded and parsed (PDF via `pypdf`).
- Be mindful of your institution's academic policies.

If you want, I can:
- change the LLM prompts (concise vs verbose),
- add flags for Gemini model selection,
- or create a sample `client_secret.json` template (not the real secret).
