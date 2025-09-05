import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700">
      {/* Navigation */}
      <nav className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-white">
                📚 Assignment Solver
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-white">
                <span className="text-sm">Welcome back, {user?.firstName}!</span>
              </div>
              <button 
                onClick={handleSignOut}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          {/* Coming Soon Hero */}
          <div className="mb-12">
            <div className="w-32 h-32 mx-auto mb-8 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-6xl">🚧</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Coming Soon
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              We're working hard to bring you the most advanced AI-powered assignment solving platform. 
              The dashboard will be available soon with amazing features!
            </p>
          </div>

          {/* Features Preview */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📚</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Assignment List</h3>
              <p className="text-blue-100">
                View all your Google Classroom assignments in one place
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🤖</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">AI Solver</h3>
              <p className="text-blue-100">
                Generate detailed solutions using advanced AI models
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📤</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Auto Submit</h3>
              <p className="text-blue-100">
                Automatically submit solutions back to Google Classroom
              </p>
            </div>
          </div>

          {/* Development Progress */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">Development Progress</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">Frontend Design</span>
                <div className="flex items-center">
                  <div className="w-32 bg-white/20 rounded-full h-2 mr-3">
                    <div className="bg-green-500 h-2 rounded-full" style={{width: '100%'}}></div>
                  </div>
                  <span className="text-green-400 font-semibold">100%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">Authentication System</span>
                <div className="flex items-center">
                  <div className="w-32 bg-white/20 rounded-full h-2 mr-3">
                    <div className="bg-yellow-500 h-2 rounded-full" style={{width: '30%'}}></div>
                  </div>
                  <span className="text-yellow-400 font-semibold">30%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">Google Classroom Integration</span>
                <div className="flex items-center">
                  <div className="w-32 bg-white/20 rounded-full h-2 mr-3">
                    <div className="bg-orange-500 h-2 rounded-full" style={{width: '10%'}}></div>
                  </div>
                  <span className="text-orange-400 font-semibold">10%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">AI Integration</span>
                <div className="flex items-center">
                  <div className="w-32 bg-white/20 rounded-full h-2 mr-3">
                    <div className="bg-red-500 h-2 rounded-full" style={{width: '5%'}}></div>
                  </div>
                  <span className="text-red-400 font-semibold">5%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Newsletter Signup */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Get Notified When We Launch</h2>
            <p className="text-blue-100 mb-6">
              Be the first to know when Assignment Solver goes live!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 border border-white/30 rounded-lg bg-white/20 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              />
              <button className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-yellow-500 hover:to-orange-600 transition-all">
                Notify Me
              </button>
            </div>
          </div>

          {/* Back Button */}
          <div className="space-y-4">
            <Link
              to="/"
              className="inline-block bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg font-medium transition-all"
            >
              ← Back to Home
            </Link>
            <div className="text-blue-200 text-sm">
              <p>Expected launch: Q1 2024</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/20 bg-white/5 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-blue-100">
              © 2024 Assignment Solver. Building the future of educational technology.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
