import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowRight, 
  Store, 
  Sparkles, 
  AlertTriangle, 
  ShieldCheck, 
  Truck, 
  Calendar,
  Layers,
  Info,
  RefreshCw,
  AlertCircle,
  Activity,
  MapPin,
  PieChart,
  Bot
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';

import { SUPPORTED_CROPS } from '../utils/constants';
import { formatCurrency, formatNumber, formatDate } from '../utils/formatters';
import mandiApi from '../services/mandiApi';
import { PageHeader } from '../components/ui/PageHeader';
import { KPIStatCard } from '../components/ui/KPIStatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { CardSkeleton, TableSkeleton } from '../components/ui/LoadingSkeleton';
import { PrimaryButton, SecondaryButton } from '../components/ui/Button';

const DashboardPage = () => {
  const { t, i18n } = useTranslation();
  const isKn = i18n.language.startsWith('kn');
  
  // Selected commodity state (default to Tomato)
  const [selectedCrop, setSelectedCrop] = useState(SUPPORTED_CROPS[0]);

  // Data fetching states
  const [dashboardData, setDashboardData] = useState(null);
  const [cropPricesData, setCropPricesData] = useState(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [priceError, setPriceError] = useState(null);

  // Request race condition guard
  const activeCropRequestRef = useRef(selectedCrop.id);

  // 1. Fetch High-Level Dashboard Summary
  const loadDashboard = async () => {
    setIsLoadingDashboard(true);
    setDashboardError(null);
    try {
      const data = await mandiApi.getDashboardSummary();
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to load dashboard summary:', err);
      setDashboardError(err.message || t('dashboard.server_offline_desc'));
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // 2. Fetch Time-Series & Mandi Prices for Selected Crop
  const loadCropPrices = async (cropId) => {
    activeCropRequestRef.current = cropId;
    setIsLoadingPrices(true);
    setPriceError(null);

    try {
      const data = await mandiApi.getCropPrices(cropId, { limit: 250 });
      if (activeCropRequestRef.current === cropId) {
        setCropPricesData(data);
      }
    } catch (err) {
      if (activeCropRequestRef.current === cropId) {
        console.error(`Failed to load prices for crop ${cropId}:`, err);
        setPriceError(err.message || 'Unable to load mandi price trends');
      }
    } finally {
      if (activeCropRequestRef.current === cropId) {
        setIsLoadingPrices(false);
      }
    }
  };

  useEffect(() => {
    loadCropPrices(selectedCrop.id);
  }, [selectedCrop.id]);

  // Extract crop card summary matching selected crop
  const activeCard = useMemo(() => {
    if (!dashboardData?.crop_cards) return null;
    return dashboardData.crop_cards.find(c => c.crop_id === selectedCrop.id) || dashboardData.crop_cards[0];
  }, [dashboardData, selectedCrop.id]);

  // Prepare aggregated 30-day time-series data for chart
  const chartData = useMemo(() => {
    if (!cropPricesData?.prices?.length) return [];
    
    const byDate = {};
    cropPricesData.prices.forEach(p => {
      if (!byDate[p.date]) {
        byDate[p.date] = {
          date: p.date,
          modalSum: 0,
          minSum: 0,
          maxSum: 0,
          arrivalSum: 0,
          count: 0
        };
      }
      byDate[p.date].modalSum += p.modal_price;
      byDate[p.date].minSum += p.min_price;
      byDate[p.date].maxSum += p.max_price;
      byDate[p.date].arrivalSum += (p.arrival_quantity || 0);
      byDate[p.date].count += 1;
    });

    return Object.values(byDate)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-30)
      .map(d => ({
        dateLabel: formatDate(d.date, isKn ? 'kn' : 'en').split(',')[0],
        fullDate: d.date,
        modalPrice: Math.round(d.modalSum / d.count),
        minPrice: Math.round(d.minSum / d.count),
        maxPrice: Math.round(d.maxSum / d.count),
        arrivals: Math.round(d.arrivalSum)
      }));
  }, [cropPricesData, isKn]);

  // Latest single-day snapshot across mandis
  const mandiRows = useMemo(() => {
    if (!cropPricesData?.prices?.length) return [];

    const latestDate = cropPricesData.prices.reduce((latest, p) => 
      p.date > latest ? p.date : latest, 
      cropPricesData.prices[0].date
    );

    return cropPricesData.prices
      .filter(p => p.date === latestDate)
      .sort((a, b) => b.modal_price - a.modal_price);
  }, [cropPricesData]);

  // Price direction flag
  const isPriceUp = (activeCard?.price_change_percent || 0) >= 0;

  // Custom Chart Tooltip
  const CustomChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white/95 dark:bg-slate-900/95 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shadow-xl space-y-1 backdrop-blur-md">
          <p className="font-semibold text-slate-800 dark:text-slate-300">{formatDate(data.fullDate, isKn ? 'kn' : 'en')}</p>
          <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
            {t('dashboard.table_modal')}: {formatCurrency(data.modalPrice)} {t('common.per_quintal')}
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-[11px]">
            {t('dashboard.table_min')}: {formatCurrency(data.minPrice)} | {t('dashboard.table_max')}: {formatCurrency(data.maxPrice)}
          </p>
          {data.arrivals > 0 && (
            <p className="text-amber-700 dark:text-amber-400 text-[11px] font-medium">
              {t('dashboard.table_arrivals')}: {formatNumber(data.arrivals, 0)} {t('common.quintals')}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Synthetic Demonstration Mode Notice Banner */}
      <div className="rounded-xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-3 sm:p-4 text-xs text-amber-900 dark:text-amber-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm backdrop-blur">
        <div className="flex items-center space-x-2.5">
          <span className="px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px] bg-amber-100 border border-amber-300 text-amber-800 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-300">
            {t('dashboard.demo_badge')}
          </span>
          <p className="leading-relaxed">
            {t('dashboard.demo_disclosure')}
          </p>
        </div>
        {dashboardData?.date_of_data && (
          <span className="text-[11px] text-amber-800 dark:text-amber-400/90 whitespace-nowrap self-end sm:self-center font-medium">
            Benchmark: {dashboardData.date_of_data}
          </span>
        )}
      </div>

      {/* Backend Connection Error Banner */}
      {dashboardError && (
        <div className="rounded-2xl border border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/60 p-5 text-xs text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm dark:shadow-xl">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-rose-900 dark:text-rose-300">{t('dashboard.server_offline_title')}</h4>
              <p className="mt-1 text-rose-700 dark:text-rose-300/80 leading-relaxed">{dashboardError}</p>
            </div>
          </div>
          <button
            onClick={loadDashboard}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl font-semibold bg-rose-600 hover:bg-rose-700 dark:bg-rose-900/80 dark:hover:bg-rose-800 border border-rose-600 dark:border-rose-700 text-white transition-all whitespace-nowrap active:scale-95 shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{t('dashboard.retry_btn')}</span>
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        badge={isKn ? 'ಕರ್ನಾಟಕ ಕೃಷಿ ಮಾರುಕಟ್ಟೆ ಬುದ್ಧಿಮತ್ತೆ' : 'Karnataka APMC Intelligence Command'}
        title={t('dashboard.welcome')}
        subtitle={`${t('dashboard.subtitle')}. ${isKn ? 'ನಿಮ್ಮ ಬೆಳೆ ಮಾರಾಟ ನಿರ್ಧಾರಗಳನ್ನು ನೈಜ ಡೇಟಾ ಮೂಲಕ ಅತ್ಯುತ್ತಮಗೊಳಿಸಿ.' : 'Gain clear foresight into spot price trends, mandi arrivals, and harvest selling schedules.'}`}
      >
        <Link to="/chat">
          <PrimaryButton size="sm" icon={Bot}>
            {isKn ? 'ಕೃಷಿ AI ಧ್ವನಿ' : 'Ask Krishi AI'}
          </PrimaryButton>
        </Link>
      </PageHeader>

      {/* Crop Selector Tabs */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
          {t('dashboard.quick_crop_selector')}
        </label>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_CROPS.map((crop) => {
            const isSelected = crop.id === selectedCrop.id;
            return (
              <button
                key={crop.id}
                onClick={() => setSelectedCrop(crop)}
                className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md border border-emerald-400 scale-[1.03]'
                    : 'bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
                }`}
              >
                <span>{isKn ? crop.name_kn : crop.name_en}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 4 Core KPIs ─────────────────────────────────────────────────────────── */}
      {isLoadingDashboard ? (
        <CardSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* 1. Modal Price KPI */}
          <KPIStatCard
            title={`${isKn ? selectedCrop.name_kn : selectedCrop.name_en} ${t('dashboard.kpi_modal_price')}`}
            value={activeCard?.latest_modal_price ? activeCard.latest_modal_price : '—'}
            prefix="₹"
            suffix={` ${t('common.per_quintal')}`}
            trend={activeCard ? `${Math.abs(activeCard.price_change_percent || 0).toFixed(1)}%` : null}
            trendDirection={activeCard?.price_change_percent >= 0 ? 'up' : 'down'}
            subtitle={activeCard?.highest_mandi ? `Best: ${activeCard.highest_mandi}` : 'Across Mandis'}
            icon={TrendingUp}
            variant="emerald"
          />

          {/* 2. 7-Day Price Momentum */}
          <KPIStatCard
            title={t('dashboard.kpi_price_trend')}
            value={activeCard ? `${isPriceUp ? '+' : ''}${(activeCard.price_change_percent || 0).toFixed(1)}%` : '—'}
            trend={isPriceUp ? 'Bullish' : 'Bearish'}
            trendDirection={isPriceUp ? 'up' : 'down'}
            subtitle={isPriceUp ? 'Upward price momentum' : 'Supply pressure detected'}
            icon={Activity}
            variant="teal"
          />

          {/* 3. Active Mandis Monitored */}
          <KPIStatCard
            title={t('dashboard.kpi_active_mandis')}
            value={dashboardData?.mandis_monitored || 8}
            subtitle="Karnataka APMCs Monitored"
            icon={Store}
          />

          {/* 4. Action Advisory KPI */}
          <KPIStatCard
            title={t('dashboard.kpi_recommended_action')}
            value={activeCard?.advisory_action ? (isKn ? activeCard.advisory_action_kn : activeCard.advisory_action) : 'Hold / Stagger'}
            subtitle={activeCard?.advisory_reason ? (isKn ? activeCard.advisory_reason_kn : activeCard.advisory_reason) : 'Monitor daily arrival trends'}
            icon={ShieldCheck}
            variant="amber"
          />
        </div>
      )}

      {/* ─── Chart & Quick Action Sidebar ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Price Trend Area Chart (8 Cols) */}
        <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-slate-900/85 border border-slate-200 dark:border-slate-800/80 p-5 sm:p-6 shadow-sm dark:shadow-xl backdrop-blur-md space-y-4 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t('dashboard.chart_title')}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isKn ? `${selectedCrop.name_kn} ಸರಾಸರಿ ಮಾದರಿ ದರದ 30 ದಿನಗಳ ಇತಿಹಾಸ` : `30-day average modal price trajectory for ${selectedCrop.name_en}`}
              </p>
            </div>
            <StatusBadge variant="teal" size="sm" dot>
              {chartData.length} Observations
            </StatusBadge>
          </div>

          {isLoadingPrices ? (
            <div className="h-64 sm:h-72 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : priceError ? (
            <div className="h-64 sm:h-72 flex items-center justify-center text-xs text-rose-500 dark:text-rose-400">
              {priceError}
            </div>
          ) : chartData.length > 0 ? (
            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorModal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} vertical={false} />
                  <XAxis 
                    dataKey="dateLabel" 
                    stroke="#64748b" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={{ stroke: '#94a3b8', strokeOpacity: 0.3 }} 
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={{ stroke: '#94a3b8', strokeOpacity: 0.3 }} 
                    domain={['dataMin - 100', 'dataMax + 100']}
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="modalPrice" 
                    stroke="#10b981" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorModal)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 sm:h-72 flex items-center justify-center text-xs text-slate-500">
              {t('common.no_data')}
            </div>
          )}

          {/* Quick Explanatory Strip */}
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span>{isKn ? 'ಮಾದರಿ ಬೆಲೆಯು ಸಾಮಾನ್ಯ ಹರಾಜು ಮೌಲ್ಯವನ್ನು ಪ್ರತಿಬಿಂಬಿಸುತ್ತದೆ' : 'Modal price indicates the highest-volume traded price band'}</span>
            <Link to="/price-trends" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold inline-flex items-center gap-1">
              <span>{isKn ? '14 ದಿನಗಳ ಭವಿಷ್ಯ ನೋಡಿ' : 'View 14-Day Forecast'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Quick Intelligence Action Cards (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Smart Mandi Comparison Card */}
          <Link
            to="/mandi-compare"
            className="block p-5 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-emerald-950/40 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 shadow-sm dark:shadow-lg hover:shadow-md dark:hover:shadow-emerald-950/30 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950 group-hover:border-emerald-300 dark:group-hover:border-emerald-700 border border-slate-200 dark:border-slate-700 transition-colors">
                <MapPin className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                Freight Solver
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
              {isKn ? 'ಸ್ಮಾರ್ಟ್ ಮಂಡಿ ಹೋಲಿಕೆ' : 'Compare Mandi Net Returns'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {isKn ? 'ಡೀಸೆಲ್ ವೆಚ್ಚ ಕಳೆದು ಅತ್ಯಧಿಕ ಹಣ ನೀಡುವ ಮಂಡಿ ಪರಿಶೀಲಿಸಿ.' : 'Deduct road transport freight and APMC fees to identify your best profit yard.'}
            </p>
          </Link>

          {/* Harvest Split Optimizer Card */}
          <Link
            to="/harvest-split"
            className="block p-5 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-teal-950/40 border border-slate-200 dark:border-slate-800 hover:border-teal-500/50 shadow-sm dark:shadow-lg hover:shadow-md dark:hover:shadow-teal-950/30 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-teal-600 dark:text-teal-400 group-hover:bg-teal-50 dark:group-hover:bg-teal-950 group-hover:border-teal-300 dark:group-hover:border-teal-700 border border-slate-200 dark:border-slate-700 transition-colors">
                <PieChart className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-300 dark:border-teal-800">
                Linear Solver
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-300 transition-colors">
              {isKn ? 'ಕೊಯ್ಲು ವಿಭಜನೆ ಆಪ್ಟಿಮೈಜರ್' : 'Multi-Mandi Harvest Split'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {isKn ? 'ತಕ್ಷಣ ಮಾರಾಟ vs ಗೋದಾಮಿನ ಶೇಖರಣೆಯನ್ನು ಸಮತೋಲನಗೊಳಿಸಿ.' : 'Balance day-0 immediate sales against storage to protect against market glut crashes.'}
            </p>
          </Link>

          {/* AI Prediction Protection Card */}
          <Link
            to="/prediction-protection"
            className="block p-5 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-amber-950/30 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 shadow-sm dark:shadow-lg hover:shadow-md dark:hover:shadow-amber-950/30 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 group-hover:bg-amber-50 dark:group-hover:bg-amber-950 group-hover:border-amber-300 dark:group-hover:border-amber-700 border border-slate-200 dark:border-slate-700 transition-colors">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                35% Buffer
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors">
              {isKn ? '35% ಎಐ ಬೆಲೆ ರಕ್ಷಣೆ' : 'AI Prediction Protection'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {isKn ? 'ಎಐ ಗುರಿಗಿಂತ ಬೆಲೆ ಕುಸಿದಾಗ ಪ್ರಸ್ತಾವಿತ 35% ಪರಿಶೀಲಿಸಿದ ನಷ್ಟ ರಕ್ಷಣೆ.' : 'Proposed 35% verified loss buffer when APMC spot crashes below predicted target.'}
            </p>
          </Link>
        </div>
      </div>

      {/* ─── Karnataka APMC Price Snapshot Table ─────────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/85 border border-slate-200 dark:border-slate-800/80 p-5 sm:p-6 shadow-sm dark:shadow-xl backdrop-blur-md space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t('dashboard.table_title')} ({isKn ? selectedCrop.name_kn : selectedCrop.name_en})</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('dashboard.table_subtitle')}
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 self-start sm:self-center">
            {mandiRows.length} {isKn ? 'ಮಂಡಿಗಳು' : 'Active Yards'}
          </span>
        </div>

        {isLoadingPrices ? (
          <TableSkeleton rows={5} cols={6} />
        ) : mandiRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3 px-3">{t('dashboard.table_mandi')}</th>
                  <th className="py-3 px-3">{t('dashboard.table_district')}</th>
                  <th className="py-3 px-3 text-right">{t('dashboard.table_min')}</th>
                  <th className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">{t('dashboard.table_modal')}</th>
                  <th className="py-3 px-3 text-right">{t('dashboard.table_max')}</th>
                  <th className="py-3 px-3 text-right">{t('dashboard.table_arrivals')}</th>
                  <th className="py-3 px-3 text-right">{t('dashboard.table_date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {mandiRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                      {row.mandi_name || row.mandi_id}
                    </td>
                    <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                      {row.mandi_name?.split(' ')[0] || 'Karnataka'}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                      {formatCurrency(row.min_price)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                      {formatCurrency(row.modal_price)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                      {formatCurrency(row.max_price)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                      {row.arrival_quantity ? `${formatNumber(row.arrival_quantity, 0)} qtl` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-500 dark:text-slate-400 text-xs">
                      {formatDate(row.date, isKn ? 'kn' : 'en')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-slate-400">
            {t('common.no_data')}
          </div>
        )}
      </div>

    </div>
  );
};

export default DashboardPage;
