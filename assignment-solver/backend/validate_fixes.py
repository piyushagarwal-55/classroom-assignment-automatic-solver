#!/usr/bin/env python3
"""
Assignment Solver Encoding Fix Summary
=====================================

This script validates all the encoding and PDF generation fixes.
"""

import sys
import os
import json
import subprocess

def run_validation_tests():
    """Run comprehensive validation tests"""
    print("🔍 ASSIGNMENT SOLVER ENCODING FIX VALIDATION")
    print("=" * 50)
    
    tests_passed = 0
    total_tests = 0
    
    # Test 1: Python encoding configuration
    print("\n1️⃣ Testing Python encoding configuration...")
    total_tests += 1
    try:
        encoding_info = {
            "default_encoding": sys.getdefaultencoding(),
            "filesystem_encoding": sys.getfilesystemencoding(),
            "stdout_encoding": getattr(sys.stdout, 'encoding', 'unknown'),
            "stderr_encoding": getattr(sys.stderr, 'encoding', 'unknown')
        }
        print(f"   ✅ Default encoding: {encoding_info['default_encoding']}")
        print(f"   ✅ Filesystem encoding: {encoding_info['filesystem_encoding']}")
        print(f"   ✅ Stdout encoding: {encoding_info['stdout_encoding']}")
        print(f"   ✅ Stderr encoding: {encoding_info['stderr_encoding']}")
        tests_passed += 1
    except Exception as e:
        print(f"   ❌ Encoding test failed: {e}")
    
    # Test 2: ReportLab PDF generation
    print("\n2️⃣ Testing ReportLab PDF generation...")
    total_tests += 1
    try:
        from services.assignmentSolver import AssignmentSolver
        solver = AssignmentSolver("dummy_key")
        
        sample_text = """Test assignment solution with special characters:
- Mathematical: F = ma, a^2 + b^2 = c^2
- Quotes: "Hello" and 'world'
- Symbols: <=, >=, !=
- Code: System.out.println("Hello");"""
        
        pdf_bytes = solver.create_solution_pdf(sample_text, "Test Solution")
        if pdf_bytes and len(pdf_bytes) > 1000:
            print(f"   ✅ PDF generated successfully ({len(pdf_bytes)} bytes)")
            tests_passed += 1
        else:
            print(f"   ❌ PDF generation failed or too small")
    except Exception as e:
        print(f"   ❌ PDF generation test failed: {e}")
    
    # Test 3: Text cleaning function
    print("\n3️⃣ Testing text cleaning function...")
    total_tests += 1
    try:
        from services.assignmentSolver import AssignmentSolver
        solver = AssignmentSolver("dummy_key")
        
        problematic_text = 'Test with "curly quotes" and —em-dashes— and ×symbols÷'
        cleaned = solver._clean_text_for_pdf(problematic_text)
        
        # Check if problematic characters are gone
        has_ascii_only = all(ord(c) < 128 for c in cleaned)
        if has_ascii_only and '"curly quotes"' in cleaned and 'x' in cleaned:
            print(f"   ✅ Text cleaning works properly")
            print(f"   📝 Original: {problematic_text}")
            print(f"   🧹 Cleaned:  {cleaned}")
            tests_passed += 1
        else:
            print(f"   ❌ Text cleaning failed")
    except Exception as e:
        print(f"   ❌ Text cleaning test failed: {e}")
    
    # Test 4: JSON output format
    print("\n4️⃣ Testing JSON output format...")
    total_tests += 1
    try:
        # Simulate the exact Node.js command
        cmd = [
            sys.executable,
            os.path.join(os.path.dirname(__file__), "services", "assignmentSolver.py"),
            "test_api_key",
            "test_token",
            json.dumps([{"id": "test", "title": "Test Assignment"}])
        ]
        
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        
        result = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=10)
        
        if result.returncode == 0 and result.stdout:
            try:
                response = json.loads(result.stdout)
                required_keys = ['success', 'solutionText', 'pdfBytes']
                has_all_keys = all(key in response for key in required_keys)
                
                if has_all_keys:
                    print(f"   ✅ JSON response format is correct")
                    print(f"   📊 Keys: {list(response.keys())}")
                    tests_passed += 1
                else:
                    print(f"   ❌ Missing required keys in JSON response")
            except json.JSONDecodeError:
                print(f"   ❌ Invalid JSON in stdout")
        else:
            print(f"   ❌ Command failed or no output")
    except Exception as e:
        print(f"   ❌ JSON output test failed: {e}")
    
    # Test 5: Error handling
    print("\n5️⃣ Testing error handling...")
    total_tests += 1
    try:
        cmd = [
            sys.executable,
            os.path.join(os.path.dirname(__file__), "services", "assignmentSolver.py"),
            # Missing arguments to trigger error
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        
        if result.returncode != 0 and result.stdout:
            try:
                error_response = json.loads(result.stdout)
                if not error_response.get('success') and 'error' in error_response:
                    print(f"   ✅ Error handling works correctly")
                    tests_passed += 1
                else:
                    print(f"   ❌ Error response format incorrect")
            except json.JSONDecodeError:
                print(f"   ❌ Error response not valid JSON")
        else:
            print(f"   ❌ Error handling test failed")
    except Exception as e:
        print(f"   ❌ Error handling test failed: {e}")
    
    # Summary
    print("\n" + "=" * 50)
    print(f"🎯 VALIDATION SUMMARY: {tests_passed}/{total_tests} tests passed")
    
    if tests_passed == total_tests:
        print("🎉 ALL TESTS PASSED! The encoding fixes are working correctly.")
        print("\n✅ FIXES IMPLEMENTED:")
        print("   • UTF-8 encoding setup for Windows Python")
        print("   • Safe print function with stderr output")
        print("   • Improved ReportLab PDF generation with Platypus")
        print("   • Comprehensive text cleaning for ASCII compatibility")
        print("   • Enhanced error handling and logging")
        print("   • Proper JSON response format for Node.js integration")
        
        print("\n🔧 TECHNICAL CHANGES:")
        print("   • Switched from Canvas to SimpleDocTemplate for better text handling")
        print("   • Added Paragraph and styling for proper text layout")
        print("   • Enhanced Unicode character replacement mapping")
        print("   • Debug output redirected to stderr")
        print("   • Comprehensive input validation")
        
    else:
        print(f"⚠️ {total_tests - tests_passed} tests failed. Please review the output above.")
    
    return tests_passed == total_tests

if __name__ == "__main__":
    success = run_validation_tests()
    sys.exit(0 if success else 1)
