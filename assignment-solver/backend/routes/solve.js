const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const { auth } = require('../middleware/auth');
const Solution = require('../models/Solution');

// Add CORS headers to all responses in this router
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  next();
});

// Handle preflight requests for solve endpoint
router.options('/solve', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Handle preflight requests for solutions endpoint
router.options('/solutions', (req, res) => {
  console.log('🎯 OPTIONS request received for /solutions');
  console.log('🎯 OPTIONS request headers:', req.headers);
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  console.log('🎯 Sending OPTIONS response with CORS headers');
  res.sendStatus(200);
});

// Handle preflight requests for solution detail endpoints
router.options('/solution/:solutionId', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Handle preflight requests for PDF download endpoints
router.options('/solution/:solutionId/pdf', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// @route   POST /api/assignments/solve
// @desc    Solve an assignment using AI
// @access  Private
router.post('/solve', auth, async (req, res) => {
  try {
    console.log('🤖 SOLVE ASSIGNMENT - Starting assignment solving process');
    const user = req.user;
    const { assignmentId, assignmentTitle, courseId, courseName, materials } = req.body;

    console.log('🤖 Assignment details:', {
      assignmentId,
      assignmentTitle,
      courseId,
      courseName,
      materialsCount: materials?.length || 0
    });

    // Validate required fields
    if (!assignmentId || !assignmentTitle || !courseId || !courseName) {
      return res.status(400).json({
        error: 'Missing required fields: assignmentId, assignmentTitle, courseId, courseName'
      });
    }

    // Check if assignment already solved
    const existingSolution = await Solution.isAssignmentSolved(user._id, assignmentId);
    if (existingSolution) {
      console.log('🤖 Assignment already solved, returning existing solution');
      return res.json({
        success: true,
        message: 'Assignment already solved',
        solutionId: existingSolution._id,
        alreadySolved: true
      });
    }

    // Check if user has Google tokens
    if (!user.googleTokens || !user.googleTokens.accessToken) {
      return res.status(401).json({
        error: 'Google authentication required to solve assignments'
      });
    }

    // Create initial solution record
    const solution = new Solution({
      userId: user._id,
      assignmentId,
      assignmentTitle,
      courseId,
      courseName,
      status: 'processing',
      materials: materials?.map(m => ({
        fileId: m.driveFile?.driveFile?.id,
        fileName: m.driveFile?.driveFile?.title,
        fileUrl: m.driveFile?.driveFile?.alternateLink
      })) || []
    });

    await solution.save();
    console.log('🤖 Solution record created with ID:', solution._id);

    // Start solving process asynchronously
    solveAssignmentAsync(solution._id, user.googleTokens.accessToken, materials);

    res.json({
      success: true,
      message: 'Assignment solving started',
      solutionId: solution._id,
      status: 'processing'
    });

  } catch (error) {
    console.error('❌ Error starting assignment solve:', error);
    res.status(500).json({
      error: 'Failed to start assignment solving',
      message: error.message
    });
  }
});

// @route   GET /api/assignments/solution/:solutionId
// @desc    Get solution by ID
// @access  Private
router.get('/solution/:solutionId', auth, async (req, res) => {
  try {
    const { solutionId } = req.params;
    const user = req.user;

    const solution = await Solution.findOne({
      _id: solutionId,
      userId: user._id
    });

    if (!solution) {
      return res.status(404).json({
        error: 'Solution not found'
      });
    }

    res.json({
      success: true,
      solution: {
        id: solution._id,
        assignmentTitle: solution.assignmentTitle,
        courseName: solution.courseName,
        status: solution.status,
        solutionText: solution.solutionText,
        solvedAt: solution.solvedAt,
        processingTime: solution.processingTime
      }
    });

  } catch (error) {
    console.error('❌ Error fetching solution:', error);
    res.status(500).json({
      error: 'Failed to fetch solution',
      message: error.message
    });
  }
});

// @route   GET /api/assignments/solution/:solutionId/pdf
// @desc    Download solution PDF
// @access  Private
router.get('/solution/:solutionId/pdf', auth, async (req, res) => {
  try {
    const { solutionId } = req.params;
    const user = req.user;

    const solution = await Solution.findOne({
      _id: solutionId,
      userId: user._id
    });

    if (!solution) {
      return res.status(404).json({
        error: 'Solution not found'
      });
    }

    if (solution.status !== 'completed' || !solution.solutionPdf || solution.solutionPdf.length === 0) {
      return res.status(400).json({
        error: 'Solution PDF not available'
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${solution.assignmentTitle}_solution.pdf"`);
    res.send(solution.solutionPdf);

  } catch (error) {
    console.error('❌ Error downloading solution PDF:', error);
    res.status(500).json({
      error: 'Failed to download solution PDF',
      message: error.message
    });
  }
});

// @route   GET /api/assignments/test-solutions
// @desc    Test route to debug solutions endpoint
// @access  Private
router.get('/test-solutions', auth, async (req, res) => {
  console.log('🧪 TEST-SOLUTIONS ROUTE - Test route reached successfully');
  res.json({
    success: true,
    message: 'Test solutions route is working',
    user: req.user.email
  });
});

// @route   GET /api/assignments/solutions
// Test CORS route without authentication
router.get('/cors-test', (req, res) => {
  console.log('🧪 CORS TEST - Request received');
  
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  res.json({
    success: true,
    message: 'CORS test successful',
    timestamp: new Date().toISOString()
  });
});

router.options('/cors-test', (req, res) => {
  console.log('🧪 CORS TEST OPTIONS - Preflight request received');
  
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  res.sendStatus(200);
});

// @desc    Get user's solutions history
// @access  Private
router.get('/solutions', auth, async (req, res) => {
  try {
    console.log('📝 SOLUTIONS ROUTE - Getting user solutions');
    console.log('📝 Query parameters:', req.query);
    
    // Set comprehensive CORS headers
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Expose-Headers', 'Content-Length, X-Requested-With');
    
    const user = req.user;
    const limit = parseInt(req.query.limit) || 10;

    console.log('📝 User ID:', user._id);
    console.log('📝 Limit:', limit);

    const solutions = await Solution.findUserSolutions(user._id, limit);
    console.log('📝 Found solutions:', solutions.length);

    const response = {
      success: true,
      solutions: solutions.map(s => s.getSummary())
    };

    console.log('📝 Sending response with', response.solutions.length, 'solutions');
    res.json(response);

  } catch (error) {
    console.error('❌ Error fetching solutions:', error);
    res.status(500).json({
      error: 'Failed to fetch solutions',
      message: error.message
    });
  }
});

// Async function to solve assignment
async function solveAssignmentAsync(solutionId, accessToken, materials) {
  const startTime = Date.now();
  
  try {
    console.log('🤖 Starting async assignment solving for solution:', solutionId);
    
    // Get Gemini API key from environment
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }

    // Prepare materials data
    const materialsJson = JSON.stringify(materials || []);
    
    // Path to Python solver
    const pythonSolverPath = path.join(__dirname, '..', 'services', 'assignmentSolver.py');
    
    console.log('🤖 Calling Python solver with materials:', materials?.length || 0);
    
    // Spawn Python process with full path
    const pythonExecutable = 'C:\\Python313\\python.exe';
    const pythonProcess = spawn(pythonExecutable, [
      pythonSolverPath,
      geminiApiKey,
      accessToken,
      materialsJson
    ]);

    let solutionText = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      solutionText += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('🤖 Python solver error:', data.toString());
    });

    pythonProcess.on('close', async (code) => {
      const processingTime = Date.now() - startTime;
      
      try {
        const solution = await Solution.findById(solutionId);
        if (!solution) {
          console.error('🤖 Solution not found for ID:', solutionId);
          return;
        }

        if (code === 0 && solutionText.trim()) {
          console.log('🤖 Python solver completed successfully');
          
          // Parse the response (expecting JSON with solutionText and pdfBytes)
          let parsedResult;
          try {
            parsedResult = JSON.parse(solutionText);
          } catch (e) {
            // If not JSON, treat as plain text
            parsedResult = { solutionText: solutionText.trim() };
          }

          // Create PDF if not provided
          let pdfBuffer = Buffer.from('');
          if (parsedResult.pdfBytes) {
            try {
              pdfBuffer = Buffer.from(parsedResult.pdfBytes, 'hex');
            } catch (e) {
              console.error('🤖 Error parsing PDF bytes:', e);
              pdfBuffer = await createSimplePdf(parsedResult.solutionText || solutionText);
            }
          } else {
            // Generate PDF from text using simple method
            pdfBuffer = await createSimplePdf(parsedResult.solutionText || solutionText);
          }

          // Update solution with results
          solution.solutionText = parsedResult.solutionText || solutionText;
          if (pdfBuffer && pdfBuffer.length > 0) {
            solution.solutionPdf = pdfBuffer;
          }
          solution.status = 'completed';
          solution.processingTime = processingTime;
          
          await solution.save();
          console.log('🤖 Solution completed and saved');
          
        } else {
          console.error('🤖 Python solver failed with code:', code);
          console.error('🤖 Error output:', errorOutput);
          
          solution.status = 'failed';
          solution.solutionText = `Solving failed: ${errorOutput || 'Unknown error'}`;
          solution.processingTime = processingTime;
          
          await solution.save();
        }
      } catch (dbError) {
        console.error('🤖 Database error:', dbError);
      }
    });

  } catch (error) {
    console.error('🤖 Error in async solving:', error);
    
    try {
      const solution = await Solution.findById(solutionId);
      if (solution) {
        solution.status = 'failed';
        solution.solutionText = `Solving failed: ${error.message}`;
        solution.processingTime = Date.now() - startTime;
        await solution.save();
      }
    } catch (dbError) {
      console.error('🤖 Database error:', dbError);
    }
  }
}

// Simple PDF creation fallback
async function createSimplePdf(text) {
  try {
    if (!text || text.trim().length === 0) {
      return Buffer.from(''); // Return empty buffer for empty text
    }

    // Create a simple HTML to PDF conversion approach
    // For now, return empty buffer - you could integrate a PDF library here
    const pdfContent = `
PDF Content:
Assignment Solution

${text}

Generated by Assignment Solver
Date: ${new Date().toISOString()}
`;
    
    // For now, return the text as a simple buffer
    // In a production environment, you'd use a proper PDF library
    return Buffer.from(pdfContent, 'utf-8');
  } catch (error) {
    console.error('Error creating simple PDF:', error);
    return Buffer.from('');
  }
}

module.exports = router;
