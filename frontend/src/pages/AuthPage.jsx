import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  User, Lock, Phone, Mail, Globe, MapPin, Sparkles, CheckCircle2,
  AlertCircle, ShieldCheck, ArrowRight, KeyRound, HelpCircle, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import mandiApi from '../services/mandiApi';

const KARNATAKA_DISTRICTS = [
  'Kolar', 'Bengaluru Urban', 'Bengaluru Rural', 'Mandya',
  'Mysuru', 'Belagavi', 'Chikkaballapura', 'Tumakuru',
  'Hassan', 'Davanagere', 'Shimoga', 'Hubballi-Dharwad'
];

const AVAILABLE_CROPS = [
  'Tomato', 'Onion', 'Potato', 'Capsicum', 'Green Chilli',
  'Maize', 'Paddy', 'Ginger', 'Garlic', 'Carrot'
];

const AuthPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup, loginAsDemoFarmer, loginAsDemoAdmin, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'signup'
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Login form state
  const [loginForm, setLoginForm] = useState({
    identifier: '',
    password: '',
    rememberMe: true,
  });

  // Signup form state
  const [signupForm, setSignupForm] = useState({
    fullName: '',
    mobile: '',
    email: '',
    password: '',
    confirmPassword: '',
    preferredLanguage: i18n.language.startsWith('kn') ? 'kn' : 'en',
    district: 'Kolar',
    preferredCrops: ['Tomato', 'Onion'],
  });

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotResponse, setForgotResponse] = useState(null);

  // If already authenticated, redirect to requested page or dashboard
  if (isAuthenticated && !isSubmitting) {
    const from = location.state?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);
    try {
      await login(loginForm.identifier, loginForm.password, loginForm.rememberMe);
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (signupForm.password !== signupForm.confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signup({
        full_name: signupForm.fullName,
        mobile: signupForm.mobile,
        email: signupForm.email || undefined,
        password: signupForm.password,
        confirm_password: signupForm.confirmPassword,
        preferred_language: signupForm.preferredLanguage,
        district: signupForm.district,
        preferred_crops: signupForm.preferredCrops,
      });
      // Update i18n if user selected Kannada
      if (signupForm.preferredLanguage !== i18n.language) {
        i18n.changeLanguage(signupForm.preferredLanguage);
      }
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed. Please check details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoLogin = async (type) => {
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      if (type === 'farmer') {
        await loginAsDemoFarmer();
      } else {
        await loginAsDemoAdmin();
      }
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      setErrorMsg(err.message || 'Quick demo login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await mandiApi.forgotPassword({ identifier: forgotIdentifier });
      setForgotResponse(res);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to request reset instructions.');
    }
  };

  const toggleCrop = (crop) => {
    setSignupForm((prev) => {
      const exists = prev.preferredCrops.includes(crop);
      const updated = exists
        ? prev.preferredCrops.filter((c) => c !== crop)
        : [...prev.preferredCrops, crop];
      return { ...prev, preferredCrops: updated };
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Banner & Demo Mode Disclaimer */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold uppercase tracking-wider mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>AgriNexa Farmer Identity & Access</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {activeTab === 'login' ? 'Welcome Back to AgriNexa' : 'Join AgriNexa Karnataka'}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
          {activeTab === 'login'
            ? 'Access your mandi intelligence, AI forecasts, harvest split plans, and prediction protection.'
            : 'Register to unlock personalized APMC mandi analytics, smart optimization, and compensation protection.'}
        </p>

        {/* Quick Demo Access Bar */}
        <div className="mt-6 p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-2xl mx-auto shadow-md">
          <div className="text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Simulated Demo Credentials
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Click to instantly sign in with pre-configured accounts:
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('farmer')}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center space-x-1 shadow-sm"
            >
              <span>Demo Farmer</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('admin')}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors flex items-center space-x-1 shadow-sm"
            >
              <span>APMC Reviewer / Admin</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Tab Header */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 py-3.5 text-sm font-semibold text-center transition-colors border-b-2 ${
              activeTab === 'login'
                ? 'border-emerald-600 text-emerald-700 dark:border-agri-500 dark:text-agri-400 bg-white dark:bg-slate-900/50'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Sign In / ಲಾಗಿನ್
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('signup'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 py-3.5 text-sm font-semibold text-center transition-colors border-b-2 ${
              activeTab === 'signup'
                ? 'border-emerald-600 text-emerald-700 dark:border-agri-500 dark:text-agri-400 bg-white dark:bg-slate-900/50'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Farmer Sign Up / ಹೊಸ ನೋಂದಣಿ
          </button>
        </div>

        {/* Error / Success Alerts */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-agri-950/50 border border-agri-800 text-agri-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-agri-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* SIGN IN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mobile Number or Email / ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಅಥವಾ ಇಮೇಲ್
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9876543210 or farmer@agrinexa.in"
                    value={loginForm.identifier}
                    onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-agri-500 focus:ring-1 focus:ring-agri-500 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Password / ಗುಪ್ತಪದ
                  </label>
                  <button
                    type="button"
                    onClick={() => { setShowForgotModal(true); setForgotResponse(null); }}
                    className="text-xs text-emerald-600 dark:text-agri-400 hover:underline transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-agri-500 focus:ring-1 focus:ring-agri-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={loginForm.rememberMe}
                  onChange={(e) => setLoginForm({ ...loginForm, rememberMe: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 rounded focus:ring-agri-500"
                />
                <label htmlFor="rememberMe" className="ml-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  Remember me for 30 days
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors shadow-md flex items-center justify-center space-x-2"
              >
                <span>{isSubmitting ? 'Authenticating...' : 'Sign In to AgriNexa'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* SIGN UP FORM */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Legal or Farmer Name / ಪೂರ್ಣ ಹೆಸರು
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={signupForm.fullName}
                  onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mobile Number (10 digits) / ಮೊಬೈಲ್
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={signupForm.mobile}
                    onChange={(e) => setSignupForm({ ...signupForm, mobile: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="farmer@example.com"
                    value={signupForm.email}
                    onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Password / ಗುಪ್ತಪದ
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Min 6 characters"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm Password / ದೃಢೀಕರಿಸಿ
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Repeat password"
                    value={signupForm.confirmPassword}
                    onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    District / ಜಿಲ್ಲೆ
                  </label>
                  <select
                    value={signupForm.district}
                    onChange={(e) => setSignupForm({ ...signupForm, district: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
                  >
                    {KARNATAKA_DISTRICTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Language / ಭಾಷೆ
                  </label>
                  <select
                    value={signupForm.preferredLanguage}
                    onChange={(e) => setSignupForm({ ...signupForm, preferredLanguage: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
                  >
                    <option value="en">English</option>
                    <option value="kn">ಕನ್ನಡ (Kannada)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Crops / ಮುಖ್ಯ ಬೆಳೆಗಳು
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_CROPS.map((crop) => {
                    const isSelected = signupForm.preferredCrops.includes(crop);
                    return (
                      <button
                        key={crop}
                        type="button"
                        onClick={() => toggleCrop(crop)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-600 shadow-sm font-semibold'
                            : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
                        }`}
                      >
                        {crop} {isSelected && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors shadow-md flex items-center justify-center space-x-2"
                >
                  <span>{isSubmitting ? 'Creating Account...' : 'Complete Farmer Registration'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-agri-400 mb-3">
              <KeyRound className="w-5 h-5" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Password Recovery / ಗುಪ್ತಪದ ಮರುಪಡೆಯಿರಿ</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Enter your registered mobile or email to receive demo password reset instructions.
            </p>
            {forgotResponse ? (
              <div className="p-3 bg-emerald-50 dark:bg-agri-950/60 border border-emerald-300 dark:border-agri-800 rounded-lg text-xs text-emerald-800 dark:text-agri-300 space-y-2">
                <p className="font-semibold">{forgotResponse.message}</p>
                <p className="text-slate-600 dark:text-slate-400">{forgotResponse.demo_note}</p>
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="w-full mt-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <input
                  type="text"
                  required
                  placeholder="Mobile or email address"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-sm focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
                >
                  Send Reset Link
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthPage;

