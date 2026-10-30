import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  CloudSun,
  Sprout,
  Calendar,
  Layers,
  Droplets,
  Thermometer,
  Wind,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  MapPin,
  RefreshCw,
  Info,
  ChevronRight,
  Sparkles,
  Compass,
  FileText,
  Save,
  Check,
  Server
} from 'lucide-react';
import mandiApi from '../services/mandiApi';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

const PRESET_TEMPLATES = [
  {
    id: 'kolar_red',
    label_en: 'Kolar Red Soil (Dryland / Rainfed)',
    label_kn: 'ಕೋಲಾರ ಕೆಂಪು ಮಣ್ಣು (ಮಳೆಯಾಶ್ರಿತ)',
    profile: {
      farm_name: 'Kolar Dryland Parcel',
      state: 'Karnataka',
      district: 'Kolar',
      taluk: 'Srinivaspur',
      village: 'Rayalpadu',
      total_area: 3.0,
      area_unit: 'acres',
      land_type: 'Dryland',
      soil_type: 'Red soil',
      soil_ph: 6.2,
      electrical_conductivity: 0.4,
      nitrogen_level: 'Low',
      phosphorus_level: 'Medium',
      potassium_level: 'High',
      organic_carbon: 0.45,
      drainage_capacity: 'Good',
      water_source: 'Rainfed only',
      water_availability: 'low',
      preferred_categories: ['Cereal / Millet', 'Pulse'],
      preferred_duration: 'Medium (90-130 days)',
      crop_purpose: 'mixed',
      risk_preference: 'balanced',
      budget_inr: 45000,
      preferred_sowing_season: 'Kharif'
    }
  },
  {
    id: 'mandya_alluvial',
    label_en: 'Mandya Alluvial (Canal Irrigated)',
    label_kn: 'ಮಂಡ್ಯ ಮೆಕ್ಕಲು ಮಣ್ಣು (ಕಾಲುವೆ ನೀರಾವರಿ)',
    profile: {
      farm_name: 'Cauvery Basin Parcel',
      state: 'Karnataka',
      district: 'Mandya',
      taluk: 'Maddur',
      village: 'Koppa',
      total_area: 4.5,
      area_unit: 'acres',
      land_type: 'Irrigated land',
      soil_type: 'Alluvial soil',
      soil_ph: 6.8,
      electrical_conductivity: 0.6,
      nitrogen_level: 'Medium',
      phosphorus_level: 'High',
      potassium_level: 'Medium',
      organic_carbon: 0.65,
      drainage_capacity: 'Good',
      water_source: 'Canal irrigation',
      water_availability: 'high',
      preferred_categories: ['Vegetable', 'Cereal / Grain'],
      preferred_duration: 'Short (<90 days)',
      crop_purpose: 'commercial',
      risk_preference: 'growth',
      budget_inr: 85000,
      preferred_sowing_season: 'Kharif'
    }
  },
  {
    id: 'dharwad_black',
    label_en: 'Dharwad Black Soil (Borewell / Semi-Arid)',
    label_kn: 'ಧಾರವಾಡ ಕಪ್ಪು ಮಣ್ಣು (ಬೋರ್‌ವೆಲ್)',
    profile: {
      farm_name: 'Malaprabha Basin Parcel',
      state: 'Karnataka',
      district: 'Dharwad',
      taluk: 'Hubballi Rural',
      village: 'Chabbi',
      total_area: 5.0,
      area_unit: 'acres',
      land_type: 'Mixed farming land',
      soil_type: 'Black soil',
      soil_ph: 7.6,
      electrical_conductivity: 0.8,
      nitrogen_level: 'Medium',
      phosphorus_level: 'Medium',
      potassium_level: 'High',
      organic_carbon: 0.55,
      drainage_capacity: 'Moderate',
      water_source: 'Borewell',
      water_availability: 'medium',
      preferred_categories: ['Pulse', 'Oilseed', 'Cereal / Grain'],
      preferred_duration: 'Medium (90-130 days)',
      crop_purpose: 'commercial',
      risk_preference: 'balanced',
      budget_inr: 60000,
      preferred_sowing_season: 'Kharif'
    }
  }
];

