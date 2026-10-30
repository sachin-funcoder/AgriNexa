import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import ProtectedRoute from './components/common/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import PriceTrendsPage from './pages/PriceTrendsPage';
import HarvestSplitPage from './pages/HarvestSplitPage';
import CalculatorPage from './pages/CalculatorPage';
import MandiComparePage from './pages/MandiComparePage';
import CommunityPage from './pages/CommunityPage';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import PredictionProtectionPage from './pages/PredictionProtectionPage';
import AdminProtectionPage from './pages/AdminProtectionPage';
import ChatPage from './pages/ChatPage';
import CropAdvisorPage from './pages/CropAdvisorPage';
import ChatbotWidget from './components/chatbot/ChatbotWidget';

function App() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-agri-500 selection:text-white transition-colors duration-200">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Content Router */}
      <main className="flex-1 pb-12">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />

          {/* Protected Routes — Require Authentication */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/price-trends" element={<ProtectedRoute><PriceTrendsPage /></ProtectedRoute>} />
          <Route path="/harvest-split" element={<ProtectedRoute><HarvestSplitPage /></ProtectedRoute>} />
          <Route path="/calculator" element={<ProtectedRoute><CalculatorPage /></ProtectedRoute>} />
          <Route path="/mandi-compare" element={<ProtectedRoute><MandiComparePage /></ProtectedRoute>} />
          <Route path="/community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/subscriptions" element={<ProtectedRoute><SubscriptionsPage /></ProtectedRoute>} />
          <Route path="/prediction-protection" element={<ProtectedRoute><PredictionProtectionPage /></ProtectedRoute>} />
          <Route path="/admin/protection" element={<ProtectedRoute><AdminProtectionPage /></ProtectedRoute>} />
          <Route path="/crop-advisor" element={<ProtectedRoute><CropAdvisorPage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        </Routes>
      </main>

      {/* Global Floating AI Voice Chatbot Widget */}
      <ChatbotWidget isFullPage={false} />

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default App;
