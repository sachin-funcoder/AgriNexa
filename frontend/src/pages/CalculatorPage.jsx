import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calculator, Coins, TrendingUp, TrendingDown, AlertTriangle,
  Info, Check, RefreshCw, Truck, Warehouse, Users, Package,
  Scale, ShieldAlert, Sparkles, ChevronDown, DollarSign
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie
} from 'recharts';

import { SUPPORTED_CROPS, KARNATAKA_MANDIS, LOGISTICS_DEFAULTS } from '../utils/constants';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatters';
import mandiApi from '../services/mandiApi';

// ─── Synthetic Distance Reference Matrix for Demo Quick Estimates ─────────────
const SYNTHETIC_DISTANCES = {
  mandi_bengaluru: 60,
  mandi_kolar: 70,
  mandi_mysuru: 145,
  mandi_mandya: 100,
  mandi_hubballi: 410,
  mandi_belagavi: 505,
  mandi_davanagere: 260,
  mandi_hassan: 180,
};

const CalculatorPage = () => {
  const { t, i18n } = useTranslation();
  const isKn = i18n.language?.startsWith('kn');

  // ─── Input Form State ───────────────────────────────────────────────────────
  const [selectedCrop, setSelectedCrop] = useState(SUPPORTED_CROPS[0]);
  const [selectedMandi, setSelectedMandi] = useState(KARNATAKA_MANDIS[0]);
  const [cropDropdownOpen, setCropDropdownOpen] = useState(false);
  const [mandiDropdownOpen, setMandiDropdownOpen] = useState(false);

  // Numerical Inputs (stored as strings for smooth typing)
  const [quantitySold, setQuantitySold] = useState('50');
  const [sellingPrice, setSellingPrice] = useState('2500');
  const [transportExpense, setTransportExpense] = useState('3200');
  const [storageExpense, setStorageExpense] = useState('1050');
  const [handlingExpense, setHandlingExpense] = useState('500');
  const [otherExpenses, setOtherExpenses] = useState('400');

  // Feedback note when quick-estimate is applied
  const [estimateNotice, setEstimateNotice] = useState(false);
  const [fetchingDefaultPrice, setFetchingDefaultPrice] = useState(false);

  // ─── Fetch Latest Modal Price to Suggest Realistic Selling Price ────────────
  const fetchSuggestedPrice = useCallback(async (cropId, mandiId) => {
    setFetchingDefaultPrice(true);
    try {
      const data = await mandiApi.getCropPrices(cropId, { mandiId, limit: 1 });
      if (data?.stats?.latest_modal_price) {
        setSellingPrice(String(Math.round(data.stats.latest_modal_price)));
      }
    } catch {
      // Graceful fallback to default
    } finally {
      setFetchingDefaultPrice(false);
    }
  }, []);

  // When crop or mandi changes, fetch suggested latest modal price
  useEffect(() => {
    fetchSuggestedPrice(selectedCrop.id, selectedMandi.id);
  }, [selectedCrop.id, selectedMandi.id, fetchSuggestedPrice]);

  // ─── Quick Estimate Helper (Demonstration Presets) ─────────────────────────
  const applyQuickEstimate = () => {
    const qty = parseFloat(quantitySold) || 50;
    const distanceKm = SYNTHETIC_DISTANCES[selectedMandi.id] || 80;
    const freightRate = LOGISTICS_DEFAULTS.freight_rate_per_km_qtl || 2.25;
    const estTransport = Math.round(distanceKm * freightRate * qty);

    // Standard 3 days ambient storage
    const storageRate = LOGISTICS_DEFAULTS.storage_cost_per_qtl_day || 3.5;
    const estStorage = Math.round(3 * storageRate * qty);

    // Handling: ~₹10/quintal
    const estHandling = Math.round(10 * qty);

    // Other/cess: ~₹5/quintal
    const estOther = Math.round(5 * qty);

    setTransportExpense(String(estTransport));
    setStorageExpense(String(estStorage));
    setHandlingExpense(String(estHandling));
    setOtherExpenses(String(estOther));

    setEstimateNotice(true);
    setTimeout(() => setEstimateNotice(false), 5000);
  };

  // ─── Input Validation ───────────────────────────────────────────────────────
  const errors = useMemo(() => {
    const errs = {};
    const qty = parseFloat(quantitySold);
    const price = parseFloat(sellingPrice);
    const transport = parseFloat(transportExpense);
    const storage = parseFloat(storageExpense);
    const handling = parseFloat(handlingExpense);
    const other = parseFloat(otherExpenses);

    if (quantitySold === '' || isNaN(qty) || qty <= 0) {
      errs.quantity = t('calculator.valQuantityPositive', 'Harvest quantity must be greater than zero.');
    }
    if (sellingPrice === '' || isNaN(price) || price < 0) {
      errs.sellingPrice = t('calculator.valPriceNonNegative', 'Selling price cannot be negative.');
    }
    if (transportExpense === '' || isNaN(transport) || transport < 0) {
      errs.transport = t('calculator.valExpenseNonNegative', 'Expenses cannot be negative.');
    }
    if (storageExpense === '' || isNaN(storage) || storage < 0) {
      errs.storage = t('calculator.valExpenseNonNegative', 'Expenses cannot be negative.');
    }
    if (handlingExpense === '' || isNaN(handling) || handling < 0) {
      errs.handling = t('calculator.valExpenseNonNegative', 'Expenses cannot be negative.');
    }
    if (otherExpenses === '' || isNaN(other) || other < 0) {
      errs.other = t('calculator.valExpenseNonNegative', 'Expenses cannot be negative.');
    }

    return errs;
  }, [quantitySold, sellingPrice, transportExpense, storageExpense, handlingExpense, otherExpenses, t]);

  const isValid = Object.keys(errors).length === 0;

  // ─── Core Financial Calculations ────────────────────────────────────────────
  const financials = useMemo(() => {
    const qty = parseFloat(quantitySold) || 0;
    const price = parseFloat(sellingPrice) || 0;
    const transport = parseFloat(transportExpense) || 0;
    const storage = parseFloat(storageExpense) || 0;
    const handling = parseFloat(handlingExpense) || 0;
    const other = parseFloat(otherExpenses) || 0;

    // Gross Revenue = Quantity Sold × Selling Price
    const grossRevenue = qty * price;

    // Total Expenses = Transportation + Storage + Handling + Other
    const totalExpenses = transport + storage + handling + other;

    // Net Return = Gross Revenue − Total Expenses
    const netReturn = grossRevenue - totalExpenses;

    // Safe division by zero for per-quintal metrics
    const netReturnPerQuintal = qty > 0 ? netReturn / qty : 0;
    const breakEvenPrice = qty > 0 ? totalExpenses / qty : 0;

    const marginPercent = grossRevenue > 0 ? (netReturn / grossRevenue) * 100 : 0;
    const expenseRatio = grossRevenue > 0 ? (totalExpenses / grossRevenue) * 100 : 0;

    return {
      qty,
      price,
      transport,
      storage,
      handling,
      other,
      grossRevenue,
      totalExpenses,
      netReturn,
      netReturnPerQuintal,
      breakEvenPrice,
      marginPercent,
      expenseRatio
    };
  }, [quantitySold, sellingPrice, transportExpense, storageExpense, handlingExpense, otherExpenses]);

  // ─── Chart Data for Visual Breakdown ────────────────────────────────────────
  const comparisonBarData = useMemo(() => {
    return [
      { name: isKn ? 'ಒಟ್ಟು ಆದಾಯ' : 'Gross Revenue', amount: financials.grossRevenue, fill: '#38bdf8' },
      { name: isKn ? 'ಒಟ್ಟು ವೆಚ್ಚ' : 'Total Expenses', amount: financials.totalExpenses, fill: '#fb7185' },
      {
        name: isKn ? 'ನಿವ್ವಳ ಆದಾಯ' : 'Net Return',
        amount: Math.max(0, financials.netReturn),
        fill: financials.netReturn >= 0 ? '#10b981' : '#f43f5e'
      }
    ];
  }, [financials, isKn]);

  const expensePieData = useMemo(() => {
    const data = [
      { name: isKn ? 'ಸಾರಿಗೆ' : 'Transport', value: financials.transport, color: '#38bdf8' },
      { name: isKn ? 'ಗೋದಾಮು' : 'Storage', value: financials.storage, color: '#a78bfa' },
      { name: isKn ? 'ಕೂಲಿ/ನಿರ್ವಹಣೆ' : 'Handling', value: financials.handling, color: '#fb923c' },
      { name: isKn ? 'ಇತರ' : 'Other', value: financials.other, color: '#facc15' }
    ].filter(item => item.value > 0);
    return data;
  }, [financials, isKn]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Calculator className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>{t('calculator.title', 'Farmer Net Profit & Cost Calculator')}</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            {t('calculator.subtitle', 'Calculate your expected net earnings, total marketing expenses, and break-even selling price per quintal.')}
          </p>
        </div>

        {/* Action button to load demo rates */}
        <button
          onClick={applyQuickEstimate}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-emerald-700 dark:text-agri-400 transition-colors shadow-sm self-start md:self-auto"
        >
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-agri-400" />
          <span>{t('calculator.quickEstimate', 'Use Demo Distance & Rates')}</span>
        </button>
      </div>

      {/* Quick Estimate Notice */}
      {estimateNotice && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 p-3 text-xs text-emerald-900 dark:text-emerald-300 flex items-center justify-between animate-fadeIn shadow-sm">
          <span>{t('calculator.quickEstimateNote', 'Demonstration estimate based on standard Karnataka rates. Adjust values to reflect your actual expenses.')}</span>
          <button onClick={() => setEstimateNotice(false)} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-bold ml-2">✕</button>
        </div>
      )}

      {/* ── Main Two-Column Layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Left Column: Input Form (5 cols on lg) ───────────────────────── */}
        <div className="lg:col-span-5 space-y-5">
          <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isKn ? 'ಬೆಳೆ ಮತ್ತು ಮಾರಾಟ ವಿವರಗಳು' : 'Harvest & Sales Parameters'}</span>
            </h2>

            {/* Crop Selector */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('calculator.selectCrop', 'Select Crop')}
              </label>
              <button
                type="button"
                onClick={() => {
                  setCropDropdownOpen(prev => !prev);
                  setMandiDropdownOpen(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium hover:border-agri-500 transition-colors shadow-sm"
              >
                <span className="flex items-center gap-2">
                  <span>{selectedCrop.icon}</span>
                  <span>{isKn ? selectedCrop.name_kn : selectedCrop.name_en}</span>
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {cropDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-40 max-h-56 overflow-y-auto py-1">
                  {SUPPORTED_CROPS.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCrop(c);
                        setCropDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        selectedCrop.id === c.id ? 'text-emerald-700 dark:text-agri-400 font-bold bg-emerald-50 dark:bg-agri-950/30' : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{c.icon}</span>
                        <span>{isKn ? c.name_kn : c.name_en}</span>
                      </span>
                      {selectedCrop.id === c.id && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-agri-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Target Mandi Selector */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('calculator.selectMandi', 'Target Mandi')}
              </label>
              <button
                type="button"
                onClick={() => {
                  setMandiDropdownOpen(prev => !prev);
                  setCropDropdownOpen(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium hover:border-agri-500 transition-colors shadow-sm"
              >
                <span className="truncate">{selectedMandi.name}</span>
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </button>

              {mandiDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-40 max-h-56 overflow-y-auto py-1">
                  {KARNATAKA_MANDIS.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedMandi(m);
                        setMandiDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        selectedMandi.id === m.id ? 'text-emerald-700 dark:text-agri-400 font-bold bg-emerald-50 dark:bg-agri-950/30' : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{m.name.split('(')[0].trim()}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{m.district}</p>
                      </div>
                      {selectedMandi.id === m.id && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-agri-400 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Harvest Quantity Sold (quintals) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>{t('calculator.harvestQuantity', 'Harvest Quantity Sold')}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{t('common.quintals', 'quintals (100 kg)')}</span>
              </label>
              <div className="relative">
                <input
                  id="calc-harvest-quantity"
                  type="number"
                  min="0.1"
                  step="any"
                  value={quantitySold}
                  onChange={e => setQuantitySold(e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-1 shadow-sm ${
                    errors.quantity ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-agri-500'
                  }`}
                  placeholder="e.g. 50"
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-medium">qtl</span>
              </div>
              {errors.quantity && <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1">{errors.quantity}</p>}
            </div>

            {/* Expected Selling Price (₹/quintal) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>{t('calculator.sellingPrice', 'Expected Selling Price')}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{t('common.per_quintal', '/ quintal')}</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs text-slate-500 dark:text-slate-400 font-bold">₹</span>
                <input
                  id="calc-selling-price"
                  type="number"
                  min="0"
                  step="any"
                  value={sellingPrice}
                  onChange={e => setSellingPrice(e.target.value)}
                  className={`w-full pl-8 pr-12 py-2 rounded-xl bg-white dark:bg-slate-900 border text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-1 shadow-sm ${
                    errors.sellingPrice ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-agri-500'
                  }`}
                  placeholder="e.g. 2500"
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-medium">/qtl</span>
              </div>
              {fetchingDefaultPrice && (
                <p className="text-[10px] text-agri-400 mt-1 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>{isKn ? 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ನವೀಕರಿಸಲಾಗುತ್ತಿದೆ...' : 'Fetching latest mandi benchmark price...'}</span>
                </p>
              )}
              {errors.sellingPrice && <p className="text-[11px] text-rose-400 mt-1">{errors.sellingPrice}</p>}
            </div>
          </div>

          {/* Expenses Sub-panel */}
          <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Truck className="w-4 h-4 text-sky-500 dark:text-sky-400" />
              <span>{t('calculator.expensesTitle', 'Post-Harvest Marketing Expenses')}</span>
            </h2>

            {/* Transportation Expense */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                  <span>{t('calculator.transportationExpense', 'Transportation Expense')}</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">₹ (Total)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs text-slate-500 dark:text-slate-400 font-bold">₹</span>
                <input
                  id="calc-transport-expense"
                  type="number"
                  min="0"
                  step="any"
                  value={transportExpense}
                  onChange={e => setTransportExpense(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-1 shadow-sm ${
                    errors.transport ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-agri-500'
                  }`}
                  placeholder="0"
                />
              </div>
              {errors.transport && <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1">{errors.transport}</p>}
            </div>

            {/* Storage Expense */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                  <span>{t('calculator.storageExpense', 'Storage Expense')}</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">₹ (Total)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs text-slate-500 dark:text-slate-400 font-bold">₹</span>
                <input
                  id="calc-storage-expense"
                  type="number"
                  min="0"
                  step="any"
                  value={storageExpense}
                  onChange={e => setStorageExpense(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-1 shadow-sm ${
                    errors.storage ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-agri-500'
                  }`}
                  placeholder="0"
                />
              </div>
              {errors.storage && <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1">{errors.storage}</p>}
            </div>

            {/* Handling / Labor Expense */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
                  <span>{t('calculator.handlingExpense', 'Handling & Labor Expense')}</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">₹ (Loading / Unloading)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs text-slate-500 dark:text-slate-400 font-bold">₹</span>
                <input
                  id="calc-handling-expense"
                  type="number"
                  min="0"
                  step="any"
                  value={handlingExpense}
                  onChange={e => setHandlingExpense(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-1 shadow-sm ${
                    errors.handling ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-agri-500'
                  }`}
                  placeholder="0"
                />
              </div>
              {errors.handling && <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1">{errors.handling}</p>}
            </div>

            {/* Other / Incidental Expenses */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-amber-500 dark:text-yellow-400" />
                  <span>{t('calculator.otherExpenses', 'Other / Incidental Expenses')}</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">₹ (Cess, Bags, Toll)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs text-slate-500 dark:text-slate-400 font-bold">₹</span>
                <input
                  id="calc-other-expenses"
                  type="number"
                  min="0"
                  step="any"
                  value={otherExpenses}
                  onChange={e => setOtherExpenses(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-1 shadow-sm ${
                    errors.other ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-agri-500'
                  }`}
                  placeholder="0"
                />
              </div>
              {errors.other && <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1">{errors.other}</p>}
            </div>
          </div>
        </div>

        {/* ── Right Column: Calculated Results & Visualization (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-5">

          {/* Profit / Status Banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all shadow-sm ${
            !isValid || financials.qty <= 0
              ? 'bg-slate-100 dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              : financials.netReturn > 0
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-600/60 text-emerald-900 dark:text-emerald-200'
              : financials.netReturn < 0
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-600/60 text-rose-900 dark:text-rose-200'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-600/60 text-amber-900 dark:text-amber-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                !isValid || financials.qty <= 0
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  : financials.netReturn > 0
                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400'
                  : financials.netReturn < 0
                  ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-400'
                  : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400'
              }`}>
                {financials.netReturn > 0 ? (
                  <TrendingUp className="w-5 h-5" />
                ) : financials.netReturn < 0 ? (
                  <TrendingDown className="w-5 h-5" />
                ) : (
                  <Coins className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {!isValid || financials.qty <= 0
                    ? (isKn ? 'ಮಾನ್ಯ ಇನ್‌ಪುಟ್ ಅಗತ್ಯವಿದೆ' : 'Input Validation Required')
                    : financials.netReturn > 0
                    ? t('calculator.profitStatus', 'Profitable Operation')
                    : financials.netReturn < 0
                    ? t('calculator.lossStatus', 'Operating at a Loss')
                    : t('calculator.breakEvenStatus', 'Break-Even Point')}
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {!isValid || financials.qty <= 0 ? (
                    isKn ? 'ದಯವಿಟ್ಟು ಪ್ರಮಾಣ ಮತ್ತು ಬೆಲೆಯನ್ನು ನಮೂದಿಸಿ' : 'Please provide harvest quantity and price'
                  ) : financials.netReturn >= 0 ? (
                    `${t('calculator.netReturn', 'Net Return')}: ₹${formatNumber(financials.netReturn, 0)}`
                  ) : (
                    `${isKn ? 'ಅಂದಾಜು ನಷ್ಟ' : 'Estimated Deficit'}: ₹${formatNumber(Math.abs(financials.netReturn), 0)}`
                  )}
                </p>
              </div>
            </div>

            {isValid && financials.qty > 0 && financials.grossRevenue > 0 && (
              <div className="text-right">
                <span className={`text-base font-extrabold ${financials.marginPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {formatPercentage(financials.marginPercent)}
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('calculator.marginPercent', 'Net Margin')}</p>
              </div>
            )}
          </div>

          {/* Primary KPI Grid (4 Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

            {/* Gross Revenue */}
            <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-1">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('calculator.grossRevenue', 'Gross Revenue')}</p>
              <p className="text-lg font-bold text-sky-600 dark:text-sky-400">
                ₹{formatNumber(financials.grossRevenue, 0)}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-500">
                {financials.qty} qtl × ₹{financials.price}
              </p>
            </div>

            {/* Total Expenses */}
            <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-1">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('calculator.totalExpenses', 'Total Expenses')}</p>
              <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
                ₹{formatNumber(financials.totalExpenses, 0)}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-500">
                {financials.qty > 0 ? `₹${formatNumber(financials.totalExpenses / financials.qty, 0)}/qtl` : '—'}
              </p>
            </div>

            {/* Net Return */}
            <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-1">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('calculator.netReturn', 'Net Return')}</p>
              <p className={`text-lg font-bold ${financials.netReturn >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                ₹{formatNumber(financials.netReturn, 0)}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-500">
                {financials.netReturn >= 0 ? 'Revenue - Costs' : 'Deficit'}
              </p>
            </div>

            {/* Net Return Per Quintal */}
            <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-1">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('calculator.netReturnPerQuintal', 'Net Return / Qtl')}</p>
              <p className={`text-lg font-bold ${financials.netReturnPerQuintal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                ₹{formatNumber(financials.netReturnPerQuintal, 0)}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-500">INR per quintal</p>
            </div>
          </div>

          {/* Break-Even Highlight Banner */}
          <div className="glass-panel rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <Scale className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">{t('calculator.breakEvenPrice', 'Break-Even Selling Price')}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {isKn
                    ? 'ವೆಚ್ಚ ಭರಿಸಲು ನೀವು ಪಡೆಯಬೇಕಾದ ಕನಿಷ್ಠ ಮಾರಾಟ ಬೆಲೆ'
                    : 'Minimum mandi price required to fully cover post-harvest marketing expenses'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-indigo-700 dark:text-indigo-300">
                ₹{formatNumber(financials.breakEvenPrice, 0)}
              </span>
              <span className="text-xs text-indigo-600 dark:text-indigo-400/80 font-semibold"> / quintal</span>
            </div>
          </div>

          {/* Simple Farmer Language Explanation */}
          <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 shadow-sm">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
              <Info className="w-3.5 h-3.5 text-emerald-600 dark:text-agri-400" />
              <span>{isKn ? 'ಸರಳ ವಿವರಣೆ' : 'Simple Summary for Farmer'}</span>
            </h3>

            {financials.qty <= 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isKn ? 'ಲೆಕ್ಕಾಚಾರ ಆರಂಭಿಸಲು ಬೆಳೆ ಪ್ರಮಾಣವನ್ನು ಸೊನ್ನೆಗಿಂತ ಹೆಚ್ಚಾಗಿ ನಮೂದಿಸಿ.' : 'Enter a harvest quantity greater than zero to view financial summary.'}
              </p>
            ) : financials.netReturn >= 0 ? (
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                {isKn
                  ? `ನಿಮ್ಮ ಒಟ್ಟು ಮಾರಾಟ ಆದಾಯ ₹${formatNumber(financials.grossRevenue, 0)} ರಿಂದ ಒಟ್ಟು ವೆಚ್ಚ ₹${formatNumber(financials.totalExpenses, 0)} ಕಳೆಯಲಾಗಿ, ನಿಮ್ಮ ಅಂದಾಜು ನಿವ್ವಳ ಆದಾಯ ₹${formatNumber(financials.netReturn, 0)} ಆಗಿದೆ (ಕ್ವಿಂಟಾಲಿಗೆ ₹${formatNumber(financials.netReturnPerQuintal, 0)}). ಪ್ರತಿ ಕ್ವಿಂಟಾಲಿಗೆ ₹${formatNumber(financials.breakEvenPrice, 0)} ಕ್ಕಿಂತ ಹೆಚ್ಚಿನ ದರದಲ್ಲಿ ಮಾರಾಟ ಮಾಡಿದರೆ ನೀವು ಲಾಭ ಪಡೆಯುತ್ತೀರಿ.`
                  : `From your gross sales of ₹${formatNumber(financials.grossRevenue, 0)}, after paying ₹${formatNumber(financials.totalExpenses, 0)} in total marketing and logistics expenses, your estimated net return is ₹${formatNumber(financials.netReturn, 0)} (₹${formatNumber(financials.netReturnPerQuintal, 0)} per quintal). Any selling price above your break-even of ₹${formatNumber(financials.breakEvenPrice, 0)}/qtl yields net profit.`}
              </p>
            ) : (
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
                {isKn
                  ? `ನಿಮ್ಮ ಒಟ್ಟು ವೆಚ್ಚ ₹${formatNumber(financials.totalExpenses, 0)} ಒಟ್ಟು ಆದಾಯ ₹${formatNumber(financials.grossRevenue, 0)} ಕ್ಕಿಂತ ₹${formatNumber(Math.abs(financials.netReturn), 0)} ಹೆಚ್ಚಾಗಿದೆ. ನಷ್ಟ ತಪ್ಪಿಸಲು ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ಕನಿಷ್ಠ ₹${formatNumber(financials.breakEvenPrice, 0)}/ಕ್ವಿಂಟಾಲ್ ಮಾರಾಟ ಬೆಲೆ ಪಡೆಯುವುದು ಅಗತ್ಯ.`
                  : `Your expenses of ₹${formatNumber(financials.totalExpenses, 0)} exceed gross sales of ₹${formatNumber(financials.grossRevenue, 0)} by ₹${formatNumber(Math.abs(financials.netReturn), 0)}. You need a selling price of at least ₹${formatNumber(financials.breakEvenPrice, 0)} per quintal at ${selectedMandi.name.split('(')[0].trim()} to avoid a loss.`}
              </p>
            )}
          </div>

          {/* Revenue vs Expenses Visualization Chart */}
          <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>{t('calculator.breakdownTitle', 'Cost & Revenue Breakdown')}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">INR (₹)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* Bar Comparison */}
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonBarData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <XAxis type="number" tickFormatter={v => `₹${formatNumber(v, 0)}`} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 11 }} width={90} />
                    <Tooltip
                      formatter={(val) => [`₹${formatNumber(val, 0)}`, '']}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '11px', color: '#0f172a' }}
                    />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                      {comparisonBarData.map((entry, idx) => (
                        <Cell key={`bar-${idx}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Expense Breakdown List */}
              <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 pt-3 md:pt-0 md:pl-4">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  {isKn ? 'ವೆಚ್ಚಗಳ ವಿಂಗಡಣೆ' : 'Itemized Expenses'}
                </p>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                      <span>{t('calculator.transportationExpense', 'Transport')}</span>
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">₹{formatNumber(financials.transport, 0)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
                      <span>{t('calculator.storageExpense', 'Storage')}</span>
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">₹{formatNumber(financials.storage, 0)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                      <span>{t('calculator.handlingExpense', 'Handling')}</span>
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">₹{formatNumber(financials.handling, 0)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                      <span>{t('calculator.otherExpenses', 'Other')}</span>
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">₹{formatNumber(financials.other, 0)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-900 dark:text-slate-200 border-t border-slate-200 dark:border-slate-800 pt-1.5 font-bold">
                    <span>{t('calculator.totalExpenses', 'Total Expenses')}</span>
                    <span className="text-rose-600 dark:text-rose-400">₹{formatNumber(financials.totalExpenses, 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Disclaimer Note */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3.5 flex items-start gap-2.5 text-[11px] text-slate-600 dark:text-slate-400 shadow-sm">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
            <p>
              {t('calculator.disclaimer', 'DISCLAIMER: This calculation is for educational and planning estimates only. Actual market earnings depend on auction bidding, grading quality, actual transport freight, and market cess. Not guaranteed profit.')}
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};

export default CalculatorPage;
