import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';

const GoogleCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the authorization code from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
          console.error('Google OAuth error:', error);
          navigate('/dashboard?error=' + encodeURIComponent(error));
          return;
        }

        if (code) {
          // Exchange code for tokens
          const response = await authService.handleGoogleCallback(code);
          
          if (response.success) {
            // Navigate back to dashboard
            navigate('/dashboard?connected=true');
          } else {
            navigate('/dashboard?error=' + encodeURIComponent('Authentication failed'));
          }
        } else {
          navigate('/dashboard?error=' + encodeURIComponent('No authorization code received'));
        }
        
      } catch (error) {
        console.error('OAuth callback error:', error);
        navigate('/dashboard?error=' + encodeURIComponent(error.response?.data?.error || 'Authentication failed'));
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-lg font-medium text-gray-900 mb-2">Completing Authentication</h2>
        <p className="text-gray-500">Please wait while we connect your Google Classroom account...</p>
      </div>
    </div>
  );
};

export default GoogleCallback;
