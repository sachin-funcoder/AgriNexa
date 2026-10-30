import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ShieldAlert, CheckCircle2, AlertCircle, X, Search, Filter,
  Clock, Sparkles, FileText, Check, ArrowRight, UserCheck, Edit3
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import mandiApi from '../services/mandiApi';

const AdminProtectionPage = () => {
  const { t } = useTranslation();
  const { user, isAdmin, loginAsDemoAdmin, isAuthenticated } = useAuth();

  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filtering
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Review Modal
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [reviewAction, setReviewAction] = useState('APPROVE');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [adjustedExcludedLoss, setAdjustedExcludedLoss] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchClaims = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (isAdmin) {
        const data = await mandiApi.adminGetAllClaims();
        setClaims(data);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to fetch admin claims queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, [isAdmin]);

  const handleOpenReview = (claim) => {
    setSelectedClaim(claim);
    setReviewAction(claim.status === 'Submitted' ? 'APPROVE' : 'APPROVE');
    setReviewerNotes(claim.reviewer_notes || 'Verified against APMC electronic weighment register.');
    setAdjustedExcludedLoss(claim.excluded_loss ? String(claim.excluded_loss) : '0');
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClaim) return;
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const payload = {
        action: reviewAction,
        reviewer_notes: reviewerNotes,
        adjusted_excluded_loss: adjustedExcludedLoss ? parseFloat(adjustedExcludedLoss) : 0,
      };
      const updated = await mandiApi.adminReviewClaim(selectedClaim.claim_id, payload);
      setSuccessMsg(`Claim #${updated.claim_id} updated to status "${updated.status}".`);
      setSelectedClaim(null);
      await fetchClaims();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit review action.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="p-8 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800/60 rounded-2xl shadow-xl">
          <ShieldAlert className="w-12 h-12 text-purple-500 dark:text-purple-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">APMC Reviewer Privileges Required</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Only authorized APMC officers and administrators can review farmer protection claims, verify weighment slips, and approve compensation.
          </p>
          <div className="space-y-3">
            <button
              onClick={async () => {
                await loginAsDemoAdmin();
                await fetchClaims();
              }}
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 shadow-md"
            >
              <UserCheck className="w-4 h-4" />
              <span>Switch to Demo APMC Reviewer Account</span>
            </button>
            <Link
              to="/profile"
              className="block text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              Return to Farmer Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Filtered claims
  const filteredClaims = claims.filter((c) => {
    const matchStatus = statusFilter === 'ALL' || c.status.toUpperCase() === statusFilter;
    const matchSearch =
      c.crop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.mandi_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.claim_id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Aggregates
  const totalApproved = claims.filter((c) => c.status === 'Approved').length;
  const totalPending = claims.filter((c) => c.status === 'Submitted' || c.status === 'Under Review').length;
  const totalCompensation = claims
    .filter((c) => c.status === 'Approved' || c.status === 'Paid')
    .reduce((sum, c) => sum + (c.proposed_compensation || 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950 border border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2 shadow-sm">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>APMC Mandi Reviewer & Claims Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            AI Protection Claims Verification
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Review submitted weighment slips, adjust exclusions, and approve 35% verified loss benefits.
          </p>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-right shadow-sm">
          <span className="text-slate-500 dark:text-slate-400 block">Reviewer Identity:</span>
          <span className="text-purple-700 dark:text-purple-300 font-bold">{user.full_name}</span>
        </div>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Total Claims Filed</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white">{claims.length}</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Pending Review</span>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{totalPending}</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Approved Claims</span>
          <span className="text-2xl font-black text-emerald-600 dark:text-agri-400">{totalApproved}</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Total Verified Benefit</span>
          <span className="text-2xl font-black text-purple-700 dark:text-purple-300">₹{totalCompensation.toLocaleString()}</span>
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

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search farmer, mandi, crop..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white shadow-sm"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'SUBMITTED', 'UNDER REVIEW', 'APPROVED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shadow-sm ${
                statusFilter === st
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Claims Queue Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60">
                <th className="py-3 px-4">Claim ID & Date</th>
                <th className="py-3 px-4">Farmer Details</th>
                <th className="py-3 px-4">Crop & Mandi</th>
                <th className="py-3 px-4">Qty & Actual Realized</th>
                <th className="py-3 px-4">Gross Loss</th>
                <th className="py-3 px-4">35% Benefit</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400 dark:text-slate-500">
                    No claims match the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredClaims.map((c) => (
                  <tr key={c.claim_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-semibold text-slate-900 dark:text-white">{c.claim_id}</div>
                      <div className="text-[10px] text-slate-500">{c.date_of_sale}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{c.user_name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">+91 {c.user_mobile}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-emerald-700 dark:text-agri-300">{c.crop_name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{c.mandi_name}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div>{c.harvest_quantity_qtl} qtl</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">@ ₹{c.actual_selling_price}/qtl</div>
                    </td>
                    <td className="py-3.5 px-4 text-red-600 dark:text-red-400 font-semibold">
                      ₹{c.gross_loss?.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-emerald-600 dark:text-agri-400 font-bold">
                      ₹{c.proposed_compensation?.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.status === 'Approved'
                            ? 'bg-emerald-50 dark:bg-agri-950 text-emerald-700 dark:text-agri-400 border border-emerald-300 dark:border-agri-800'
                            : c.status === 'Rejected'
                            ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800'
                            : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenReview(c)}
                        className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition-colors shadow-sm"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REVIEW MODAL */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedClaim(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              APMC Officer Claim Adjudication
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Claim ID: <span className="font-mono text-purple-700 dark:text-purple-300">{selectedClaim.claim_id}</span> ({selectedClaim.crop_name})
            </p>

            {/* Evidence details from farmer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2 mb-4 shadow-sm">
              <div>
                <span className="text-slate-500 block">Farmer Submitted Evidence:</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold">{selectedClaim.evidence_description}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Adverse Market Impact:</span>
                <span className="text-slate-700 dark:text-slate-200">{selectedClaim.financial_impact_description}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex justify-between font-mono text-[11px]">
                <span>Target: ₹{selectedClaim.predicted_price}</span>
                <span>Realized: ₹{selectedClaim.actual_selling_price}</span>
                <span className="text-emerald-600 dark:text-agri-400 font-bold">Benefit: ₹{selectedClaim.proposed_compensation}</span>
              </div>
            </div>

            {/* Review form */}
            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Adjudication Decision
                </label>
                <select
                  value={reviewAction}
                  onChange={(e) => setReviewAction(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white shadow-sm"
                >
                  <option value="APPROVE">Approve Claim (35% Compensation)</option>
                  <option value="REQUEST_EVIDENCE">Request Additional Evidence</option>
                  <option value="REJECT">Reject Claim</option>
                  <option value="PROCESS_COMPENSATION">Process Compensation</option>
                  <option value="PAY">Mark as Paid (Simulated)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Excluded Loss Adjustment (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={adjustedExcludedLoss}
                  onChange={(e) => setAdjustedExcludedLoss(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white shadow-sm"
                />
                <span className="text-[10px] text-slate-500">
                  Deductions for quality defects or out-of-bounds delays.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mandatory Reviewer Explanation Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white shadow-sm"
                  placeholder="Explain reason for decision for the farmer's audit trail..."
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedClaim(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white flex items-center space-x-1.5 shadow-md"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Recording Decision...' : 'Confirm Decision'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProtectionPage;

