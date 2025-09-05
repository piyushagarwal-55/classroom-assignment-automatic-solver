import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  AcademicCapIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ChartBarIcon,
  CogIcon,
  UserIcon,
  BellIcon,
  CalendarIcon,
  BookOpenIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  EyeIcon,
  PlayIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useAssignments } from '../hooks/useAssignments';
import { assignmentService } from '../services/api';
import GoogleAuthButton from '../components/GoogleAuthButton';

interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  dueTime: string | null;
  courseId: string;
  courseName?: string;
  state: string;
  maxPoints?: number;
  formattedDueDate: string;
  formattedDueTime: string;
  isOverdue: boolean;
  daysUntilDue: number | null;
  // Submission status fields
  isSolved: boolean;
  submissionState: string;
  submissionId?: string | null;
  submissionUpdateTime?: string | null;
  materials?: Array<{
    driveFile?: {
      driveFile?: {
        id: string;
        title: string;
        alternateLink: string;
        thumbnailUrl?: string;
      };
      shareMode?: string;
    };
    link?: {
      url: string;
      title: string;
    };
  }>;
  alternateLink?: string;
  workType?: string;
}

const Dashboard: React.FC = () => {
  const { user, logout, checkAuth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    assignments,
    loading,
    error,
    isGoogleLinked,
    totalCourses,
    overdueCount,
    refresh
  } = useAssignments();

  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [solvingAssignments, setSolvingAssignments] = useState<Set<string>>(new Set());
  const [solvedAssignments, setSolvedAssignments] = useState<Set<string>>(new Set());
  const [assignmentSolutions, setAssignmentSolutions] = useState<Map<string, string>>(new Map()); // assignment ID -> solution ID
  const [loadingSolutions, setLoadingSolutions] = useState<boolean>(false);
  const isLoadingSolutionsRef = useRef<boolean>(false);

  // Handle URL parameters from Google OAuth callback
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    const googleAuth = searchParams.get('google_auth');
    const token = searchParams.get('token');

    if (googleAuth === 'success' && token) {
      // Store the token in localStorage
      localStorage.setItem('token', token);
      // Trigger auth context to check and update user state
      checkAuth();
      setSuccessMessage('Google Classroom connected successfully!');
      refresh(); // Refresh assignments after successful connection
      // Clear URL parameters
      setSearchParams({});
    } else if (connected === 'true') {
      setSuccessMessage('Google Classroom connected successfully!');
      refresh(); // Refresh assignments after successful connection
      // Clear URL parameters
      setSearchParams({});
    }

    if (error) {
      const errorMessages: { [key: string]: string } = {
        'oauth_error': 'Google OAuth authorization was denied',
        'no_code': 'No authorization code received from Google',
        'auth_failed': 'Google authentication failed'
      };
      setErrorMessage(errorMessages[error] || `Google authentication error: ${error}`);
      // Clear URL parameters
      setSearchParams({});
    }

    // Clear messages after 5 seconds
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setErrorMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams, refresh, successMessage, errorMessage, checkAuth]);

  // Update stats when assignments change
  useEffect(() => {
    // Stats will be automatically updated through the hook
  }, [assignments]);

  // Load existing solutions for assignments (TEMPORARILY DISABLED to stop request loop)
  /*
  useEffect(() => {
    const loadExistingSolutions = async () => {
      // Prevent duplicate requests with multiple checks
      if (isLoadingSolutionsRef.current || loadingSolutions || solvedAssignments.size > 0) {
        console.log('⏳ Solutions already loading or loaded, skipping duplicate request');
        return;
      }

      try {
        console.log('🔍 Loading existing solutions...');
        isLoadingSolutionsRef.current = true;
        setLoadingSolutions(true);

        const solutions = await assignmentService.getSolutions(); // Remove limit parameter
        console.log('📝 Solutions response:', solutions);
        if (solutions.success) {
          const newSolvedAssignments = new Set<string>();
          const newAssignmentSolutions = new Map<string, string>();
          
          solutions.solutions.forEach((solution: any) => {
            if (solution.status === 'completed' && solution.assignmentId) {
              newSolvedAssignments.add(solution.assignmentId);
              newAssignmentSolutions.set(solution.assignmentId, solution._id);
            }
          });
          
          setSolvedAssignments(newSolvedAssignments);
          setAssignmentSolutions(newAssignmentSolutions);
          console.log('✅ Solutions loaded successfully:', solutions.solutions.length, 'solutions');
        }
      } catch (error:any) {
        console.error('❌ Error loading existing solutions:', error);
        // Try to get more specific error information
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
        } else if (error.request) {
          console.error('Request failed:', error.request);
        }
      } finally {
        isLoadingSolutionsRef.current = false;
        setLoadingSolutions(false);
      }
    };

    // Only load if we have assignments and haven't loaded solutions yet
    if (assignments.length > 0 && !loadingSolutions && !isLoadingSolutionsRef.current && solvedAssignments.size === 0) {
      loadExistingSolutions();
    }
  }, [assignments.length, loadingSolutions, solvedAssignments.size]); // Include all dependencies
  */

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5 }
    }
  };

  const getStatusColor = (assignment: Assignment) => {
    // If assignment is solved, show green
    if (assignment.isSolved) {
      return 'text-green-300 bg-green-500/20 border border-green-500/30';
    }
    
    // If overdue, show red
    if (assignment.isOverdue) {
      return 'text-red-300 bg-red-500/20 border border-red-500/30';
    }
    
    // Check submission state
    switch (assignment.submissionState) {
      case 'CREATED':
        return 'text-blue-300 bg-blue-500/20 border border-blue-500/30';
      case 'NEW':
        return 'text-yellow-300 bg-yellow-500/20 border border-yellow-500/30';
      default:
        // Fallback to assignment state
        switch (assignment.state) {
          case 'TURNED_IN':
            return 'text-green-300 bg-green-500/20 border border-green-500/30';
          case 'CREATED':
            return 'text-blue-300 bg-blue-500/20 border border-blue-500/30';
          case 'ASSIGNED':
            return 'text-yellow-300 bg-yellow-500/20 border border-yellow-500/30';
          default:
            return 'text-slate-300 bg-slate-500/20 border border-slate-500/30';
        }
    }
  };

  const getPriorityColor = (assignment: Assignment) => {
    if (assignment.isOverdue) {
      return 'border-red-500';
    }
    
    if (assignment.daysUntilDue !== null) {
      if (assignment.daysUntilDue <= 1) return 'border-red-500';
      if (assignment.daysUntilDue <= 3) return 'border-yellow-500';
      return 'border-green-500';
    }
    
    return 'border-slate-500';
  };

  const getStatusText = (assignment: Assignment) => {
    // First check if assignment is solved based on submission status
    if (assignment.isSolved) {
      if (assignment.submissionState === 'TURNED_IN') return 'Submitted';
      if (assignment.submissionState === 'RETURNED') return 'Graded';
      return 'Completed';
    }
    
    if (assignment.isOverdue) return 'Overdue';
    
    // Check submission state for more detailed status
    switch (assignment.submissionState) {
      case 'CREATED': return 'In Progress';
      case 'NEW': return 'Not Started';
      default:
        // Fallback to assignment state
        switch (assignment.state) {
          case 'TURNED_IN': return 'Submitted';
          case 'CREATED': return 'In Progress';
          case 'ASSIGNED': return 'Assigned';
          default: return 'Unknown';
        }
    }
  };

  const handleDownloadPDF = async (assignment: Assignment) => {
    try {
      const solutionId = assignmentSolutions.get(assignment.id);
      if (!solutionId) {
        setErrorMessage('Solution ID not found. Please solve the assignment first.');
        return;
      }

      const response = await assignmentService.downloadSolutionPdf(solutionId);
      
      // Create a blob from the response
      const blob = new Blob([response], { type: 'application/pdf' });
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${assignment.title}_solution.pdf`);
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setSuccessMessage(`PDF solution for "${assignment.title}" downloaded successfully!`);
    } catch (error: any) {
      console.error('❌ Error downloading PDF:', error);
      setErrorMessage(`Failed to download PDF: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleSolveAssignment = async (assignment: Assignment) => {
    if (solvingAssignments.has(assignment.id)) {
      return; // Already solving
    }

    try {
      console.log('🤖 Starting to solve assignment:', assignment.title);
      
      // Add to solving set
      setSolvingAssignments(prev => new Set(prev).add(assignment.id));
      setErrorMessage('');
      setSuccessMessage('');

      // Prepare assignment data for solving
      const assignmentData = {
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        courseId: assignment.courseId,
        courseName: assignment.courseName,
        materials: assignment.materials || []
      };

      // Call solve API
      const response = await assignmentService.solveAssignment(assignmentData);
      
      if (response.success) {
        if (response.alreadySolved) {
          setSuccessMessage(`Assignment "${assignment.title}" was already solved! Check your solutions history.`);
          setSolvedAssignments(prev => new Set(prev).add(assignment.id));
          if (response.solutionId) {
            setAssignmentSolutions(prev => new Map(prev).set(assignment.id, response.solutionId));
          }
        } else {
          setSuccessMessage(`Started solving "${assignment.title}". This may take a few minutes...`);
          
          // Poll for completion
          pollSolutionStatus(response.solutionId, assignment);
        }
      } else {
        throw new Error(response.message || 'Failed to start solving assignment');
      }

    } catch (error: any) {
      console.error('❌ Error solving assignment:', error);
      setErrorMessage(`Failed to solve assignment: ${error.response?.data?.error || error.message}`);
    } finally {
      // Remove from solving set after a delay
      setTimeout(() => {
        setSolvingAssignments(prev => {
          const newSet = new Set(prev);
          newSet.delete(assignment.id);
          return newSet;
        });
      }, 2000);
    }
  };

  const pollSolutionStatus = async (solutionId: string, assignment: Assignment) => {
    const maxAttempts = 30; // 5 minutes max (10 seconds * 30)
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;
        const response = await assignmentService.getSolution(solutionId);
        
        if (response.success) {
          const solution = response.solution;
          
          if (solution.status === 'completed') {
            setSuccessMessage(`✅ Assignment "${assignment.title}" solved successfully! You can download the solution PDF.`);
            setSolvedAssignments(prev => new Set(prev).add(assignment.id));
            setAssignmentSolutions(prev => new Map(prev).set(assignment.id, solutionId));
            return;
          } else if (solution.status === 'failed') {
            setErrorMessage(`❌ Failed to solve assignment "${assignment.title}". Please try again.`);
            return;
          } else if (solution.status === 'processing' && attempts < maxAttempts) {
            // Continue polling
            setTimeout(poll, 10000); // Poll every 10 seconds
            return;
          }
        }
        
        // If we reach here, either failed or max attempts reached
        if (attempts >= maxAttempts) {
          setErrorMessage(`⏰ Assignment solving is taking longer than expected. Please check your solutions history later.`);
        }
        
      } catch (error) {
        console.error('Error polling solution status:', error);
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000); // Continue polling on error
        }
      }
    };

    // Start polling after initial delay
    setTimeout(poll, 5000);
  };

  const handleViewMaterial = (material: any) => {
    if (material.driveFile?.driveFile?.alternateLink) {
      window.open(material.driveFile.driveFile.alternateLink, '_blank');
    } else if (material.link?.url) {
      window.open(material.link.url, '_blank');
    }
  };

  const handleViewAssignment = (assignment: Assignment) => {
    if (assignment.alternateLink) {
      window.open(assignment.alternateLink, '_blank');
    }
  };

  // Filter assignments to show only assigned/pending ones (not completed or solved)
  const pendingAssignments = assignments.filter(assignment => 
    assignment.state !== 'TURNED_IN' && 
    assignment.state !== 'RETURNED' && 
    !assignment.isSolved  // Exclude assignments that are marked as solved
  );

  const handleGoogleAuthSuccess = (user: any) => {
    // Refresh assignments after successful authentication
    refresh();
  };

  const handleGoogleAuthError = (error: string) => {
    console.error('Google authentication failed:', error);
  };

  // If Google Classroom is not linked, show connection prompt
  if (!isGoogleLinked && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full mx-auto p-8"
        >
          <div className="bg-slate-800/90 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <LinkIcon className="w-8 h-8 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-4">Connect Google Classroom</h2>
            <p className="text-slate-400 mb-8">
              To view your assignments, please connect your Google Classroom account. This will allow us to fetch your real assignment data.
            </p>
            
            <GoogleAuthButton
              onSuccess={handleGoogleAuthSuccess}
              onError={handleGoogleAuthError}
              className="w-full"
            />
            
            {error && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-500/10 to-blue-500/10 rounded-full blur-3xl animate-float" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/3 right-1/3 w-96 h-96 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 rounded-full blur-3xl animate-float" style={{animationDelay: '4s'}}></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 bg-slate-800/90 backdrop-blur-lg border border-slate-700/50 mx-6 pt-6 pb-4 px-4 rounded-b-2xl shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">AS</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Assignment Solver</h1>
              <p className="text-slate-400 text-sm">Welcome back, {user?.firstName}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200">
              <BellIcon className="w-5 h-5" />
            </button>
            <button className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200">
              <CogIcon className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-white" />
              </div>
              <button
                onClick={logout}
                className="text-sm text-slate-300 hover:text-white transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <motion.div
        className="relative z-10 p-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Success/Error Messages */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-xl"
          >
            <p className="text-green-300 text-center">{successMessage}</p>
          </motion.div>
        )}

        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl"
          >
            <p className="text-red-300 text-center">{errorMessage}</p>
          </motion.div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <motion.div variants={itemVariants} className="bg-slate-800/90 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Unsolved</p>
                <p className="text-3xl font-bold text-white">{pendingAssignments.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <DocumentTextIcon className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-slate-800/90 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Solved</p>
                <p className="text-3xl font-bold text-white">{assignments.filter(a => a.isSolved).length}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-slate-800/90 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">In Progress</p>
                <p className="text-3xl font-bold text-white">{assignments.filter(a => a.submissionState === 'CREATED' && !a.isSolved).length}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <ClockIcon className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-slate-800/90 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Overdue</p>
                <p className="text-3xl font-bold text-white">{overdueCount}</p>
              </div>
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-slate-800/90 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Courses</p>
                <p className="text-3xl font-bold text-white">{totalCourses}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <AcademicCapIcon className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Assignments List */}
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <div className="bg-slate-800/90 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Unsolved Assignments</h2>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-slate-400">
                    {pendingAssignments.length} assignments to solve
                  </span>
                  <button
                    onClick={refresh}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 text-sm rounded-xl transition-all duration-200"
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                  <span className="ml-3 text-slate-400">Loading assignments...</span>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
                  <p className="text-red-300 mb-4">{error}</p>
                  <button
                    onClick={refresh}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : pendingAssignments.length === 0 ? (
                <div className="text-center py-12">
                  <DocumentTextIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-400 mb-2">No unsolved assignments</p>
                  <p className="text-slate-500 text-sm">All your assignments are solved! 🎉</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingAssignments.slice(0, 10).map((assignment, index) => (
                    <motion.div
                      key={assignment.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`bg-slate-800/50 border-l-4 ${getPriorityColor(assignment)} rounded-lg p-4 hover:bg-slate-700/50 transition-all duration-200 group`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors">
                              {assignment.title}
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment)}`}>
                              {getStatusText(assignment)}
                            </span>
                            {assignment.isOverdue && (
                              <span className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-xs font-medium text-red-300">
                                Overdue
                              </span>
                            )}
                          </div>
                          <p className="text-slate-400 text-sm mb-3 line-clamp-2">
                            {assignment.description || 'No description available'}
                          </p>
                          
                          {/* Assignment Materials */}
                          {assignment.materials && assignment.materials.length > 0 && (
                            <div className="mb-3">
                              <p className="text-slate-500 text-xs mb-2">Materials:</p>
                              <div className="flex flex-wrap gap-2">
                                {assignment.materials.map((material: any, idx: number) => (
                                  <button
                                    key={idx}
                                    onClick={() => handleViewMaterial(material)}
                                    className="flex items-center space-x-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg px-2 py-1 text-xs text-blue-300 transition-colors"
                                  >
                                    <EyeIcon className="w-3 h-3" />
                                    <span>
                                      {material.driveFile?.driveFile?.title || material.link?.title || 'View Material'}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-4 text-xs text-slate-500 mb-3">
                            <span className="flex items-center space-x-1">
                              <BookOpenIcon className="w-4 h-4" />
                              <span>{assignment.courseName || `Course: ${assignment.courseId}`}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <CalendarIcon className="w-4 h-4" />
                              <span>
                                {assignment.dueDate 
                                  ? `Due ${assignment.formattedDueDate}${assignment.dueTime ? ` at ${assignment.formattedDueTime}` : ''}`
                                  : 'No due date'
                                }
                              </span>
                            </span>
                            {assignment.maxPoints && (
                              <span className="flex items-center space-x-1">
                                <span>Points: {assignment.maxPoints}</span>
                              </span>
                            )}
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleSolveAssignment(assignment)}
                              disabled={solvingAssignments.has(assignment.id) || solvedAssignments.has(assignment.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1 transition-all duration-200 shadow-lg hover:shadow-xl ${
                                solvedAssignments.has(assignment.id)
                                  ? 'bg-green-500 text-white cursor-not-allowed'
                                  : solvingAssignments.has(assignment.id)
                                  ? 'bg-yellow-500 text-white cursor-not-allowed'
                                  : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
                              }`}
                            >
                              {solvedAssignments.has(assignment.id) ? (
                                <>
                                  <CheckCircleIcon className="w-3 h-3" />
                                  <span>Solved</span>
                                </>
                              ) : solvingAssignments.has(assignment.id) ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span>Solving...</span>
                                </>
                              ) : (
                                <>
                                  <PlayIcon className="w-3 h-3" />
                                  <span>Solve Assignment</span>
                                </>
                              )}
                            </button>
                            
                            {/* Download PDF Button - only show if solved */}
                            {solvedAssignments.has(assignment.id) && assignmentSolutions.has(assignment.id) && (
                              <button
                                onClick={() => handleDownloadPDF(assignment)}
                                className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1 transition-all duration-200"
                                title="Download PDF Solution"
                              >
                                <ArrowDownTrayIcon className="w-3 h-3" />
                                <span>Download PDF</span>
                              </button>
                            )}
                            
                            <button
                              onClick={() => handleViewAssignment(assignment)}
                              className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1 transition-all duration-200"
                            >
                              <EyeIcon className="w-3 h-3" />
                              <span>View in Classroom</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  
                  {pendingAssignments.length > 10 && (
                    <div className="text-center pt-4">
                      <button className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
                        View all {pendingAssignments.length} pending assignments →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Quick Actions & AI Assistant */}
          <motion.div variants={itemVariants} className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-slate-800/90 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl p-4 text-left transition-all duration-200 transform hover:scale-105 shadow-lg">
                  <div className="flex items-center space-x-3">
                    <AcademicCapIcon className="w-6 h-6" />
                    <div>
                      <p className="font-medium">Solve Assignment</p>
                      <p className="text-sm opacity-80">Get AI-powered solutions</p>
                    </div>
                  </div>
                </button>
                
                <button className="w-full bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white rounded-xl p-4 text-left transition-all duration-200 transform hover:scale-105 shadow-lg">
                  <div className="flex items-center space-x-3">
                    <DocumentTextIcon className="w-6 h-6" />
                    <div>
                      <p className="font-medium">Upload Document</p>
                      <p className="text-sm opacity-80">Scan & analyze assignments</p>
                    </div>
                  </div>
                </button>
                
                <button className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl p-4 text-left transition-all duration-200 transform hover:scale-105 shadow-lg">
                  <div className="flex items-center space-x-3">
                    <ChartBarIcon className="w-6 h-6" />
                    <div>
                      <p className="font-medium">View Analytics</p>
                      <p className="text-sm opacity-80">Track your progress</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* AI Assistant */}
            <div className="bg-slate-800/90 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4">AI Assistant</h3>
              <div className="bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-xl p-4 border border-blue-500/30">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">AI</span>
                  </div>
                  <div>
                    <p className="text-white text-sm mb-2">
                      I'm ready to help you solve your assignments! Upload a document or describe your problem.
                    </p>
                    <button className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
                      Start conversation →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-slate-800/90 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4">Recent Activity</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-slate-300">Completed Shakespeare Essay</span>
                  <span className="text-slate-500 ml-auto">2h ago</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-slate-300">Started Biology Lab Report</span>
                  <span className="text-slate-500 ml-auto">5h ago</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span className="text-slate-300">Uploaded Math Assignment</span>
                  <span className="text-slate-500 ml-auto">1d ago</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
