@echo off

REM Setup script for Assignment Solver Python dependencies (Windows)

echo 🐍 Setting up Python environment for Assignment Solver...

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed. Please install Python 3.8+ first.
    exit /b 1
)

REM Create virtual environment if it doesn't exist
if not exist "python_env" (
    echo 📦 Creating Python virtual environment...
    python -m venv python_env
)

REM Activate virtual environment
echo 🔄 Activating virtual environment...
call python_env\Scripts\activate.bat

REM Install requirements
echo 📥 Installing Python dependencies...
pip install -r python_requirements.txt

echo ✅ Python environment setup complete!
echo 💡 To activate the environment manually, run: python_env\Scripts\activate.bat
