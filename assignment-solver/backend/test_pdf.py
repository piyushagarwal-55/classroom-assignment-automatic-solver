#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import os
sys.path.append(os.path.dirname(__file__))

from services.assignmentSolver import AssignmentSolver

def test_pdf_generation():
    """Test PDF generation with sample text"""
    print("Testing PDF generation...")
    
    # Sample text with potential encoding issues
    sample_text = """
Assignment Solution

1. Problem Statement:
Write a Java program that calculates the force using F = ma.

Solution:
Here's a simple Java program:

public class ForceCalculator {
    public static void main(String[] args) {
        double mass = 10.0; // kg
        double acceleration = 9.8; // m/s²
        double force = mass * acceleration;
        System.out.println("Force = " + force + " N");
    }
}

2. Mathematical Analysis:
Given: F = ma
Where:
- F = Force (Newtons)
- m = mass (kg)  
- a = acceleration (m/s²)

For our example:
F = 10.0 × 9.8 = 98.0 N

3. Explanation:
This program demonstrates Newton's second law of motion. The force equals mass times acceleration.
"""
    
    try:
        # Create solver instance (dummy API key for testing)
        solver = AssignmentSolver("dummy_key")
        
        # Generate PDF
        pdf_bytes = solver.create_solution_pdf(sample_text, "Test Assignment Solution")
        
        if pdf_bytes:
            # Save test PDF
            with open("test_output.pdf", "wb") as f:
                f.write(pdf_bytes)
            print(f"✅ PDF generated successfully! Size: {len(pdf_bytes)} bytes")
            print("📄 Saved as 'test_output.pdf'")
        else:
            print("❌ PDF generation failed - no bytes returned")
            
    except Exception as e:
        print(f"❌ Error during PDF generation: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_pdf_generation()
