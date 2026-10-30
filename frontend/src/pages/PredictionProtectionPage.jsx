import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck, Sparkles, FileText, CheckCircle2, AlertCircle,
  Clock, TrendingDown, DollarSign, ArrowRight, ChevronDown,
  ChevronUp, RefreshCw, AlertTriangle, Layers, Calendar, Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import mandiApi from '../services/mandiApi';

const PredictionProtectionPage = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();

  const [predictions, setPredictions] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Claim Form State
  const [selectedPredictionId, setSelectedPredictionId] = useState('');
  const [harvestQty, setHarvestQty] = useState('20');
  const [actualPrice, setActualPrice] = useState('2300');
  const [dateOfSale, setDateOfSale] = useState(new Date().toISOString().slice(0, 10));
  const [evidenceDesc, setEvidenceDesc] = useState('');
  const [impactDesc, setImpactDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Expanded claims for audit log inspection
  const [expandedClaimId, setExpandedClaimId] = useState(null);
  const [claimAudits, setClaimAudits] = useState({});

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (isAuthenticated) {
        const [predsData, claimsData] = await Promise.all([
          mandiApi.getProtectionPredictions(),
          mandiApi.getMyClaims(),
        ]);
        setPredictions(predsData);
        setClaims(claimsData);
        if (predsData.length > 0 && !selectedPredictionId) {
          setSelectedPredictionId(predsData[0].prediction_id);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load protection data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAuthenticated]);

  const selectedPrediction = predictions.find((p) => p.prediction_id === selectedPredictionId);

  // Real-time calculation
  const predictedPrice = selectedPrediction ? selectedPrediction.predicted_price : 0;
  const numQty = parseFloat(harvestQty) || 0;
  const numActualPrice = parseFloat(actualPrice) || 0;
  const priceDiff = Math.max(0, predictedPrice - numActualPrice);
  const grossLoss = Math.round(priceDiff * numQty);
  const proposedCompensation = Math.round(grossLoss * 0.35);

  const handleSubmitClaim = async (e) => {
    e.preventDefault();
    if (!selectedPrediction) {
      setErrorMsg('Please select an AI Prediction record.');
      return;
    }
    if (grossLoss <= 0) {
      setErrorMsg('Actual selling price is equal to or higher than predicted price. No eligible loss incurred.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const payload = {
        prediction_id: selectedPrediction.prediction_id,
        crop_id: selectedPrediction.crop_id,
        crop_name: selectedPrediction.crop_name,
        mandi_id: selectedPrediction.mandi_id,
        mandi_name: selectedPrediction.mandi_name,
        harvest_quantity_qtl: numQty,
        actual_selling_price: numActualPrice,
        date_of_sale: dateOfSale,
        evidence_description: evidenceDesc || 'APMC Gate weighment slip attached.',
        financial_impact_description: impactDesc || 'Adverse market price shock below AI forecast target.',
      };

      const res = await mandiApi.submitClaim(payload);
      setSuccessMsg(`Claim #${res.claim_id} submitted successfully for APMC verification.`);
      setEvidenceDesc('');
      setImpactDesc('');
      await fetchData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit claim.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleClaimExpansion = async (claimId) => {
    if (expandedClaimId === claimId) {
      setExpandedClaimId(null);
      return;
    }
    setExpandedClaimId(claimId);
    if (!claimAudits[claimId]) {
      try {
        const auditData = await mandiApi.getClaimAudit(claimId);
        setClaimAudits((prev) => ({ ...prev, [claimId]: auditData }));
      } catch (err) {
        console.warn('Could not fetch audit trail:', err);
      }
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">Approved (35% Eligible)</span>;
      case 'Rejected':
        return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-400 border border-red-300 dark:border-red-800">Rejected</span>;
      case 'Under Review':
        return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-400 border border-blue-300 dark:border-blue-800">Under Review</span>;
      case 'Additional Evidence Required':
        return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800">Evidence Required</span>;
      case 'Paid':
        return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">Paid (Simulated)</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{status}</span>;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl">
          <Sparkles className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Farmer Authentication Required</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Please log in or register to access AI Prediction Protection and manage your compensation claims.
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-md"
          >
            <span>Sign In / ಹೊಸ ನೋಂದಣಿ</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Banner */}
      <div className="text-center max-w-3xl mx-auto mb-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3 shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Proposed Farmer Safety Net Program</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          AI Prediction Protection
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm sm:text-base">
          35% Verified Eligible Loss Benefit when actual APMC market spot prices crash below AI forecast targets.
        </p>

        {/* Legal Safeguard Banner */}
        <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/70 text-xs text-amber-900 dark:text-amber-300 text-left flex items-start space-x-3 shadow-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <strong className="block text-sm font-bold text-amber-950 dark:text-amber-200 mb-0.5">
              Demonstration Program Notice & Terms
            </strong>
            <p>
              AI Prediction Protection is a proposed demonstration benefit designed for transparent farmer risk mitigation.
              Claim eligibility and compensation require verification and approved program terms.
              No real monetary compensation is paid in this demonstration tier.
            </p>
          </div>
        </div>
      </div>

      {/* Formula Explanation Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-8 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center space-x-2">
          <Layers className="w-4 h-4 text-emerald-600 dark:text-agri-400" />
          <span>How the 35% Benefit Calculation Operates</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700 dark:text-slate-300">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <span className="font-semibold text-emerald-700 dark:text-agri-400 block mb-1">1. Gross Loss Calculation</span>
            <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px] mb-1">
              Gross Loss = (Target Price - Actual Realized Price) × Sold Quantity
            </p>
            <p>Evaluates only negative deviations when spot rate drops below target.</p>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <span className="font-semibold text-amber-700 dark:text-amber-400 block mb-1">2. Verification & Exclusions</span>
            <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px] mb-1">
              Eligible Loss = Gross Loss - Excluded Loss
            </p>
            <p>Adjusts for verified grade deductions, off-specification crops, or delays.</p>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <span className="font-semibold text-purple-700 dark:text-purple-400 block mb-1">3. Proposed 35% Compensation</span>
            <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px] mb-1">
              Proposed Benefit = Verified Eligible Loss × 35%
            </p>
            <p>Direct safety net support credited to farmer upon APMC approval.</p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-center justify-between shadow-sm">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')}>×</button>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-agri-950/60 border border-emerald-300 dark:border-agri-800 text-emerald-800 dark:text-agri-300 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-agri-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')}>×</button>
        </div>
      )}

      {/* Main Grid: Claim Form & Claims History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Claim Submission Form (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm h-fit">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center space-x-2">
            <FileText className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span>Submit New Prediction Loss Claim</span>
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-5">
            Select an immutable AI prediction record and input your actual APMC mandi realized slip details.
          </p>

          <form onSubmit={handleSubmitClaim} className="space-y-4">
            {/* Prediction selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select AI Prediction Record
              </label>
              <select
                value={selectedPredictionId}
                onChange={(e) => setSelectedPredictionId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm"
              >
                {predictions.map((p) => (
                  <option key={p.prediction_id} value={p.prediction_id}>
                    {p.crop_name} @ {p.mandi_name} — Target ₹{p.predicted_price}/qtl ({p.recommended_action})
                  </option>
                ))}
              </select>
            </div>

            {/* Selected record info card */}
            {selectedPrediction && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1 shadow-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">AI Predicted Price:</span>
                  <span className="text-emerald-600 dark:text-agri-400 font-bold">₹{selectedPrediction.predicted_price} / qtl</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Forecast Horizon:</span>
                  <span className="text-slate-800 dark:text-slate-200">{selectedPrediction.forecast_horizon_days} Days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Model Version:</span>
                  <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">{selectedPrediction.model_version}</span>
                </div>
              </div>
            )}

            {/* Input quantities */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sold Quantity (Quintals)
                </label>
                <input
                  type="number"
                  required
                  step="0.1"
                  min="0.1"
                  value={harvestQty}
                  onChange={(e) => setHarvestQty(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Actual Realized Price (₹/qtl)
                </label>
                <input
                  type="number"
                  required
                  step="1"
                  min="0"
                  value={actualPrice}
                  onChange={(e) => setActualPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date of APMC Sale
              </label>
              <input
                type="date"
                required
                value={dateOfSale}
                onChange={(e) => setDateOfSale(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mandi Weighment Slip / Invoice Reference
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Weighment Slip #APMC-KOLAR-2026-9921"
                value={evidenceDesc}
                onChange={(e) => setEvidenceDesc(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Adverse Market Impact Description
              </label>
              <textarea
                rows={2}
                required
                placeholder="Describe the sudden price drop or mandi arrival glut..."
                value={impactDesc}
                onChange={(e) => setImpactDesc(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white shadow-sm"
              />
            </div>

            {/* Dynamic Calculation Live Box */}
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/50 rounded-xl space-y-1.5 text-xs shadow-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Price Difference:</span>
                <span className="font-semibold text-amber-700 dark:text-amber-300">₹{priceDiff} / qtl</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Gross Realized Loss:</span>
                <span className="font-semibold text-red-600 dark:text-red-400">₹{grossLoss.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-amber-200 dark:border-amber-900/60 font-bold text-slate-900 dark:text-white text-sm">
                <span>Proposed 35% Benefit:</span>
                <span className="text-emerald-600 dark:text-agri-400 font-extrabold">₹{proposedCompensation.toLocaleString()}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || grossLoss <= 0}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-colors shadow-md flex items-center justify-center space-x-2 ${
                grossLoss > 0
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting Claim...' : 'Submit Claim for APMC Review'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Submitted Claims & Audit Tracker (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-agri-400" />
                <span>My Submitted Protection Claims</span>
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">Total: {claims.length}</span>
            </div>

            {claims.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                You have not filed any protection claims yet.
              </div>
            ) : (
              <div className="space-y-3">
                {claims.map((claim) => {
                  const isExpanded = expandedClaimId === claim.claim_id;
                  const audits = claimAudits[claim.claim_id] || [];

                  return (
                    <div
                      key={claim.claim_id}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">{claim.crop_name}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">at {claim.mandi_name}</span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono">Claim ID: {claim.claim_id}</span>
                        </div>
                        <div>{getStatusBadge(claim.status)}</div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2 text-xs border-t border-b border-slate-200 dark:border-slate-900 text-slate-700 dark:text-slate-300">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Quantity</span>
                          <span className="font-semibold">{claim.harvest_quantity_qtl} qtl</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Actual Realized</span>
                          <span className="font-semibold">₹{claim.actual_selling_price}/qtl</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Gross Loss</span>
                          <span className="font-semibold text-red-600 dark:text-red-400">₹{claim.gross_loss?.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">35% Benefit</span>
                          <span className="font-bold text-emerald-600 dark:text-agri-400">₹{claim.proposed_compensation?.toLocaleString()}</span>
                        </div>
                      </div>

                      {claim.reviewer_notes && (
                        <div className="mt-2 p-2 bg-white dark:bg-slate-900 rounded-lg text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 shadow-sm">
                          <strong className="text-emerald-700 dark:text-agri-400">APMC Officer Note: </strong>
                          <span>{claim.reviewer_notes}</span>
                          {claim.reviewed_by && (
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              Reviewed by {claim.reviewed_by} ({claim.reviewed_at?.slice(0, 10)})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Audit toggle */}
                      <div className="mt-3 flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-500">
                          Filed on {claim.created_at?.slice(0, 10)}
                        </span>
                        <button
                          onClick={() => toggleClaimExpansion(claim.claim_id)}
                          className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-agri-400 dark:hover:text-agri-300 flex items-center space-x-1 font-semibold"
                        >
                          <span>{isExpanded ? 'Hide Audit Log' : 'View Audit Trail'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Expanded Audit Log Trail */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/70 space-y-2">
                          <span className="text-xs font-semibold text-slate-900 dark:text-white block">Audit Trail:</span>
                          {audits.length === 0 ? (
                            <p className="text-[11px] text-slate-500">Loading audit history...</p>
                          ) : (
                            <div className="space-y-1.5">
                              {audits.map((a) => (
                                <div
                                  key={a.log_id}
                                  className="p-2 bg-white dark:bg-slate-900/60 rounded text-[11px] border border-slate-200 dark:border-slate-800/60 shadow-sm"
                                >
                                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                      {a.actor_name} ({a.actor_role})
                                    </span>
                                    <span>{a.timestamp?.slice(0, 16).replace('T', ' ')}</span>
                                  </div>
                                  <p className="text-slate-700 dark:text-slate-300 mt-0.5">{a.explanation}</p>
                                  <div className="text-[10px] text-emerald-700 dark:text-agri-400 mt-0.5">
                                    Status: {a.previous_status ? `${a.previous_status} → ` : ''}<strong>{a.new_status}</strong>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictionProtectionPage;

