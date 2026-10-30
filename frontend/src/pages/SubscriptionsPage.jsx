import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Check, Sparkles, ShieldCheck, Zap, AlertCircle, CheckCircle2,
  CreditCard, Smartphone, ArrowRight, X, Clock, RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import mandiApi from '../services/mandiApi';

const SubscriptionsPage = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated, refreshUser } = useAuth();

  const [plans, setPlans] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Checkout modal
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [paymentMethod, setPaymentMethod] = useState('demo_upi');
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const plansData = await mandiApi.getSubscriptionPlans();
      setPlans(plansData);

      if (isAuthenticated) {
        const [subData, histData] = await Promise.all([
          mandiApi.getMySubscription(),
          mandiApi.getSubscriptionHistory(),
        ]);
        setCurrentSub(subData);
        setHistory(histData);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load subscription plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAuthenticated]);

  const handleOpenCheckout = (plan) => {
    if (!isAuthenticated) {
      setErrorMsg('Please log in first to choose a subscription plan.');
      return;
    }
    setSelectedPlan(plan);
    setCheckoutResult(null);
  };

  const handleSimulatePayment = async () => {
    if (!selectedPlan) return;
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const res = await mandiApi.checkoutSubscription({
        plan_id: selectedPlan.id,
        billing_cycle: billingCycle,
        payment_method: paymentMethod,
      });
      setCheckoutResult(res);
      setSuccessMsg(`Simulated subscription to ${selectedPlan.name} successful!`);
      await refreshUser();
      await fetchData();
    } catch (err) {
      setErrorMsg(err.message || 'Payment simulation failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your paid plan and revert to Free tier?')) {
      return;
    }
    setIsProcessing(true);
    try {
      await mandiApi.cancelSubscription();
      setSuccessMsg('Paid subscription cancelled. You are now on the Free tier.');
      await refreshUser();
      await fetchData();
    } catch (err) {
      setErrorMsg(err.message || 'Cancellation failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-agri-950 border border-emerald-300 dark:border-agri-800 text-emerald-800 dark:text-agri-400 text-xs font-semibold uppercase tracking-wider mb-3 shadow-sm">
          <Zap className="w-3.5 h-3.5" />
          <span>Karnataka Farmer Subscription Tiers</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Transparent Intelligence, Built for Farmers
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm sm:text-base">
          From basic live APMC market data to full AI prediction protection with 35% verified loss compensation.
        </p>

        {/* Legal & Demonstration Safeguard Banner */}
        <div className="mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 max-w-2xl mx-auto text-left flex items-start space-x-2.5 shadow-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <strong className="block font-semibold text-amber-950 dark:text-amber-200">Simulated Demonstration Environment</strong>
            <span>
              All pricing and checkout interactions are demonstration simulations. No real credit card or UPI
              transactions occur. AI Prediction Protection coverage is a demonstration program model.
            </span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-center justify-between shadow-sm">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-agri-950/60 border border-emerald-300 dark:border-agri-800 text-emerald-800 dark:text-agri-300 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-agri-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Plan Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {plans.map((plan) => {
          const isCurrent = currentSub?.plan_id === plan.id;
          const isProtection = plan.id === 'PROTECTION';

          return (
            <div
              key={plan.id}
              className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between p-6 sm:p-7 relative shadow-sm ${
                isCurrent
                  ? 'bg-emerald-50/60 dark:bg-agri-950/40 border-emerald-500 dark:border-agri-600 shadow-md ring-1 ring-emerald-500/30'
                  : isProtection
                  ? 'bg-white dark:bg-slate-900 border-amber-400 dark:border-amber-500/50 shadow-md ring-1 ring-amber-400/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Top Badge */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {plan.badge || plan.tier}
                </span>
                {isCurrent && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-600 text-white uppercase tracking-wider shadow-sm">
                    Current Plan
                  </span>
                )}
                {!isCurrent && plan.is_popular && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-slate-950 uppercase tracking-wider shadow-sm">
                    Popular
                  </span>
                )}
              </div>

              {/* Title & Price */}
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{plan.name}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 min-h-[36px]">{plan.description}</p>

                <div className="flex items-baseline space-x-2 mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                    ₹{plan.price_inr}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {plan.price_inr === 0 ? '/ forever' : '/ month (demo)'}
                  </span>
                </div>

                {/* Features List */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start space-x-2.5 text-xs text-slate-700 dark:text-slate-300">
                      <Check className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-agri-400 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {plan.has_prediction_protection && (
                    <li className="flex items-start space-x-2.5 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-300 dark:border-amber-800/50 shadow-sm">
                      <Sparkles className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <span>Eligible for 35% Verified Loss Benefit</span>
                    </li>
                  )}
                </ul>
              </div>

              {/* Action Button */}
              <div>
                {isCurrent ? (
                  <div className="space-y-2">
                    <button
                      disabled
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-100 dark:bg-agri-950 border border-emerald-300 dark:border-agri-700 text-emerald-800 dark:text-agri-300 text-xs font-bold cursor-default shadow-sm"
                    >
                      Active Subscription
                    </button>
                    {plan.id !== 'FREE' && (
                      <button
                        onClick={handleCancelSubscription}
                        disabled={isProcessing}
                        className="w-full text-center text-xs text-slate-500 hover:text-red-500 py-1 transition-colors"
                      >
                        Cancel Plan
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => handleOpenCheckout(plan)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-1.5 ${
                      isProtection
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    <span>{plan.price_inr === 0 ? 'Switch to Free' : 'Choose Plan (Demo)'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Subscription History Section (Authenticated users) */}
      {isAuthenticated && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-agri-400" />
              <span>Subscription Transaction History</span>
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Active Tier: <strong className="text-emerald-600 dark:text-agri-400">{currentSub?.plan_name}</strong>
            </span>
          </div>

          {history.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">No transaction records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                    <th className="py-2.5 px-3">Plan</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Cycle</th>
                    <th className="py-2.5 px-3">Start Date</th>
                    <th className="py-2.5 px-3">End Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">{h.plan_name}</td>
                      <td className="py-3 px-3">₹{h.amount_paid}</td>
                      <td className="py-3 px-3 capitalize">{h.billing_cycle}</td>
                      <td className="py-3 px-3">{h.start_date?.slice(0, 10)}</td>
                      <td className="py-3 px-3">{h.end_date?.slice(0, 10)}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            h.status === 'active'
                              ? 'bg-emerald-50 dark:bg-agri-950 text-emerald-700 dark:text-agri-400 border border-emerald-300 dark:border-agri-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {h.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-amber-600 dark:text-amber-400 font-semibold">Demo</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DEMO CHECKOUT MODAL */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedPlan(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="mb-4">
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800 rounded shadow-sm">
                Simulated Demo Checkout
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-2">{selectedPlan.name}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Complete simulated subscription checkout to activate features immediately.
              </p>
            </div>

            {checkoutResult ? (
              <div className="p-4 bg-emerald-50 dark:bg-agri-950/60 border border-emerald-300 dark:border-agri-800 rounded-xl space-y-3 text-xs text-emerald-900 dark:text-agri-300 shadow-sm">
                <div className="flex items-center space-x-2 text-emerald-700 dark:text-agri-400 font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{checkoutResult.message}</span>
                </div>
                <div className="p-2.5 bg-white dark:bg-slate-950 rounded-lg text-slate-700 dark:text-slate-400 space-y-1 border border-slate-200 dark:border-slate-800">
                  <p>Transaction ID: <span className="text-slate-900 dark:text-white font-mono">{checkoutResult.transaction_id}</span></p>
                  <p>Plan Activated: <span className="text-slate-900 dark:text-white">{checkoutResult.subscription?.plan_name}</span></p>
                  <p>Billing: <span className="text-slate-900 dark:text-white capitalize">{checkoutResult.subscription?.billing_cycle}</span></p>
                </div>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold shadow-md"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Billing Cycle Option */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Select Billing Cycle
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBillingCycle('monthly')}
                      className={`p-2.5 rounded-lg border text-xs text-left transition-colors shadow-sm ${
                        billingCycle === 'monthly'
                          ? 'bg-emerald-50 dark:bg-agri-950 border-emerald-500 dark:border-agri-600 text-emerald-800 dark:text-agri-300'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="font-bold text-slate-900 dark:text-white">Monthly</div>
                      <div className="text-[11px]">₹{selectedPlan.price_inr} / month</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle('annual')}
                      className={`p-2.5 rounded-lg border text-xs text-left transition-colors shadow-sm ${
                        billingCycle === 'annual'
                          ? 'bg-emerald-50 dark:bg-agri-950 border-emerald-500 dark:border-agri-600 text-emerald-800 dark:text-agri-300'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between text-slate-900 dark:text-white">
                        <span>Annual</span>
                        <span className="text-[9px] bg-emerald-600 text-white px-1 rounded">Save 15%</span>
                      </div>
                      <div className="text-[11px]">₹{(selectedPlan.price_inr * 10).toFixed(0)} / year</div>
                    </button>
                  </div>
                </div>

                {/* Demo Payment Method */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Demo Payment Instrument
                  </label>
                  <div className="space-y-1.5">
                    {[
                      { id: 'demo_upi', label: 'Demo UPI (PhonePe / GPay / BHIM)', icon: Smartphone },
                      { id: 'demo_kcc', label: 'Demo Kisan Credit Card (KCC)', icon: CreditCard },
                    ].map((method) => {
                      const Icon = method.icon;
                      return (
                        <label
                          key={method.id}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer shadow-sm ${
                            paymentMethod === method.id
                              ? 'bg-slate-50 dark:bg-slate-950 border-emerald-500 dark:border-agri-600 text-slate-900 dark:text-white'
                              : 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <Icon className="w-4 h-4 text-emerald-600 dark:text-agri-400" />
                            <span>{method.label}</span>
                          </div>
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === method.id}
                            onChange={() => setPaymentMethod(method.id)}
                            className="text-emerald-600"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Amount to pay summary */}
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shadow-sm">
                  <span className="text-slate-500 dark:text-slate-400">Total Demo Payable:</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    ₹{billingCycle === 'annual' ? selectedPlan.price_inr * 10 : selectedPlan.price_inr}
                  </span>
                </div>

                {/* Submit button */}
                <button
                  type="button"
                  onClick={handleSimulatePayment}
                  disabled={isProcessing}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-md flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isProcessing ? 'Processing Demo Simulation...' : 'Confirm Demo Subscription'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionsPage;

