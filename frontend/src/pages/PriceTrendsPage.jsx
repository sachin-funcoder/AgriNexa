import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  RefreshCw, Info, ChevronDown, BarChart2, Activity,
  Calendar, MapPin, ArrowUpRight, ArrowDownRight, Check
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  BarChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

import { SUPPORTED_CROPS, KARNATAKA_MANDIS } from '../utils/constants';
import { formatCurrency, formatNumber, formatDate, formatPercentage } from '../utils/formatters';
import mandiApi from '../services/mandiApi';

// ─── Date range presets ────────────────────────────────────────────────────────
const DATE_RANGES = [
  { key: '1M', labelEn: '1 Month',  labelKn: '1 ತಿಂಗಳು',  days: 30  },
  { key: '3M', labelEn: '3 Months', labelKn: '3 ತಿಂಗಳು',  days: 90  },
  { key: '6M', labelEn: '6 Months', labelKn: '6 ತಿಂಗಳು',  days: 180 },
  { key: '1Y', labelEn: '1 Year',   labelKn: '1 ವರ್ಷ',    days: 365 },
];

// Helper: Format date for chart X-axis
const formatChartDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

// ─── Custom Tooltip for Price Chart ───────────────────────────────────────────
const PriceTooltip = ({ active, payload, label, isKn }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs shadow-2xl space-y-1.5 min-w-[180px]">
      <p className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1 flex items-center justify-between">
        <span>{data.fullDate || label}</span>
        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">{isKn ? 'ಡೆಮೊ ಡೇಟಾ' : 'Demo Data'}</span>
      </p>
      <div className="space-y-1 pt-0.5">
        <div className="flex items-center justify-between gap-3 text-rose-600 dark:text-rose-300">
          <span>{isKn ? 'ಗರಿಷ್ಠ ಬೆಲೆ' : 'Max Price'}:</span>
          <span className="font-bold">₹{formatNumber(data.max_price, 0)}/qtl</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400 font-semibold">
          <span>{isKn ? 'ಮೋಡಲ್ ಬೆಲೆ' : 'Modal Price'}:</span>
          <span className="font-bold text-slate-900 dark:text-white">₹{formatNumber(data.modal_price, 0)}/qtl</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sky-600 dark:text-sky-300">
          <span>{isKn ? 'ಕನಿಷ್ಠ ಬೆಲೆ' : 'Min Price'}:</span>
          <span className="font-bold">₹{formatNumber(data.min_price, 0)}/qtl</span>
        </div>
        {data.arrival_quantity !== undefined && (
          <div className="flex items-center justify-between gap-3 text-amber-600 dark:text-amber-300 border-t border-slate-200 dark:border-slate-700/60 pt-1 mt-1">
            <span>{isKn ? 'ಆವಕ ಪ್ರಮಾಣ' : 'Arrivals'}:</span>
            <span className="font-bold">{formatNumber(data.arrival_quantity, 0)} qtl</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Custom Tooltip for Arrivals Chart ────────────────────────────────────────
const ArrivalTooltip = ({ active, payload, label, isKn }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs shadow-xl min-w-[150px]">
      <p className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1">{data.fullDate || label}</p>
      <div className="flex items-center justify-between gap-3 text-amber-600 dark:text-amber-400 pt-1">
        <span>{isKn ? 'ಆವಕ' : 'Arrival Volume'}:</span>
        <span className="font-bold text-slate-900 dark:text-white">{formatNumber(data.arrival_quantity, 0)} qtl</span>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HISTORICAL PRICE TRENDS COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const PriceTrendsPage = () => {
  const { t, i18n } = useTranslation();
  const isKn = i18n.language?.startsWith('kn');

  // ─── Selections ─────────────────────────────────────────────────────────────
  const [selectedCrop, setSelectedCrop] = useState(SUPPORTED_CROPS[0]);
  const [selectedMandi, setSelectedMandi] = useState(KARNATAKA_MANDIS[0]);
  const [dateRange, setDateRange] = useState(DATE_RANGES[1]); // 3M default
  const [cropDropdownOpen, setCropDropdownOpen] = useState(false);
  const [mandiDropdownOpen, setMandiDropdownOpen] = useState(false);
  const [showArrivals, setShowArrivals] = useState(true);

  // ─── Data State ─────────────────────────────────────────────────────────────
  const [apiResponse, setApiResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // ─── Fetch Historical Prices ───────────────────────────────────────────────
  const fetchPrices = useCallback(async (cropId, mandiId, days) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await mandiApi.getCropPrices(cropId, {
        mandiId,
        limit: days
      });
      setApiResponse(data);
    } catch (err) {
      setFetchError(err.message || 'Failed to fetch price trend data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices(selectedCrop.id, selectedMandi.id, dateRange.days);
  }, [selectedCrop.id, selectedMandi.id, dateRange.days, fetchPrices]);

  // ─── Process Chronological Chart Data ───────────────────────────────────────
  const chartData = useMemo(() => {
    if (!apiResponse?.prices || !Array.isArray(apiResponse.prices)) return [];

    // Ensure strict chronological order
    const sorted = [...apiResponse.prices].sort((a, b) => a.date.localeCompare(b.date));

    return sorted.map(item => ({
      date: formatChartDate(item.date),
      fullDate: item.date,
      min_price: item.min_price,
      modal_price: item.modal_price,
      max_price: item.max_price,
      arrival_quantity: item.arrival_quantity || 0,
      priceSpread: Math.max(0, (item.max_price || 0) - (item.min_price || 0))
    }));
  }, [apiResponse]);

  // ─── Computed Summary Statistics ────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!chartData.length) return null;

    const modalPrices = chartData.map(d => d.modal_price).filter(p => typeof p === 'number' && !isNaN(p));
    const minPrices = chartData.map(d => d.min_price).filter(p => typeof p === 'number' && !isNaN(p));
    const maxPrices = chartData.map(d => d.max_price).filter(p => typeof p === 'number' && !isNaN(p));
    const arrivals = chartData.map(d => d.arrival_quantity).filter(a => typeof a === 'number' && !isNaN(a));

    if (!modalPrices.length) return null;

    const highest = Math.max(...maxPrices);
    const lowest = Math.min(...minPrices);
    const avgModal = modalPrices.reduce((sum, p) => sum + p, 0) / modalPrices.length;
    const latestModal = modalPrices[modalPrices.length - 1];
    const earliestModal = modalPrices[0];

    const priceChange = latestModal - earliestModal;
    const priceChangePct = earliestModal > 0 ? (priceChange / earliestModal) * 100 : 0;

    const totalArrival = arrivals.reduce((sum, a) => sum + a, 0);
    const avgArrival = arrivals.length ? totalArrival / arrivals.length : 0;

    return {
      highest,
      lowest,
      avgModal,
      latestModal,
      priceChange,
      priceChangePct,
      avgArrival,
      totalArrival,
      recordCount: chartData.length
    };
  }, [chartData]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-agri-400" />
            <span>{t('priceTrends.title', 'Historical Mandi Price Trends')}</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            {t('priceTrends.subtitle', 'Track historical auction prices, arrival volumes, and price fluctuations across Karnataka APMC market yards.')}
          </p>
        </div>

        {/* Demo Data Disclaimer Badge */}
        <div className="flex items-center space-x-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 px-3.5 py-2 text-xs text-amber-900 dark:text-amber-300 shadow-sm max-w-md">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="leading-tight">
            {t('priceTrends.demoBanner', 'SIMULATED DEMONSTRATION DATA: All prices and arrivals are generated for demonstration purposes and do not represent actual live market quotes.')}
          </span>
        </div>
      </div>

      {/* ── Filter / Control Bar ─────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">

          {/* Crop Selector Dropdown */}
          <div className="relative">
            <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
              {t('priceTrends.selectCrop', 'Select Crop')}
            </label>
            <button
              id="crop-selector-btn"
              onClick={() => {
                setCropDropdownOpen(prev => !prev);
                setMandiDropdownOpen(false);
              }}
              className="flex items-center justify-between gap-3 min-w-[180px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-agri-500 text-slate-900 dark:text-white text-sm font-medium transition-colors shadow-sm"
            >
              <span className="flex items-center gap-2">
                <span className="text-base">{selectedCrop.icon}</span>
                <span>{isKn ? selectedCrop.name_kn : selectedCrop.name_en}</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform ${cropDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {cropDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-40 overflow-hidden py-1">
                {SUPPORTED_CROPS.map(crop => (
                  <button
                    key={crop.id}
                    onClick={() => {
                      setSelectedCrop(crop);
                      setCropDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                      selectedCrop.id === crop.id ? 'text-emerald-700 dark:text-agri-400 bg-emerald-50 dark:bg-agri-950/40 font-semibold' : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{crop.icon}</span>
                      <span>{isKn ? crop.name_kn : crop.name_en}</span>
                    </span>
                    {selectedCrop.id === crop.id && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-agri-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mandi Selector Dropdown */}
          <div className="relative">
            <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
              {t('priceTrends.selectMandi', 'Select Mandi')}
            </label>
            <button
              id="mandi-selector-btn"
              onClick={() => {
                setMandiDropdownOpen(prev => !prev);
                setCropDropdownOpen(false);
              }}
              className="flex items-center justify-between gap-3 min-w-[220px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-agri-500 text-slate-900 dark:text-white text-sm font-medium transition-colors shadow-sm"
            >
              <span className="flex items-center gap-2 truncate">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-agri-400 flex-shrink-0" />
                <span className="truncate">{selectedMandi.name.split('(')[0].trim()}</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform ${mandiDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {mandiDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-72 max-h-64 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-40 py-1">
                {KARNATAKA_MANDIS.map(mandi => (
                  <button
                    key={mandi.id}
                    onClick={() => {
                      setSelectedMandi(mandi);
                      setMandiDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                      selectedMandi.id === mandi.id ? 'text-emerald-700 dark:text-agri-400 bg-emerald-50 dark:bg-agri-950/40 font-semibold' : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{mandi.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{mandi.district}, Karnataka</p>
                    </div>
                    {selectedMandi.id === mandi.id && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-agri-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date Range Tabs */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
              {t('priceTrends.dateRange', 'Date Range')}
            </label>
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-xl p-1 gap-1 border border-slate-200 dark:border-slate-800">
              {DATE_RANGES.map(range => (
                <button
                  key={range.key}
                  onClick={() => setDateRange(range)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    dateRange.key === range.key
                      ? 'bg-agri-600 text-white shadow'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {isKn ? range.labelKn : range.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Arrivals View */}
          <div className="ml-auto flex items-end">
            <button
              onClick={() => setShowArrivals(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all mt-auto shadow-sm ${
                showArrivals
                  ? 'bg-amber-100/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>{showArrivals ? t('priceTrends.hideArrivals', 'Hide Arrivals') : t('priceTrends.showArrivals', 'Show Arrivals')}</span>
            </button>
          </div>
        </div>

        {/* Selected Context Bar */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              {isKn ? selectedCrop.name_kn : selectedCrop.name_en}
            </span>
            <span>•</span>
            <span className="text-emerald-700 dark:text-agri-400 font-medium">{selectedMandi.name}</span>
            <span>•</span>
            <span>{isKn ? `${dateRange.days} ದಿನಗಳ ಅವಧಿ` : `Last ${dateRange.days} days`}</span>
          </div>
          {stats && (
            <span className="text-[11px] text-slate-500 dark:text-slate-500">
              {stats.recordCount} {isKn ? 'ದೈನಂದಿನ ದಾಖಲೆಗಳು' : 'chronological price observations'}
            </span>
          )}
        </div>
      </div>

      {/* ── KPI Summary Cards ────────────────────────────────────────────── */}
      {stats && !isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Highest Price */}
          <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-1">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('priceTrends.highestPrice', 'Highest Observed Price')}</p>
            <p className="text-lg font-bold text-rose-600 dark:text-rose-400">₹{formatNumber(stats.highest, 0)}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-500">INR / quintal</p>
          </div>

          {/* Lowest Price */}
          <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-1">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('priceTrends.lowestPrice', 'Lowest Observed Price')}</p>
            <p className="text-lg font-bold text-sky-600 dark:text-sky-400">₹{formatNumber(stats.lowest, 0)}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-500">INR / quintal</p>
          </div>

          {/* Average Modal Price */}
          <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-1">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('priceTrends.avgModalPrice', 'Average Modal Price')}</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-agri-400">₹{formatNumber(stats.avgModal, 0)}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-500">INR / quintal</p>
          </div>

          {/* Latest Available Price */}
          <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-1">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('priceTrends.latestPrice', 'Latest Available Price')}</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">₹{formatNumber(stats.latestModal, 0)}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-500">INR / quintal</p>
          </div>

          {/* Period Change */}
          <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-1 col-span-2 md:col-span-1">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t('priceTrends.periodChange', 'Period Price Change')}</p>
            <div className="flex items-center gap-1.5">
              {stats.priceChange > 0 ? (
                <ArrowUpRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : stats.priceChange < 0 ? (
                <ArrowDownRight className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              ) : (
                <Minus className="w-5 h-5 text-slate-400" />
              )}
              <span className={`text-lg font-bold ${
                stats.priceChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : stats.priceChange < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
              }`}>
                {stats.priceChange > 0 ? '+' : ''}₹{formatNumber(Math.abs(stats.priceChange), 0)}
              </span>
            </div>
            <p className={`text-[10px] font-semibold ${
              stats.priceChange > 0 ? 'text-emerald-700 dark:text-emerald-400/90' : stats.priceChange < 0 ? 'text-rose-700 dark:text-rose-400/90' : 'text-slate-500 dark:text-slate-500'
            }`}>
              {formatPercentage(stats.priceChangePct)} over {dateRange.days} days
            </p>
          </div>
        </div>
      )}

      {/* ── Main Price Chart ──────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600 dark:text-agri-400" />
              <span>{t('priceTrends.priceChartTitle', 'Auction Price Trend (Min, Modal, Max)')}</span>
            </h2>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              {t('priceTrends.priceChartSubtitle', 'Daily minimum, modal, and maximum prices in INR per quintal')}
            </p>
          </div>

          {/* Chart Legend Labels */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-300">
              <span className="w-3 h-0.5 bg-rose-500 dark:bg-rose-400 rounded-full inline-block" />
              <span>{t('priceTrends.maxPrice', 'Max Price')}</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
              <span className="w-3 h-1 bg-emerald-600 dark:bg-emerald-400 rounded-full inline-block" />
              <span>{t('priceTrends.modalPrice', 'Modal Price')}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-300">
              <span className="w-3 h-0.5 bg-sky-500 dark:bg-sky-400 rounded-full inline-block" />
              <span>{t('priceTrends.minPrice', 'Min Price')}</span>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="h-72 flex items-center justify-center">
            <div className="text-center space-y-2">
              <RefreshCw className="w-8 h-8 text-agri-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">{t('priceTrends.loading', 'Loading historical price data...')}</p>
            </div>
          </div>
        ) : fetchError ? (
          /* Error State */
          <div className="h-72 flex items-center justify-center text-center p-6 space-y-2">
            <div>
              <AlertTriangle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto mb-2" />
              <p className="text-sm text-rose-600 dark:text-rose-300 font-semibold">{fetchError}</p>
              <button
                onClick={() => fetchPrices(selectedCrop.id, selectedMandi.id, dateRange.days)}
                className="mt-3 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-white border border-slate-300 dark:border-slate-700 transition-colors"
              >
                {t('common.refresh', 'Refresh')}
              </button>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          /* Empty State */
          <div className="h-72 flex items-center justify-center text-center p-6 text-slate-400 text-xs">
            {t('priceTrends.noData', 'No price records found for the selected commodity, mandi, and date range.')}
          </div>
        ) : (
          /* Recharts Interactive Price Line Chart */
          <div className="h-80 sm:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="modalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#1e293b' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `₹${formatNumber(v, 0)}`}
                  width={64}
                />
                <Tooltip content={<PriceTooltip isKn={isKn} />} />

                {/* Maximum Price Line (upper bound) */}
                <Line
                  type="monotone"
                  dataKey="max_price"
                  name={t('priceTrends.maxPrice', 'Max Price')}
                  stroke="#fb7185"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                />

                {/* Shaded Modal Area */}
                <Area
                  type="monotone"
                  dataKey="modal_price"
                  name={t('priceTrends.modalPrice', 'Modal Price')}
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#modalGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#10b981' }}
                />

                {/* Minimum Price Line (lower bound) */}
                <Line
                  type="monotone"
                  dataKey="min_price"
                  name={t('priceTrends.minPrice', 'Min Price')}
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Arrival Volume Bar Chart (Chronologically Synchronized) ─────── */}
      {showArrivals && !isLoading && !fetchError && chartData.length > 0 && (
        <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>{t('priceTrends.arrivalChartTitle', 'Daily Arrival Volume')}</span>
              </h2>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                {t('priceTrends.arrivalChartSubtitle', 'Volume of commodity entering the mandi in quintals')}
              </p>
            </div>
            {stats && (
              <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                {isKn ? 'ದೈನಂದಿನ ಸರಾಸರಿ ಆವಕ' : 'Avg Daily'}: {formatNumber(stats.avgArrival, 0)} qtl
              </span>
            )}
          </div>

          <div className="h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b833' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `${formatNumber(v, 0)}q`}
                  width={56}
                />
                <Tooltip content={<ArrivalTooltip isKn={isKn} />} />
                <Bar
                  dataKey="arrival_quantity"
                  name={t('priceTrends.arrivalQuantity', 'Arrivals')}
                  fill="#f59e0b"
                  opacity={0.7}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Explicit Disclaimer Footer ────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3.5 flex items-start gap-2.5 text-[11px] text-slate-600 dark:text-slate-400">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-500" />
        <p>
          {isKn
            ? 'ಗಮನಿಸಿ: ಇಲ್ಲಿ ತೋರಿಸಲಾದ ಐತಿಹಾಸಿಕ ಬೆಲೆ ಮತ್ತು ಆವಕಗಳು ತರಬೇತಿಗಾಗಿ ಅನುಕರಿಸಲಾದ ಕೃತಕ (Synthetic) ಡೆಮೊ ಡೇಟಾವಾಗಿದ್ದು, ಅಧಿಕೃತ ಮಂಡಿ ಬೆಲೆಗಳಲ್ಲ. ಈ ಡೇಟಾವನ್ನು ನೈಜ ವ್ಯಾಪಾರ ಅಥವಾ ಹೂಡಿಕೆ ನಿರ್ಧಾರಗಳಿಗೆ ಬಳಸಬೇಡಿ.'
            : 'Notice: Historical prices and arrival volumes shown are generated from reproducible synthetic demonstration data and do not represent actual live mandi transactions. Do not base binding trade or financial commitments on these figures.'}
        </p>
      </div>

    </div>
  );
};

export default PriceTrendsPage;