const KARNATAKA_DISTRICTS = [
  'Kolar', 'Bengaluru', 'Bengaluru Rural', 'Mandya', 'Hassan',
  'Davanagere', 'Belagavi', 'Dharwad', 'Chikkaballapura', 'Tumakuru',
  'Chitradurga', 'Raichur', 'Kalaburagi', 'Shivamogga'
];

export default function CropAdvisorPage() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || 'en';
  const { user, isAuthenticated } = useAuth();

  // Navigation tab
  const [activeTab, setActiveTab] = useState('recommendations'); // default to recommendations tab so user sees immediate results

  // Form State
  const [formData, setFormData] = useState({ ...PRESET_TEMPLATES[0].profile });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);
  const [loadingClimate, setLoadingClimate] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [backendOnline, setBackendOnline] = useState(true);

  // Climate data
  const [climateSummary, setClimateSummary] = useState(null);

  // Recommendations data
  const [recommendationResult, setRecommendationResult] = useState(null);
  const [selectedCropForCalendar, setSelectedCropForCalendar] = useState(null);

  // Fetch climate summary when district or season changes
  const fetchClimateData = async (district, season) => {
    setLoadingClimate(true);
    try {
      const summary = await mandiApi.getClimateSummary(district, season);
      setClimateSummary(summary);
      setBackendOnline(true);
    } catch (err) {
      console.error('Failed to load climate data:', err);
      setBackendOnline(false);
    } finally {
      setLoadingClimate(false);
    }
  };

  // Initial load: check if authenticated user has saved profile, else use preset
  useEffect(() => {
    const initPage = async () => {
      // 1. Health check to clear any stale error
      try {
        await apiClient.get('/health');
        setBackendOnline(true);
        setErrorMsg(null);
      } catch (err) {
        setBackendOnline(false);
      }

      let initialProfile = { ...PRESET_TEMPLATES[0].profile };
      if (isAuthenticated) {
        try {
          const myProfile = await mandiApi.getMyLandProfile();
          if (myProfile) {
            initialProfile = { ...myProfile };
            setFormData(initialProfile);
          }
        } catch (e) {
          // ignore 404
        }
      }
      fetchClimateData(initialProfile.district, initialProfile.preferred_sowing_season);
      handleGenerateRecommendations(initialProfile, false);
    };
    initPage();
  }, [isAuthenticated]);

  // Handle Preset selection with immediate live update
  const handleSelectPreset = (preset) => {
    const newProfile = { ...preset.profile };
    setFormData(newProfile);
    fetchClimateData(newProfile.district, newProfile.preferred_sowing_season);
    handleGenerateRecommendations(newProfile, false);
  };

  // Save Land Profile to backend
  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setSaveSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await mandiApi.saveLandProfile({
        ...formData,
        total_area: parseFloat(formData.total_area) || 2.0,
        soil_ph: formData.soil_ph ? parseFloat(formData.soil_ph) : null,
        electrical_conductivity: formData.electrical_conductivity ? parseFloat(formData.electrical_conductivity) : null,
        organic_carbon: formData.organic_carbon ? parseFloat(formData.organic_carbon) : null,
        budget_inr: formData.budget_inr ? parseFloat(formData.budget_inr) : null,
      });
      setSaveSuccessMsg(
        currentLang === 'kn'
          ? `ಜಮೀನಿನ ವಿವರಗಳನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಉಳಿಸಲಾಗಿದೆ (ID: ${res.id})`
          : `Land Profile saved successfully to database (ID: ${res.id})`
      );
      setBackendOnline(true);
      // Re-run recommendations with the saved profile
      handleGenerateRecommendations(formData, false);
    } catch (err) {
      console.error('Failed to save land profile:', err);
      setErrorMsg(err.response?.data?.detail || 'Failed to save land profile to backend.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Run Recommendation Solver
  const handleGenerateRecommendations = async (profilePayload = formData, switchTab = true) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const req = {
        inline_profile: {
          ...profilePayload,
          total_area: parseFloat(profilePayload.total_area) || 2.0,
          soil_ph: profilePayload.soil_ph ? parseFloat(profilePayload.soil_ph) : null,
          electrical_conductivity: profilePayload.electrical_conductivity ? parseFloat(profilePayload.electrical_conductivity) : null,
          organic_carbon: profilePayload.organic_carbon ? parseFloat(profilePayload.organic_carbon) : null,
          budget_inr: profilePayload.budget_inr ? parseFloat(profilePayload.budget_inr) : null,
        },
        season: profilePayload.preferred_sowing_season || 'Kharif'
      };

      const res = await mandiApi.generateCropRecommendations(req);
      setRecommendationResult(res);
      setBackendOnline(true);
      if (res.top_recommendation) {
        setSelectedCropForCalendar(res.top_recommendation);
      }
      if (switchTab) {
        setActiveTab('recommendations');
      }
    } catch (err) {
      console.error('Failed to generate crop recommendations:', err);
      setErrorMsg(err.response?.data?.detail || 'Failed to connect to recommendation backend. Please verify FastAPI is running.');
      setBackendOnline(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* Page Header */}
      <div className="bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/80 dark:from-emerald-950 dark:via-slate-900 dark:to-teal-950 border border-emerald-100/90 dark:border-emerald-800/50 rounded-2xl shadow-sm dark:shadow-xl p-6 sm:p-8 text-slate-900 dark:text-white relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                UAS Bangalore & IMD Powered
              </span>
              
              {/* Live Backend Status Badge */}
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                backendOnline 
                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40' 
                  : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/40'
              }`}>
                <span className={`w-2 h-2 rounded-full mr-1.5 ${backendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {backendOnline ? 'Backend Online (Port 8000)' : 'Backend Offline'}
              </span>

              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-400/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-400/30">
                FastAPI v1
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <CloudSun className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              {t('cropAdvisor.title')}
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300 text-xs sm:text-sm max-w-3xl leading-relaxed">
              {t('cropAdvisor.subtitle')}
            </p>
          </div>

          {/* Quick Controls: Global District & Season Picker */}
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0 shadow-sm">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-medium">District</span>
              <select
                value={formData.district}
                onChange={(e) => {
                  const newDist = e.target.value;
                  const updated = { ...formData, district: newDist };
                  setFormData(updated);
                  fetchClimateData(newDist, formData.preferred_sowing_season);
                  handleGenerateRecommendations(updated, false);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 shadow-sm"
              >
                {KARNATAKA_DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-medium">Season</span>
              <select
                value={formData.preferred_sowing_season}
                onChange={(e) => {
                  const newSeas = e.target.value;
                  const updated = { ...formData, preferred_sowing_season: newSeas };
                  setFormData(updated);
                  fetchClimateData(formData.district, newSeas);
                  handleGenerateRecommendations(updated, false);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 shadow-sm"
              >
                <option value="Kharif">Kharif</option>
                <option value="Rabi">Rabi</option>
                <option value="Summer">Summer</option>
              </select>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-8 flex flex-wrap gap-2 border-t border-slate-200 dark:border-slate-800 pt-4">
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'recommendations'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/20'
                : 'bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm'
            }`}
          >
            <Sprout className="w-4 h-4" />
            {t('cropAdvisor.tabs.recommendations')}
            {recommendationResult && (
              <span className="ml-1.5 px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full border border-emerald-300 dark:border-emerald-800">
                {recommendationResult.recommendations?.length || 0}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('climate')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'climate'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/20'
                : 'bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm'
            }`}
          >
            <CloudSun className="w-4 h-4" />
            {t('cropAdvisor.tabs.climate_intelligence')}
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'profile'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/20'
                : 'bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm'
            }`}
          >
            <Layers className="w-4 h-4" />
            {t('cropAdvisor.tabs.land_profile')}
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'calendar'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/20'
                : 'bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm'
            }`}
          >
            <Calendar className="w-4 h-4" />
            {t('cropAdvisor.tabs.calendar')}
          </button>
        </div>
      </div>

      {/* Status Notifications */}
      {saveSuccessMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl p-4 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-white font-bold text-xs">Dismiss</button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 rounded-xl p-4 text-rose-800 dark:text-rose-300 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <p className="font-medium">{errorMsg}</p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => {
                setErrorMsg(null);
                handleGenerateRecommendations(formData, false);
                fetchClimateData(formData.district, formData.preferred_sowing_season);
              }}
              className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/60 dark:hover:bg-rose-800 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Connection
            </button>
            <button
              onClick={() => setErrorMsg(null)}
              className="px-2 py-1 text-rose-600 hover:text-rose-900 dark:text-rose-400 dark:hover:text-white text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: SMART CROP RECOMMENDATIONS */}
      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          {!recommendationResult ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Running multi-criteria agronomic decision solver...
              </p>
            </div>
          ) : (
            <>
              {/* Water Advisory Summary Banner */}
              <div className="bg-emerald-50/80 dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-900/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5">
                    <Droplets className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      Water & Irrigation Advisory
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 font-normal">
                        {recommendationResult.district} • {recommendationResult.season}
                      </span>
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1">
                      {currentLang === 'kn' ? recommendationResult.water_advisory_summary_kn : recommendationResult.water_advisory_summary_en}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-3 py-1.5 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold shadow-sm">
                    Input Confidence: {recommendationResult.top_recommendation?.scores?.confidence_score}%
                  </span>
                </div>
              </div>

              {/* Ranked Crop Cards Grid */}
              <div className="space-y-4">
                {recommendationResult.recommendations?.map((item) => {
                  const isTop = item.rank === 1;
                  return (
                    <div
                      key={item.crop_id}
                      className={`bg-white dark:bg-slate-900/90 rounded-2xl border transition-all p-5 sm:p-6 shadow-sm ${
                        isTop
                          ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">

                        {/* Left: Rank, Name, Category */}
                        <div className="flex items-start gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                            isTop ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                          }`}>
                            #{item.rank}
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {currentLang === 'kn' ? item.crop_name_kn : item.crop_name_en}
                              </h3>
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                                ({currentLang === 'kn' ? item.crop_name_en : item.crop_name_kn})
                              </span>
                              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {item.category}
                              </span>
                              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                                item.suitability_tier === 'Best Match'
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                                  : 'bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700'
                              }`}>
                                {item.suitability_tier}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                              <span>Duration: <strong className="text-slate-800 dark:text-slate-200">{item.estimated_duration_days}</strong></span>
                              <span>•</span>
                              <span>Water Demand: <strong className="text-slate-800 dark:text-slate-200">{item.water_requirement_category}</strong></span>
                              <span>•</span>
                              <span>Sowing: <strong className="text-slate-800 dark:text-slate-200">{item.sowing_period}</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Overall Suitability Score & Price */}
                        <div className="flex items-center gap-6 shrink-0">
                          {item.current_mandi_modal_price && (
                            <div className="text-right">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Karnataka APMC Modal</span>
                              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                ₹{item.current_mandi_modal_price.toLocaleString('en-IN')} / qtl
                              </span>
                            </div>
                          )}

                          <div className="text-right">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{t('cropAdvisor.recommendations.overall_suitability')}</span>
                            <div className="flex items-baseline justify-end gap-1">
                              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                {item.scores?.overall_suitability_score}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sub-Scores Breakdown Progress Bars */}
                      <div className="py-4 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                          {t('cropAdvisor.recommendations.scores_breakdown')}
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <div className="flex justify-between text-slate-700 dark:text-slate-300 mb-1">
                              <span>Soil (25%)</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">{item.scores?.soil_score}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${item.scores?.soil_score || 0}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-slate-700 dark:text-slate-300 mb-1">
                              <span>Climate (25%)</span>
                              <span className="font-bold text-teal-600 dark:text-teal-400">{item.scores?.climate_score}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${item.scores?.climate_score || 0}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-slate-700 dark:text-slate-300 mb-1">
                              <span>Water (20%)</span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">{item.scores?.water_score}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${item.scores?.water_score || 0}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-slate-700 dark:text-slate-300 mb-1">
                              <span>Season (15%)</span>
                              <span className="font-bold text-amber-600 dark:text-amber-400">{item.scores?.season_score}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${item.scores?.season_score || 0}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Reasons, Risks, Amendments */}
                      <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        {/* Why Recommended */}
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
                          <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 mb-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            {t('cropAdvisor.recommendations.why_recommended')}
                          </span>
                          <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                            {(currentLang === 'kn' ? item.why_recommended_kn : item.why_recommended_en)?.map((reason, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Identified Risks & Mitigations */}
                        <div className="bg-amber-50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/40">
                          <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            {t('cropAdvisor.recommendations.risks_identified')}
                          </span>
                          <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                            {(currentLang === 'kn' ? item.identified_risks_kn : item.identified_risks_en)?.map((risk, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
                                <span>{risk}</span>
                              </li>
                            ))}
                          </ul>
                          {item.soil_amendment_advice && (
                            <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-200">
                              <strong className="text-amber-900 dark:text-amber-300">Soil Amendment:</strong> {item.soil_amendment_advice}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Calendar CTA */}
                      <div className="mt-4 pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 text-xs">
                        <span className="text-slate-500 dark:text-slate-400">
                          Confidence: <strong className="text-slate-800 dark:text-slate-200">{item.scores?.confidence_score}%</strong> (Evaluated against UAS Bangalore Package of Practices)
                        </span>
                        <button
                          onClick={() => {
                            setSelectedCropForCalendar(item);
                            setActiveTab('calendar');
                          }}
                          className="inline-flex items-center text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-semibold"
                        >
                          {t('cropAdvisor.recommendations.view_calendar_btn')}
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: CLIMATE INTELLIGENCE */}
      {activeTab === 'climate' && (
        <div className="space-y-6">
          {loadingClimate ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-600 dark:text-slate-400">Loading regional climate models for {formData.district}...</p>
            </div>
          ) : climateSummary ? (
            <>
              {/* 1. 7-Day Short-Range Weather Forecast */}
              <div className="bg-white dark:bg-slate-900/90 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <CloudSun className="w-5 h-5 text-amber-500" />
                      {t('cropAdvisor.climate.forecast_heading')} ({climateSummary.district})
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {climateSummary.short_range_forecast.summary_advisory}
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-full border border-amber-300 dark:border-amber-800 font-medium self-start sm:self-center">
                    IMD 7-Day Model
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
                  {climateSummary.short_range_forecast.forecast_points.map((pt, i) => (
                    <div
                      key={i}
                      className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-slate-700/60 flex flex-col items-center text-center space-y-1.5"
                    >
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {new Date(pt.date).toLocaleDateString(currentLang === 'kn' ? 'kn-IN' : 'en-IN', { weekday: 'short', month: 'numeric', day: 'numeric' })}
                      </span>
                      <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {pt.condition}
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        {pt.max_temp_c}° / <span className="text-slate-500 dark:text-slate-400">{pt.min_temp_c}°C</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400">
                        <Droplets className="w-3 h-3" />
                        {pt.rainfall_mm} mm
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        pt.heat_stress_risk === 'High' ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        Heat: {pt.heat_stress_risk}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Seasonal Climate Outlook & 3. 30-Year Climatological Baseline */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Seasonal Outlook */}
                <div className="bg-white dark:bg-slate-900/90 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Compass className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      {t('cropAdvisor.climate.seasonal_heading')} ({climateSummary.seasonal_outlook.season_name})
                    </h3>
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                      {climateSummary.seasonal_outlook.outlook_period}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400 block text-xs">{t('cropAdvisor.climate.expected_rain')}</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {climateSummary.seasonal_outlook.expected_seasonal_rainfall_mm} mm
                      </span>
                      <span className={`text-xs block mt-0.5 font-medium ${
                        climateSummary.seasonal_outlook.rainfall_anomaly_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {climateSummary.seasonal_outlook.rainfall_anomaly_pct > 0 ? '+' : ''}
                        {climateSummary.seasonal_outlook.rainfall_anomaly_pct}% anomaly
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400 block text-xs">{t('cropAdvisor.climate.drought_risk')}</span>
                      <span className={`text-base font-bold ${
                        climateSummary.seasonal_outlook.drought_risk_level === 'Elevated' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {climateSummary.seasonal_outlook.drought_risk_level} Risk
                      </span>
                      <span className="text-xs block text-slate-500 dark:text-slate-400 mt-0.5">
                        Monsoon: {climateSummary.seasonal_outlook.monsoon_onset_forecast}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-teal-50 dark:bg-teal-950/40 rounded-xl border border-teal-200 dark:border-teal-800/60 text-xs sm:text-sm text-teal-900 dark:text-teal-200">
                    <span className="font-semibold block mb-1 text-teal-800 dark:text-teal-300">{t('cropAdvisor.climate.advisory')}:</span>
                    {currentLang === 'kn'
                      ? climateSummary.seasonal_outlook.agronomic_advice_kn
                      : climateSummary.seasonal_outlook.agronomic_advice_en}
                  </div>
                </div>

                {/* 30-Year Historical Baseline */}
                <div className="bg-white dark:bg-slate-900/90 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      {t('cropAdvisor.climate.historical_heading')}
                    </h3>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      IMD 1991-2020 Normals
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold text-slate-900 dark:text-white mb-1">
                      {climateSummary.historical_baseline.agro_climatic_zone}
                    </div>
                    Annual Mean Rainfall: <strong className="text-emerald-600 dark:text-emerald-400">{climateSummary.historical_baseline.average_annual_rainfall_mm} mm</strong>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Kharif Mean</span>
                      <span className="font-bold text-slate-900 dark:text-white">{climateSummary.historical_baseline.kharif_rainfall_mm} mm</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Rabi Mean</span>
                      <span className="font-bold text-slate-900 dark:text-white">{climateSummary.historical_baseline.rabi_rainfall_mm} mm</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Summer Mean</span>
                      <span className="font-bold text-slate-900 dark:text-white">{climateSummary.historical_baseline.summer_rainfall_mm} mm</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                    {t('cropAdvisor.climate.demo_disclaimer')}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* TAB 3: LAND & SOIL PROFILE FORM */}
      {activeTab === 'profile' && (
        <div className="bg-white dark:bg-slate-900/90 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              {t('cropAdvisor.land_profile.title')}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              {t('cropAdvisor.land_profile.desc')}
            </p>
          </div>

          {/* Quick Presets */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
              {t('cropAdvisor.land_profile.presets_label')}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PRESET_TEMPLATES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`text-left p-3 rounded-xl border transition-all text-xs sm:text-sm font-medium ${
                    formData.district === p.profile.district && formData.soil_type === p.profile.soil_type
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500 shadow-sm'
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-white">{currentLang === 'kn' ? p.label_kn : p.label_en}</div>
                  <div className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                    {p.profile.district} • {p.profile.total_area} {p.profile.area_unit} • {p.profile.water_source}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerateRecommendations();
            }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

              {/* Farm Name */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('cropAdvisor.land_profile.farm_name')}
                </label>
                <input
                  type="text"
                  value={formData.farm_name || ''}
                  onChange={(e) => setFormData({ ...formData, farm_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 shadow-sm"
                  placeholder="e.g. My North Farm"
                />
              </div>

              {/* District */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('cropAdvisor.land_profile.district')} *
                </label>
                <select
                  value={formData.district}
                  onChange={(e) => {
                    const newDist = e.target.value;
                    setFormData({ ...formData, district: newDist });
                    fetchClimateData(newDist, formData.preferred_sowing_season);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 shadow-sm"
                >
                  {KARNATAKA_DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Land Area */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('cropAdvisor.land_profile.total_area')} *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={formData.total_area || ''}
                    onChange={(e) => setFormData({ ...formData, total_area: e.target.value })}
                    className="w-2/3 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 shadow-sm"
                    required
                  />
                  <select
                    value={formData.area_unit || 'acres'}
                    onChange={(e) => setFormData({ ...formData, area_unit: e.target.value })}
                    className="w-1/3 px-2 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 shadow-sm"
                  >
                    <option value="acres">Acres</option>
                    <option value="hectares">Hectares</option>
                    <option value="guntas">Guntas</option>
                  </select>
                </div>
              </div>

              {/* Land Type */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('cropAdvisor.land_profile.land_type')} *
                </label>
                <select
                  value={formData.land_type}
                  onChange={(e) => setFormData({ ...formData, land_type: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 shadow-sm"
                >
                  <option value="Dryland">Dryland</option>
                  <option value="Rainfed land">Rainfed land</option>
                  <option value="Irrigated land">Irrigated land</option>
                  <option value="Wetland">Wetland</option>
                  <option value="Mixed farming land">Mixed farming land</option>
                </select>
              </div>

              {/* Soil Type */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('cropAdvisor.land_profile.soil_type')} *
                </label>
                <select
                  value={formData.soil_type}
                  onChange={(e) => setFormData({ ...formData, soil_type: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 shadow-sm"
                >
                  <option value="Red soil">Red soil</option>
                  <option value="Black soil">Black soil</option>
                  <option value="Alluvial soil">Alluvial soil</option>
                  <option value="Laterite soil">Laterite soil</option>
                  <option value="Loamy soil">Loamy soil</option>
                  <option value="Sandy soil">Sandy soil</option>
                  <option value="Clay soil">Clay soil</option>
                  <option value="Unknown / Not tested">Unknown / Not tested</option>
                </select>
              </div>

              {/* Measured Soil pH */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('cropAdvisor.land_profile.soil_ph')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="3.0"
                  max="11.0"
                  value={formData.soil_ph ?? ''}
                  onChange={(e) => setFormData({ ...formData, soil_ph: e.target.value === '' ? null : e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 shadow-sm"
                  placeholder="e.g. 6.5 (optional)"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {t('cropAdvisor.land_profile.ph_hint')}
                </span>
              </div>

              {/* Water Source */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('cropAdvisor.land_profile.water_source')} *
                </label>
                <select
                  value={formData.water_source}
                  onChange={(e) => setFormData({ ...formData, water_source: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 shadow-sm"
                >
                  <option value="Rainfed only">Rainfed only</option>
                  <option value="Borewell">Borewell</option>
                  <option value="Open well">Open well</option>
                  <option value="Canal irrigation">Canal irrigation</option>
                  <option value="Drip irrigation">Drip irrigation</option>
                  <option value="Sprinkler irrigation">Sprinkler irrigation</option>
                </select>
              </div>

              {/* Water Availability */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('cropAdvisor.land_profile.water_availability')} *
                </label>
                <select
                  value={formData.water_availability}
                  onChange={(e) => setFormData({ ...formData, water_availability: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 shadow-sm"
                >
                  <option value="low">{t('cropAdvisor.land_profile.water_low')}</option>
                  <option value="medium">{t('cropAdvisor.land_profile.water_medium')}</option>
                  <option value="high">{t('cropAdvisor.land_profile.water_high')}</option>
                </select>
              </div>

              {/* Preferred Sowing Season */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('cropAdvisor.land_profile.preferred_season')} *
                </label>
                <select
                  value={formData.preferred_sowing_season}
                  onChange={(e) => {
                    const newSeas = e.target.value;
                    setFormData({ ...formData, preferred_sowing_season: newSeas });
                    fetchClimateData(formData.district, newSeas);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 shadow-sm"
                >
                  <option value="Kharif">Kharif (June - October)</option>
                  <option value="Rabi">Rabi (October - January)</option>
                  <option value="Summer">Summer (February - May)</option>
                </select>
              </div>
            </div>

            {/* Actions: Save to Account + Generate Recommendations */}
            <div className="pt-4 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="inline-flex items-center px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm transition-all disabled:opacity-60 shadow-sm"
              >
                {isSavingProfile ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin text-emerald-500 dark:text-emerald-400" />
                    Saving to DB...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400" />
                    Save Profile to Account
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-6 py-2.5 rounded-xl shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm transition-all focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {t('cropAdvisor.land_profile.saving')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {t('cropAdvisor.land_profile.save_and_recommend_btn')}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: CROP GROWTH CALENDAR */}
      {activeTab === 'calendar' && (
        <div className="bg-white dark:bg-slate-900/90 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                {t('cropAdvisor.calendar.title')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Growth stages and agronomic tasks for{' '}
                <strong className="text-slate-900 dark:text-white">
                  {currentLang === 'kn' ? selectedCropForCalendar?.crop_name_kn : selectedCropForCalendar?.crop_name_en}
                </strong>
              </p>
            </div>

            {/* Crop Selector dropdown */}
            {recommendationResult?.recommendations && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 dark:text-slate-400">Select Crop:</span>
                <select
                  value={selectedCropForCalendar?.crop_id || ''}
                  onChange={(e) => {
                    const c = recommendationResult.recommendations.find(r => r.crop_id === e.target.value);
                    if (c) setSelectedCropForCalendar(c);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold shadow-sm"
                >
                  {recommendationResult.recommendations.map(r => (
                    <option key={r.crop_id} value={r.crop_id}>
                      #{r.rank} {currentLang === 'kn' ? r.crop_name_kn : r.crop_name_en}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {selectedCropForCalendar?.calendar ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 block text-xs">{t('cropAdvisor.calendar.sowing_window')}</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {selectedCropForCalendar.calendar.sowing_window}
                  </span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 block text-xs">{t('cropAdvisor.calendar.harvest_window')}</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {selectedCropForCalendar.calendar.estimated_harvest_window}
                  </span>
                </div>
              </div>

              {/* Timeline Gantt / Stepper */}
              <div className="relative border-l-2 border-emerald-500/40 ml-4 sm:ml-6 pl-6 sm:pl-8 space-y-8">
                {selectedCropForCalendar.calendar.stages.map((stg, i) => (
                  <div key={i} className="relative">
                    {/* Step Marker */}
                    <span className="absolute -left-[35px] sm:-left-[43px] top-0 w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center ring-4 ring-white dark:ring-slate-900 shadow-md">
                      {i + 1}
                    </span>

                    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {currentLang === 'kn' ? stg.stage_name_kn : stg.stage_name_en}
                        </h4>
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                          {stg.approximate_dates} ({stg.duration_days} days)
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        <strong className="text-slate-900 dark:text-slate-200">Agronomic Tasks:</strong> {currentLang === 'kn' ? stg.key_tasks_kn : stg.key_tasks_en}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
              No calendar data available for this selection.
            </p>
          )}

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('recommendations')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 inline-flex items-center"
            >
              &larr; {t('cropAdvisor.calendar.back_to_rec')}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
