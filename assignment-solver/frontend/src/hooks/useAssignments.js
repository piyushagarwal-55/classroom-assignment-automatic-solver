import { useState, useEffect, useCallback } from 'react';
import { assignmentService } from '../services/api';

export const useAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);

  // Check if user is authenticated with JWT
  const isAuthenticated = () => {
    const token = localStorage.getItem('token');
    console.log('🎯 useAssignments - Checking authentication, token:', token ? 'Token present' : 'No token');
    return !!token;
  };

  // Fetch all assignments
  const fetchAssignments = useCallback(async () => {
    console.log('🎯 useAssignments - fetchAssignments called');
    if (!isAuthenticated()) {
      console.log('🎯 useAssignments - User not authenticated, skipping fetch');
      setError('Please sign in to access your assignments');
      setIsGoogleLinked(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    console.log('🎯 useAssignments - Making API call to fetch assignments');
    try {
      const response = await assignmentService.getAllAssignments();
      console.log('🎯 useAssignments - Assignment API response:', response);
      console.log('🎯 useAssignments - Assignment data structure:', response.data);
      console.log('🎯 useAssignments - Assignments array:', response.data?.assignments);
      setAssignments(response.data?.assignments || []);
      setIsGoogleLinked(true);
    } catch (error) {
      console.error('🎯 useAssignments - Error fetching assignments:', error);
      console.log('🎯 useAssignments - Error response:', error.response?.data);
      setError(error.response?.data?.error || 'Failed to fetch assignments');
      
      // If it's an auth error, user needs to link Google account
      if (error.response?.status === 401) {
        const errorCode = error.response?.data?.code;
        const errorMessage = error.response?.data?.error;
        console.log('🎯 useAssignments - 401 error, code:', errorCode, 'message:', errorMessage);
        
        if (errorCode === 'GOOGLE_AUTH_REQUIRED' || errorMessage === 'Google authentication required') {
          console.log('🎯 useAssignments - Setting Google linked to false');
          setIsGoogleLinked(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all courses
  const fetchCourses = useCallback(async () => {
    console.log('📚 useAssignments - fetchCourses called');
    if (!isAuthenticated()) {
      console.log('📚 useAssignments - User not authenticated');
      setError('Please sign in to access your courses');
      setIsGoogleLinked(false);
      return;
    }

    console.log('📚 useAssignments - Starting courses fetch');
    setLoading(true);
    setError(null);
    
    try {
      console.log('📚 useAssignments - Calling assignmentService.getCourses()');
      const response = await assignmentService.getCourses();
      console.log('📚 useAssignments - Courses response received:', response);
      console.log('📚 useAssignments - Courses data structure:', response.data);
      setCourses(response.data?.courses || []);
      setIsGoogleLinked(true);
    } catch (error) {
      console.error('📚 useAssignments - Error fetching courses:', error);
      console.log('📚 useAssignments - Error response:', error.response?.data);
      setError(error.response?.data?.error || 'Failed to fetch courses');
      
      if (error.response?.status === 401) {
        const errorCode = error.response?.data?.code;
        const errorMessage = error.response?.data?.error;
        console.log('📚 useAssignments - 401 error, code:', errorCode, 'message:', errorMessage);
        
        if (errorCode === 'GOOGLE_AUTH_REQUIRED' || errorMessage === 'Google authentication required') {
          console.log('📚 useAssignments - Setting Google linked to false');
          setIsGoogleLinked(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch assignments for a specific course
  const fetchCourseAssignments = useCallback(async (courseId) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await assignmentService.getCourseAssignments(courseId);
      return response.data?.assignments || [];
    } catch (error) {
      console.error('Error fetching course assignments:', error);
      setError(error.response?.data?.error || 'Failed to fetch course assignments');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize data on mount
  useEffect(() => {
    const initializeData = async () => {
      // Only try to fetch if user is authenticated
      if (isAuthenticated()) {
        await Promise.all([fetchAssignments(), fetchCourses()]);
      } else {
        setError('Please sign in to access your assignments and courses');
        setIsGoogleLinked(false);
      }
    };

    initializeData();
  }, [fetchAssignments, fetchCourses]);

  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([fetchAssignments(), fetchCourses()]);
  }, [fetchAssignments, fetchCourses]);

  // Get assignments by status
  const getAssignmentsByStatus = useCallback((status) => {
    return assignments.filter(assignment => assignment.status === status);
  }, [assignments]);

  // Get overdue assignments
  const getOverdueAssignments = useCallback(() => {
    const now = new Date();
    return assignments.filter(assignment => 
      assignment.dueDate && new Date(assignment.dueDate) < now
    );
  }, [assignments]);

  // Get upcoming assignments (due within next 7 days)
  const getUpcomingAssignments = useCallback(() => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return assignments.filter(assignment => 
      assignment.dueDate && 
      new Date(assignment.dueDate) >= now && 
      new Date(assignment.dueDate) <= nextWeek
    );
  }, [assignments]);

  // Format assignment data for display
  const formatAssignmentForDisplay = useCallback((assignment) => {
    return {
      ...assignment,
      formattedDueDate: assignment.dueDate ? 
        new Date(assignment.dueDate).toLocaleDateString() : 'No due date',
      formattedDueTime: assignment.dueTime || 'No time specified',
      isOverdue: assignment.dueDate ? new Date(assignment.dueDate) < new Date() : false,
      daysUntilDue: assignment.dueDate ? 
        Math.ceil((new Date(assignment.dueDate) - new Date()) / (1000 * 60 * 60 * 24)) : null
    };
  }, []);

  return {
    // Data
    assignments: assignments.map(formatAssignmentForDisplay),
    courses,
    
    // State
    loading,
    error,
    isGoogleLinked,
    
    // Actions
    fetchAssignments,
    fetchCourses,
    fetchCourseAssignments,
    refresh,
    
    // Computed data
    getAssignmentsByStatus,
    getOverdueAssignments,
    getUpcomingAssignments,
    
    // Stats
    totalAssignments: assignments.length,
    totalCourses: courses.length,
    overdueCount: getOverdueAssignments().length,
    upcomingCount: getUpcomingAssignments().length,
  };
};
