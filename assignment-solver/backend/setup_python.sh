#!/bin/bash

# Setup script for Assignment Solver Python dependencies

echo "🐍 Setting up Python environment for Assignment Solver..."

# Check if Python is installed
if ! command -v python &> /dev/null; then
    echo "❌ Python is not installed. Please install Python 3.8+ first."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "python_env" ]; then
    echo "📦 Creating Python virtual environment..."
    python -m venv python_env
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source python_env/bin/activate

# Install requirements
echo "📥 Installing Python dependencies..."
pip install -r python_requirements.txt

echo "✅ Python environment setup complete!"
echo "💡 To activate the environment manually, run: source python_env/bin/activate"
