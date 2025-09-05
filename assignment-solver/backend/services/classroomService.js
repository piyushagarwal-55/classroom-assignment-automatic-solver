const { google } = require('googleapis');
const { oauth2Client } = require('../config/googleAuth');

/**
 * Get all courses from Google Classroom
 */
const getCourses = async (accessToken) => {
  try {
    oauth2Client.setCredentials({ access_token: accessToken });
    const classroom = google.classroom({ version: 'v1', auth: oauth2Client });
    
    const response = await classroom.courses.list({
      courseStates: ['ACTIVE'],
      pageSize: 100
    });
    
    return response.data.courses || [];
  } catch (error) {
    console.error('Error fetching courses:', error);
    throw new Error('Failed to fetch courses from Google Classroom');
  }
};

/**
 * Get assignments (coursework) for a specific course
 */
const getCourseAssignments = async (accessToken, courseId) => {
  try {
    oauth2Client.setCredentials({ access_token: accessToken });
    const classroom = google.classroom({ version: 'v1', auth: oauth2Client });
    
    console.log(`🔍 getCourseAssignments - Fetching assignments for course ID: ${courseId}`);
    
    // Try fetching with different states to catch all assignments
    const response = await classroom.courses.courseWork.list({
      courseId: courseId,
      courseWorkStates: ['PUBLISHED', 'DRAFT'],  // Include both published and draft assignments
      pageSize: 100
    });
    
    const assignments = response.data.courseWork || [];
    console.log(`🔍 getCourseAssignments - Raw response for course ${courseId}:`, assignments.length, 'assignments');
    
    if (assignments.length > 0) {
      console.log(`🔍 First assignment example:`, JSON.stringify(assignments[0], null, 2));
    }
    
    return assignments;
  } catch (error) {
    console.error(`❌ Error fetching assignments for course ${courseId}:`, error.message);
    console.error(`❌ Full error:`, error);
    throw new Error(`Failed to fetch assignments for course ${courseId}`);
  }
};

/**
 * Get all assignments from all enrolled courses
 */
const getAllAssignments = async (accessToken) => {
  try {
    console.log('🔍 getAllAssignments - Starting to fetch assignments...');
    const courses = await getCourses(accessToken);
    console.log(`🔍 getAllAssignments - Found ${courses.length} courses`);
    
    // Get current user profile to get their ID for submission checking
    let currentUserId = 'me'; // Default fallback
    try {
      const userProfile = await getUserProfile(accessToken);
      currentUserId = userProfile.id;
      console.log(`🔍 getAllAssignments - Current user ID: ${currentUserId}`);
    } catch (userError) {
      console.warn('⚠️ Could not fetch user profile, using "me" as user ID');
    }
    
    const allAssignments = [];
    
    for (const course of courses) {
      try {
        console.log(`🔍 Fetching assignments for course: ${course.name} (ID: ${course.id})`);
        const assignments = await getCourseAssignments(accessToken, course.id);
        console.log(`🔍 Found ${assignments.length} assignments in course: ${course.name}`);
        
        // Add course information and submission status to each assignment
        for (const assignment of assignments) {
          // Check submission status for this assignment
          const submissionStatus = await checkAssignmentStatus(
            accessToken, 
            course.id, 
            assignment.id, 
            currentUserId
          );
          
          const assignmentWithDetails = {
            id: assignment.id,
            title: assignment.title,
            description: assignment.description || '',
            courseName: course.name,
            courseId: course.id,
            dueDate: assignment.dueDate ? formatDueDate(assignment.dueDate, assignment.dueTime) : null,
            creationTime: assignment.creationTime,
            updateTime: assignment.updateTime,
            maxPoints: assignment.maxPoints || null,
            workType: assignment.workType || 'ASSIGNMENT',
            state: assignment.state || 'PUBLISHED',
            alternateLink: assignment.alternateLink,
            materials: assignment.materials || [],
            // Add submission status
            isSolved: submissionStatus.isSolved,
            submissionState: submissionStatus.submissionState,
            submissionId: submissionStatus.submissionId || null,
            submissionUpdateTime: submissionStatus.updateTime || null
          };
          
          allAssignments.push(assignmentWithDetails);
        }
      } catch (courseError) {
        console.warn(`⚠️ Skipping course ${course.name} due to error:`, courseError.message);
        // Continue with other courses even if one fails
      }
    }
    
    console.log(`🔍 getAllAssignments - Total assignments fetched: ${allAssignments.length}`);
    const solvedCount = allAssignments.filter(a => a.isSolved).length;
    const unsolvedCount = allAssignments.filter(a => !a.isSolved).length;
    console.log(`🔍 getAllAssignments - Solved: ${solvedCount}, Unsolved: ${unsolvedCount}`);
    
    return allAssignments;
  } catch (error) {
    console.error('Error fetching all assignments:', error);
    throw new Error('Failed to fetch assignments from Google Classroom');
  }
};

