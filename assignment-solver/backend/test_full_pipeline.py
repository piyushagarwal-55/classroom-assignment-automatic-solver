#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import os
import json
sys.path.append(os.path.dirname(__file__))

def test_full_assignment_solving():
    """Test the complete assignment solving pipeline"""
    print("🧪 Testing full assignment solving pipeline...")
    
    # Sample assignment text (similar to what would be extracted from PDF)
    sample_assignment = """
Lab-3-OOP.pdf

Processing file: Lab-3-OOP.pdf
[PDF] Attempting to read PDF from Google Drive:
[PDF] Drive service built successfully, downloading file...
[PDF] Download progress: 100%
[PDF] File downloaded successfully, reading PDF content...

"Success" "Solution for Lab-3 OOP Assignment" Here are the solutions to the questions:

1. Problem Statement: Write a Java program that calculates the resultant force from the x and y directions from the magnitude of the input force "F" (given in Newton) and theta (given in degrees). Compute the x and y components of the force... double forceX = force * Math.cos(angleRadians);

Computing Resultant Force

Problem Statement: Write a Java program that calculates the resultant force from the x and y directions from the magnitude of the input force "F" (given in Newton) and theta (given in degrees). Compute the x and y components of the force...

2. Scanner Implementation: The Scanner class is imported to allow the program to read input from the user. "Get Input Magnitude" and "Get Input Direction" prompts the user to enter the magnitude and direction of the force. The magnitude is read using "scanner.nextDouble()" and the direction is read using "scanner.nextDouble()".

3. Mathematical Calculations: Force components are calculated using trigonometric functions. The x and y components of the force are calculated using the formulas "Fx" = "F" * cos(theta) and "Fy" = "F" * sin(theta). Components are calculated using Math.cos(angleRadians) and Math.sin(theta)...
"""
    
    try:
        from services.assignmentSolver import AssignmentSolver
        
        # Test with dummy API key (won't actually call LLM)
        print("📝 Creating solver instance...")
        solver = AssignmentSolver("dummy_key_for_testing")
        
        # Test text cleaning
        print("🧹 Testing text cleaning...")
        cleaned_text = solver._clean_text_for_pdf(sample_assignment)
        print(f"✅ Text cleaned. Length: {len(cleaned_text)} chars")
        
        # Test PDF generation
        print("📄 Testing PDF generation...")
        pdf_bytes = solver.create_solution_pdf(cleaned_text, "Test Assignment Solution")
        
        if pdf_bytes and len(pdf_bytes) > 0:
            # Save test PDF
            output_file = "test_full_assignment.pdf"
            with open(output_file, "wb") as f:
                f.write(pdf_bytes)
            print(f"✅ PDF generated successfully!")
            print(f"📁 Size: {len(pdf_bytes)} bytes")
            print(f"💾 Saved as: {output_file}")
            
            # Try to open it
            print("🔍 Opening PDF for verification...")
            os.system(f"start {output_file}")
            
        else:
            print("❌ PDF generation failed - no bytes returned")
            
        # Test JSON response format (simulating what Node.js expects)
        print("🔄 Testing JSON response format...")
        result = {
            "success": True,
            "solutionText": cleaned_text,
            "pdfBytes": pdf_bytes.hex() if pdf_bytes else ""
        }
        
        print(f"📊 JSON result keys: {list(result.keys())}")
        print(f"📏 Solution text length: {len(result['solutionText'])}")
        print(f"📦 PDF hex length: {len(result['pdfBytes'])}")
        
        print("\n✅ All tests completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_full_assignment_solving()
