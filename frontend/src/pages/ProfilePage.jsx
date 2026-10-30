import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  User, ShieldCheck, Phone, Mail, MapPin, Globe, Sparkles,
  Calendar, CheckCircle2, Edit3, Save, X, LogOut, ArrowRight,
  ShieldAlert, AlertCircle, FileText
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

const ProfilePage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, logout, refreshUser, isAuthenticated, loading } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  // Edit form state
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    preferred_language: 'en',
    district: 'Kolar',
    preferred_crops: [],
  });

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        preferred_language: user.preferred_language || 'en',
        district: user.district || 'Kolar',
        preferred_crops: user.preferred_crops || [],
      });
    }
  }, [user]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-400">
        Loading farmer profile...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl">
          <User className="w-12 h-12 text-agri-600 dark:text-agri-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Farmer Authentication Required</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Please log in or register to view your personal farmer profile, subscriptions, and AI claims.
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-agri-600 hover:bg-agri-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg"
          >
            <span>Sign In / ಹೊಸ ನೋಂದಣಿ</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg({ text: '', type: '' });
    try {
      await mandiApi.updateProfile(formData);
      if (formData.preferred_language !== i18n.language) {
        i18n.changeLanguage(formData.preferred_language);
      }
      await refreshUser();
      setIsEditing(false);
      setStatusMsg({ text: 'Profile updated successfully!', type: 'success' });
    } catch (err) {
      setStatusMsg({ text: err.message || 'Failed to update profile.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleCrop = (crop) => {
    setFormData((prev) => {
      const exists = prev.preferred_crops.includes(crop);
      const updated = exists
        ? prev.preferred_crops.filter((c) => c !== crop)
        : [...prev.preferred_crops, crop];
      return { ...prev, preferred_crops: updated };
    });
  };

  const getTierBadge = (tier) => {
    switch (tier?.toUpperCase()) {
      case 'PROTECTION':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center space-x-1 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Kisan Raksha + Pro (35% Protection)</span>
          </span>
        );
      case 'PRO':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-400 border border-blue-300 dark:border-blue-800 shadow-sm">
            Kisan Pro (Analytical Tools)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm">
            Kisan Basic (Free)
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-white via-slate-50 to-emerald-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-agri-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-agri-600/20 border border-emerald-300 dark:border-agri-500/40 flex items-center justify-center text-emerald-800 dark:text-agri-400 font-extrabold text-2xl shadow-sm">
              {user.full_name?.charAt(0) || 'F'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{user.full_name}</h1>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm">
                  {user.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                <span>ID: {user.id}</span>
                <span>•</span>
                <span>Member since {user.created_at?.slice(0, 10)}</span>
              </p>
              <div className="mt-2">{getTierBadge(user.active_subscription_plan)}</div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors flex items-center space-x-1.5 shadow-sm"
            >
              {isEditing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
              <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
            </button>
            <button
              onClick={logout}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 transition-colors flex items-center space-x-1.5 shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {statusMsg.text && (
        <div
          className={`mb-6 p-4 rounded-xl border text-xs flex items-center space-x-2 shadow-sm ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-agri-950/60 border-emerald-300 dark:border-agri-800 text-emerald-800 dark:text-agri-300'
              : 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-agri-400" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile Details / Form */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
            <User className="w-4 h-4 text-emerald-600 dark:text-agri-400" />
            <span>Farmer Credentials & Preferences</span>
          </h2>

          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name / ಪೂರ್ಣ ಹೆಸರು
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mobile Number (Immutable)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user.mobile}
                    className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    District / ಜಿಲ್ಲೆ
                  </label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 shadow-sm"
                  >
                    {KARNATAKA_DISTRICTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Preferred Language / ಭಾಷೆ
                  </label>
                  <select
                    value={formData.preferred_language}
                    onChange={(e) => setFormData({ ...formData, preferred_language: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 shadow-sm"
                  >
                    <option value="en">English</option>
                    <option value="kn">ಕನ್ನಡ (Kannada)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Crops / ಬೆಳೆಗಳು
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_CROPS.map((crop) => {
                    const isSelected = formData.preferred_crops.includes(crop);
                    return (
                      <button
                        key={crop}
                        type="button"
                        onClick={() => toggleCrop(crop)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shadow-sm ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-agri-950 text-emerald-800 dark:text-agri-300 border-emerald-400 dark:border-agri-600'
                            : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {crop} {isSelected && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Mobile Phone</span>
                  <div className="flex items-center space-x-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-agri-400" />
                    <span>+91 {user.mobile}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Email Address</span>
                  <div className="flex items-center space-x-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <Mail className="w-3.5 h-3.5 text-emerald-600 dark:text-agri-400" />
                    <span>{user.email || 'Not provided'}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">APMC District</span>
                  <div className="flex items-center space-x-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-agri-400" />
                    <span>{user.district || 'Karnataka'}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Language Preference</span>
                  <div className="flex items-center space-x-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-agri-400" />
                    <span>{user.preferred_language === 'kn' ? 'ಕನ್ನಡ (Kannada)' : 'English'}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1.5">Tracked Primary Crops</span>
                <div className="flex flex-wrap gap-1.5">
                  {user.preferred_crops?.length > 0 ? (
                    user.preferred_crops.map((c) => (
                      <span
                        key={c}
                        className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-agri-950 text-emerald-800 dark:text-agri-300 border border-emerald-300 dark:border-agri-800 shadow-sm"
                      >
                        {c}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">None selected</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Privacy & Isolation Notice */}
          <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1 shadow-sm">
            <div className="flex items-center space-x-1.5 text-slate-900 dark:text-slate-300 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-agri-400" />
              <span>Data Isolation & Privacy Protection</span>
            </div>
            <p>
              Your personal sales data, profit calculations, and loss claims are strictly private.
              AgriNexa enforces tenant isolation preventing any other farmer or trader from accessing your records.
            </p>
          </div>
        </div>

        {/* Right Column: Module Quick Navigation & Subscription Summary */}
        <div className="space-y-4">
          {/* Subscription Action Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center justify-between">
              <span>Subscription Tier</span>
              <span className="text-xs font-normal text-emerald-600 dark:text-agri-400">Active</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Current Plan: <strong className="text-slate-900 dark:text-white">{user.active_subscription_plan}</strong>
            </p>
            <Link
              to="/subscriptions"
              className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center space-x-1.5 transition-colors shadow-sm"
            >
              <span>Manage / Upgrade Plan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* AI Prediction Protection Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center space-x-2 text-amber-500 dark:text-amber-400 mb-2">
              <Sparkles className="w-4 h-4" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">AI Prediction Protection</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              File or review verified loss claims against adverse mandi price crashes below AI targets.
            </p>
            <Link
              to="/prediction-protection"
              className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center justify-center space-x-1.5 transition-colors shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Open Protection Portal</span>
            </Link>
          </div>

          {/* Reviewer / Admin Console (Conditional) */}
          {(user.role === 'admin' || user.role === 'reviewer') && (
            <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-purple-900 dark:text-purple-300 mb-1 flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>APMC Reviewer Console</span>
              </h3>
              <p className="text-xs text-purple-800/70 dark:text-purple-300/70 mb-3">
                Review farmer claims, verify gate slips, and approve simulated 35% compensation.
              </p>
              <Link
                to="/admin/protection"
                className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center space-x-1.5 transition-colors shadow-sm"
              >
                <span>Launch Reviewer Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;