/**
 * Format due date from Google Classroom format
 */
const formatDueDate = (dueDate, dueTime) => {
  try {
    if (!dueDate) return null;
    
    const { year, month, day } = dueDate;
    let dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    if (dueTime) {
      const { hours = 23, minutes = 59 } = dueTime;
      dateStr += `T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    } else {
      dateStr += 'T23:59:00';
    }
    
    return dateStr;
  } catch (error) {
    console.error('Error formatting due date:', error);
    return null;
  }
};

/**
 * Get student submissions for a specific assignment
 */
const getAssignmentSubmissions = async (accessToken, courseId, assignmentId) => {
  try {
    oauth2Client.setCredentials({ access_token: accessToken });
    const classroom = google.classroom({ version: 'v1', auth: oauth2Client });
    
    const response = await classroom.courses.courseWork.studentSubmissions.list({
      courseId: courseId,
      courseWorkId: assignmentId,
      states: ['NEW', 'CREATED', 'TURNED_IN', 'RETURNED', 'RECLAIMED_BY_STUDENT']
    });
    
    return response.data.studentSubmissions || [];
  } catch (error) {
    console.error('Error fetching submissions:', error);
    throw new Error('Failed to fetch assignment submissions');
  }
};

/**
 * Check if an assignment is solved (completed) by the current user
 */
const checkAssignmentStatus = async (accessToken, courseId, assignmentId, userId) => {
  try {
    oauth2Client.setCredentials({ access_token: accessToken });
    const classroom = google.classroom({ version: 'v1', auth: oauth2Client });
    
    console.log(`🔍 Checking assignment status for course: ${courseId}, assignment: ${assignmentId}, user: ${userId}`);
    
    const response = await classroom.courses.courseWork.studentSubmissions.list({
      courseId: courseId,
      courseWorkId: assignmentId,
      userId: userId || 'me'  // Use 'me' for current authenticated user
    });
    
    const submissions = response.data.studentSubmissions || [];
    
    if (submissions.length > 0) {
      const submission = submissions[0];
      const state = submission.state;
      
      console.log(`🔍 Assignment ${assignmentId} submission state: ${state}`);
      
      // Check if assignment is "solved" (completed)
      const isSolved = state === 'TURNED_IN' || state === 'RETURNED';
      
      return {
        isSolved: isSolved,
        state: state,
        submissionId: submission.id,
        updateTime: submission.updateTime,
        submissionState: state
      };
    }
    
    console.log(`🔍 No submission found for assignment ${assignmentId}, considering as unsolved`);
    return { 
      isSolved: false, 
      state: 'NEW',
      submissionState: 'NEW'
    };
    
  } catch (error) {
    console.error(`❌ Error checking assignment status for ${assignmentId}:`, error);
    // If we can't check status, assume it's not solved to be safe
    return { 
      isSolved: false, 
      state: 'UNKNOWN',
      submissionState: 'UNKNOWN',
      error: error.message 
    };
  }
};

/**
 * Get user profile information
 */
const getUserProfile = async (accessToken) => {
  try {
    oauth2Client.setCredentials({ access_token: accessToken });
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    
    const response = await oauth2.userinfo.get();
    return response.data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw new Error('Failed to fetch user profile');
  }
};

module.exports = {
  getCourses,
  getCourseAssignments,
  getAllAssignments,
  getAssignmentSubmissions,
  checkAssignmentStatus,
  getUserProfile,
  formatDueDate
};
