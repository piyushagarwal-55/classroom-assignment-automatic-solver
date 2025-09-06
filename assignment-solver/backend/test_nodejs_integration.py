#!/usr/bin/env python3
import json
import subprocess
import sys
import os

def test_nodejs_integration():
    """Test the exact command that Node.js would execute"""
    print("🔗 Testing Node.js integration...")
    
    # Sample materials JSON (similar to what Node.js would send)
    materials = [
        {
            "id": "test_file_id",
            "title": "Test Assignment",
            "alternateLink": "https://drive.google.com/file/d/test_file_id/view"
        }
    ]
    
    # Create command arguments
    gemini_key = "dummy_api_key_for_testing"
    access_token = "dummy_access_token"
    materials_json = json.dumps(materials)
    
    # Construct command
    python_path = sys.executable
    script_path = os.path.join(os.path.dirname(__file__), "services", "assignmentSolver.py")
    
    cmd = [
        python_path,
        script_path,
        gemini_key,
        access_token,
        materials_json
    ]
    
    print(f"🚀 Running command: {' '.join(cmd[:3])} [materials_json]")
    
    try:
        # Set environment variables for encoding
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        env['PYTHONUNBUFFERED'] = '1'
        
        # Run the command
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            env=env,
            timeout=30  # 30 second timeout
        )
        
        print(f"📤 Return code: {result.returncode}")
        print(f"📝 Stdout length: {len(result.stdout)} chars")
        print(f"📝 Stderr length: {len(result.stderr)} chars")
        
        if result.stderr:
            print("⚠️ Stderr output:")
            print(result.stderr)
        
        if result.stdout:
            print("📋 Stdout preview (first 200 chars):")
            print(result.stdout[:200] + "..." if len(result.stdout) > 200 else result.stdout)
            
            # Try to parse as JSON
            try:
                response_data = json.loads(result.stdout)
                print("✅ Valid JSON response received!")
                print(f"🔑 Response keys: {list(response_data.keys())}")
                
                if response_data.get("success"):
                    print("🎉 Success response!")
                    solution_length = len(response_data.get("solutionText", ""))
                    pdf_length = len(response_data.get("pdfBytes", ""))
                    print(f"📏 Solution text: {solution_length} chars")
                    print(f"📦 PDF bytes (hex): {pdf_length} chars")
                else:
                    print("❌ Error response:")
                    print(f"Error: {response_data.get('error', 'Unknown error')}")
                    
            except json.JSONDecodeError as e:
                print(f"❌ Invalid JSON response: {e}")
                
        else:
            print("❌ No stdout output received")
            
    except subprocess.TimeoutExpired:
        print("⏰ Command timed out after 30 seconds")
    except Exception as e:
        print(f"❌ Error running command: {e}")

if __name__ == "__main__":
    test_nodejs_integration()
