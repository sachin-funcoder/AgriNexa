import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Layers, Cpu, ChevronDown, Check, AlertTriangle, Info,
  TrendingUp, Package, Warehouse, Bug, ShieldAlert,
  Loader2, Calendar, MapPin, Truck, Snowflake, Sun,
  BarChart3, Table2, Settings2, MessageSquare
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from 'recharts';

import { SUPPORTED_CROPS, KARNATAKA_MANDIS } from '../utils/constants';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatters';
import mandiApi from '../services/mandiApi';

// ─── Status badge colour helper ─────────────────────────────────────────────
const statusStyle = (s) => {
  if (s === 'optimal')  return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/60';
  if (s === 'feasible') return 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-700/60';
  return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600';
};

const HarvestSplitPage = () => {
  const { t, i18n } = useTranslation();
  const isKn = i18n.language?.startsWith('kn');

  // ─── Form State ──────────────────────────────────────────────────────────
  const [selectedCrop, setSelectedCrop] = useState(SUPPORTED_CROPS[0]);
  const [cropOpen, setCropOpen] = useState(false);
  const [originMandi, setOriginMandi] = useState(KARNATAKA_MANDIS.find(m => m.id === 'mandi_kolar') || KARNATAKA_MANDIS[0]);
  const [originOpen, setOriginOpen] = useState(false);
  const [harvestQty, setHarvestQty] = useState('100');
  const [harvestDate, setHarvestDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [storageCapacity, setStorageCapacity] = useState('60');
  const [storageType, setStorageType] = useState('ambient');
  const [storageCost, setStorageCost] = useState('');
  const [dailyCapacity, setDailyCapacity] = useState('');
  const [maxDays, setMaxDays] = useState('');
  const [riskPref, setRiskPref] = useState('balanced');
  const [selectedMandis, setSelectedMandis] = useState([]);
  const [mandiPickerOpen, setMandiPickerOpen] = useState(false);

  // ─── Result / UX State ───────────────────────────────────────────────────
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ─── Mandi multi-select toggle ───────────────────────────────────────────
  const toggleMandiSelection = (mandiId) => {
    setSelectedMandis(prev =>
      prev.includes(mandiId) ? prev.filter(id => id !== mandiId) : [...prev, mandiId]
    );
  };

  // ─── Submit optimisation ─────────────────────────────────────────────────
  const runOptimisation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        crop_id: selectedCrop.id,
        total_harvest_qty: parseFloat(harvestQty) || 100,
        harvest_date: harvestDate,
        origin_mandi_id: originMandi.id,
        storage_capacity_qty: parseFloat(storageCapacity) || 0,
        storage_type: storageType,
        risk_preference: riskPref,
      };
      if (selectedMandis.length > 0) payload.preferred_mandi_ids = selectedMandis;
      if (storageCost !== '') payload.storage_cost_per_qtl_day = parseFloat(storageCost);
      if (dailyCapacity !== '') payload.daily_selling_capacity = parseFloat(dailyCapacity);
      if (maxDays !== '') payload.max_storage_days = parseInt(maxDays, 10);

      const data = await mandiApi.optimizeHarvestSplit(payload);
      setResult(data);
    } catch (err) {
      if (err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error')) {
        setError(t('harvestSplit.backend_offline'));
      } else if (err?.response?.data?.detail) {
        setError(`${t('harvestSplit.error_prefix')}: ${err.response.data.detail}`);
      } else {
        setError(`${t('harvestSplit.error_prefix')}: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCrop, harvestQty, harvestDate, originMandi, storageCapacity, storageType, riskPref, selectedMandis, storageCost, dailyCapacity, maxDays, t]);

  // ─── Chart Data Helpers ──────────────────────────────────────────────────
  const inventoryChartData = result?.daily_inventory?.map(r => ({
    name: `D${r.day}`,
    end: parseFloat(r.end_inventory?.toFixed(1)),
    spoilage: parseFloat(r.spoilage_loss?.toFixed(1)),
    sales: parseFloat(r.sales_volume?.toFixed(1)),
  })) || [];

  const financialChartData = result ? [
    { name: isKn ? 'ಒಟ್ಟು ಆದಾಯ' : 'Gross', amount: result.financial_summary?.total_gross_revenue || 0, fill: '#38bdf8' },
    { name: isKn ? 'ವೆಚ್ಚ' : 'Expenses', amount: result.financial_summary?.total_expenses || 0, fill: '#fb7185' },
    { name: isKn ? 'ನಿವ್ವಳ' : 'Net', amount: Math.max(0, result.financial_summary?.expected_net_return || 0), fill: '#10b981' },
  ] : [];

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Layers className="w-6 h-6 text-harvest-600 dark:text-harvest-400" />
            <span>{t('harvestSplit.title')}</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{t('harvestSplit.subtitle')}</p>
        </div>
      </div>

      {/* Demo Banner */}
      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/50 p-3 text-xs text-amber-900 dark:text-amber-300 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <span>{t('harvestSplit.demo_banner')}</span>
      </div>

      {/* Zero Storage Info */}
      {parseFloat(storageCapacity) === 0 && (
        <div className="rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-300 dark:border-sky-700/50 p-3 text-xs text-sky-900 dark:text-sky-300 flex items-center gap-2">
          <Info className="w-4 h-4 flex-shrink-0 text-sky-600 dark:text-sky-400" />
          <span>{t('harvestSplit.zero_storage_info')}</span>
        </div>
      )}

      {/* ── Two-Column Layout ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── LEFT: Input Panel (5 cols) ─────────────────────────────────── */}
        <div className="lg:col-span-5 space-y-5">

          {/* Crop & Origin */}
          <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Package className="w-4 h-4 text-emerald-400" />
              <span>{isKn ? 'ಬೆಳೆ ಮತ್ತು ಮೂಲ' : 'Crop & Origin'}</span>
            </h2>

            {/* Crop Selector */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('harvestSplit.crop_label')}</label>
              <button type="button"
                onClick={() => { setCropOpen(p => !p); setOriginOpen(false); setMandiPickerOpen(false); }}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium hover:border-agri-500 transition-colors shadow-sm"
              >
                <span className="flex items-center gap-2">
                  <span>{selectedCrop.icon}</span>
                  <span>{isKn ? selectedCrop.name_kn : selectedCrop.name_en}</span>
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {cropOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-40 max-h-56 overflow-y-auto py-1">
                  {SUPPORTED_CROPS.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => { setSelectedCrop(c); setCropOpen(false); }}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${selectedCrop.id === c.id ? 'text-emerald-700 dark:text-agri-400 font-bold bg-emerald-50 dark:bg-agri-950/30' : 'text-slate-700 dark:text-slate-200'}`}
                    >
                      <span className="flex items-center gap-2"><span>{c.icon}</span><span>{isKn ? c.name_kn : c.name_en}</span></span>
                      {selectedCrop.id === c.id && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-agri-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Origin Mandi */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-sky-500 dark:text-sky-400" />{t('harvestSplit.origin_mandi_label')}</span>
              </label>
              <button type="button"
                onClick={() => { setOriginOpen(p => !p); setCropOpen(false); setMandiPickerOpen(false); }}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium hover:border-agri-500 transition-colors shadow-sm"
              >
                <span className="truncate">{originMandi.name}</span>
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </button>
              {originOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-40 max-h-56 overflow-y-auto py-1">
                  {KARNATAKA_MANDIS.map(m => (
                    <button key={m.id} type="button"
                      onClick={() => { setOriginMandi(m); setOriginOpen(false); }}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${originMandi.id === m.id ? 'text-emerald-700 dark:text-agri-400 font-bold bg-emerald-50 dark:bg-agri-950/30' : 'text-slate-700 dark:text-slate-200'}`}
                    >
                      <div><p className="font-medium text-slate-900 dark:text-slate-100">{m.name.split('(')[0].trim()}</p><p className="text-[10px] text-slate-500 dark:text-slate-400">{m.district}</p></div>
                      {originMandi.id === m.id && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-agri-400 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Harvest Qty */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>{t('harvestSplit.harvest_qty_label')}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">qtl</span>
              </label>
              <input type="number" min="0.1" step="any" value={harvestQty} onChange={e => setHarvestQty(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-agri-500 shadow-sm"
                placeholder={t('harvestSplit.harvest_qty_placeholder')} />
            </div>

            {/* Harvest Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />{t('harvestSplit.harvest_date_label')}
              </label>
              <input type="date" value={harvestDate} onChange={e => setHarvestDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-agri-500 shadow-sm" />
            </div>
          </div>

          {/* Storage & Capacity */}
          <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Warehouse className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>{isKn ? 'ಶೇಖರಣೆ ಮತ್ತು ಸಾಮರ್ಥ್ಯ' : 'Storage & Capacity'}</span>
            </h2>

            {/* Storage Capacity */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('harvestSplit.storage_capacity_label')}</label>
              <input type="number" min="0" step="any" value={storageCapacity} onChange={e => setStorageCapacity(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-agri-500 shadow-sm"
                placeholder="0" />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{t('harvestSplit.storage_capacity_hint')}</p>
            </div>

            {/* Storage Type Toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('harvestSplit.storage_type_label')}</label>
              <div className="flex gap-2">
                <button onClick={() => setStorageType('ambient')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors shadow-sm ${storageType === 'ambient' ? 'bg-amber-100 dark:bg-amber-950/50 border-amber-400 dark:border-amber-600/60 text-amber-900 dark:text-amber-300 font-bold' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-400 hover:border-slate-400'}`}>
                  <Sun className="w-3.5 h-3.5" />{t('harvestSplit.storage_ambient')}
                </button>
                <button onClick={() => setStorageType('cold')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors shadow-sm ${storageType === 'cold' ? 'bg-sky-100 dark:bg-sky-950/50 border-sky-400 dark:border-sky-600/60 text-sky-900 dark:text-sky-300 font-bold' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-400 hover:border-slate-400'}`}>
                  <Snowflake className="w-3.5 h-3.5" />{t('harvestSplit.storage_cold')}
                </button>
              </div>
            </div>

            {/* Storage Cost Override */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('harvestSplit.storage_cost_label')}</label>
              <input type="number" min="0" step="any" value={storageCost} onChange={e => setStorageCost(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-agri-500 shadow-sm"
                placeholder={t('harvestSplit.storage_cost_placeholder')} />
            </div>

            {/* Daily Selling Capacity */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('harvestSplit.daily_capacity_label')}</label>
              <input type="number" min="1" step="any" value={dailyCapacity} onChange={e => setDailyCapacity(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-agri-500 shadow-sm"
                placeholder={t('harvestSplit.daily_capacity_placeholder')} />
            </div>

            {/* Max Storage Days */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('harvestSplit.max_days_label')}</label>
              <input type="number" min="0" max="30" step="1" value={maxDays} onChange={e => setMaxDays(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-agri-500 shadow-sm"
                placeholder={t('harvestSplit.max_days_placeholder')} />
            </div>
          </div>

          {/* Risk Preference */}
          <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-agri-400" />
              <span>{t('harvestSplit.risk_label')}</span>
            </h2>
            {['conservative', 'balanced', 'growth'].map(rk => (
              <button key={rk} onClick={() => setRiskPref(rk)}
                className={`w-full text-left p-3 rounded-xl border transition-colors shadow-sm ${riskPref === rk ? 'border-emerald-600 bg-emerald-50 dark:bg-agri-950/30' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-500'}`}>
                <p className={`text-xs font-bold ${riskPref === rk ? 'text-emerald-700 dark:text-agri-400' : 'text-slate-800 dark:text-slate-300'}`}>
                  {t(`harvestSplit.risk_${rk}`)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{t(`harvestSplit.risk_${rk}_desc`)}</p>
              </button>
            ))}
          </div>

          {/* Candidate Mandis (Optional) */}
          <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <MapPin className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>{t('harvestSplit.mandi_selection_label')}</span>
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('harvestSplit.mandi_selection_hint')}</p>
            <div className="relative">
              <button type="button"
                onClick={() => { setMandiPickerOpen(p => !p); setCropOpen(false); setOriginOpen(false); }}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium hover:border-agri-500 transition-colors shadow-sm"
              >
                <span className="truncate">
                  {selectedMandis.length === 0
                    ? (isKn ? 'ಎಲ್ಲ ಮಂಡಿಗಳು' : 'All Mandis')
                    : `${selectedMandis.length} ${isKn ? 'ಆಯ್ಕೆ' : 'selected'}`}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </button>
              {mandiPickerOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-40 max-h-56 overflow-y-auto py-1">
                  {KARNATAKA_MANDIS.map(m => (
                    <button key={m.id} type="button"
                      onClick={() => toggleMandiSelection(m.id)}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${selectedMandis.includes(m.id) ? 'text-emerald-700 dark:text-agri-400 font-bold bg-emerald-50 dark:bg-agri-950/30' : 'text-slate-700 dark:text-slate-200'}`}
                    >
                      <span>{m.name.split('(')[0].trim()}</span>
                      {selectedMandis.includes(m.id) && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-agri-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedMandis.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {selectedMandis.map(mid => {
                  const m = KARNATAKA_MANDIS.find(x => x.id === mid);
                  return (
                    <span key={mid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-agri-950/40 border border-emerald-300 dark:border-agri-700/50 text-[10px] text-emerald-800 dark:text-agri-300 font-medium">
                      {m ? m.name.split('(')[0].trim() : mid}
                      <button onClick={() => toggleMandiSelection(mid)} className="hover:text-slate-900 dark:hover:text-white">✕</button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Run Button */}
          <button onClick={runOptimisation} disabled={loading || !harvestQty || parseFloat(harvestQty) <= 0}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-agri-600 hover:bg-agri-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors shadow-lg shadow-agri-600/20">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Cpu className="w-5 h-5" />}
            <span>{loading ? t('harvestSplit.running') : t('harvestSplit.run_btn')}</span>
          </button>
        </div>

        {/* ── RIGHT: Results Panel (7 cols) ──────────────────────────────── */}
        <div className="lg:col-span-7 space-y-5">

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700/60 p-4 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2 shadow-sm">
              <Bug className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* No Result Placeholder */}
          {!result && !loading && !error && (
            <div className="glass-panel p-10 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mx-auto flex items-center justify-center text-slate-500">
                <Cpu className="w-7 h-7" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{t('harvestSplit.no_result')}</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="glass-panel p-10 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-sm">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-600 dark:text-agri-400 mx-auto" />
              <p className="text-sm text-slate-700 dark:text-slate-300">{t('harvestSplit.running')}</p>
            </div>
          )}

          {/* ── RESULTS ─────────────────────────────────────────────────────── */}
          {result && (
            <>
              {/* Status Banner */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-sm ${statusStyle(result.status)}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/80 dark:bg-slate-900/50 flex items-center justify-center shadow-sm">
                    <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {t('harvestSplit.result_title')} — {t(`harvestSplit.status_${result.status}`)}
                    </p>
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {t('harvestSplit.net_return')}: {formatCurrency(result.financial_summary?.expected_net_return)}
                    </p>
                  </div>
                </div>
                {result.financial_summary?.optimization_gain_pct > 0 && (
                  <div className="text-right">
                    <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">+{result.financial_summary.optimization_gain_pct}%</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('harvestSplit.opt_gain_label')}</p>
                  </div>
                )}
              </div>

              {/* Split Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1 shadow-sm">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('harvestSplit.imm_sale_card')}</p>
                  <p className="text-lg font-bold text-sky-600 dark:text-sky-400">{formatNumber(result.immediate_sale_qty, 1)} qtl</p>
                </div>
                <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1 shadow-sm">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('harvestSplit.store_card')}</p>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{formatNumber(result.stored_qty, 1)} qtl</p>
                </div>
                <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1 shadow-sm">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('harvestSplit.spoilage_card')}</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatNumber(result.total_spoilage_qty, 2)} qtl</p>
                </div>
                <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1 shadow-sm">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('harvestSplit.unsold_card')}</p>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{formatNumber(result.terminal_unsold_qty, 2)} qtl</p>
                </div>
              </div>

              {/* Conservation Check */}
              <div className={`rounded-xl border p-2.5 text-xs font-semibold flex items-center gap-2 shadow-sm ${result.harvest_conservation_reconciled ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/50 text-emerald-800 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-700/50 text-rose-800 dark:text-rose-400'}`}>
                {result.harvest_conservation_reconciled ? t('harvestSplit.conservation_ok') : t('harvestSplit.conservation_fail')}
              </div>

              {/* Financial Summary */}
              <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                  <BarChart3 className="w-4 h-4 text-sky-500 dark:text-sky-400" />{t('harvestSplit.financial_title')}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {[
                    { label: t('harvestSplit.gross_revenue'), val: result.financial_summary?.total_gross_revenue, color: 'text-sky-600 dark:text-sky-400' },
                    { label: t('harvestSplit.transport_cost'), val: result.financial_summary?.total_transport_cost, color: 'text-slate-700 dark:text-slate-300' },
                    { label: t('harvestSplit.storage_cost'), val: result.financial_summary?.total_storage_cost, color: 'text-purple-600 dark:text-purple-400' },
                    { label: t('harvestSplit.handling_cost'), val: result.financial_summary?.total_handling_cost, color: 'text-orange-600 dark:text-orange-400' },
                    { label: t('harvestSplit.market_cess'), val: result.financial_summary?.total_market_cess, color: 'text-amber-600 dark:text-yellow-400' },
                    { label: t('harvestSplit.total_expenses'), val: result.financial_summary?.total_expenses, color: 'text-rose-600 dark:text-rose-400' },
                    { label: t('harvestSplit.net_return'), val: result.financial_summary?.expected_net_return, color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: t('harvestSplit.net_per_qtl'), val: result.financial_summary?.net_return_per_qtl, color: 'text-emerald-700 dark:text-emerald-300' },
                  ].map((item, i) => (
                    <div key={i} className="space-y-0.5">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{item.label}</p>
                      <p className={`text-sm font-bold ${item.color}`}>{formatCurrency(item.val)}</p>
                    </div>
                  ))}
                </div>

                {/* Revenue vs Expenses Chart */}
                {financialChartData.length > 0 && (
                  <div className="h-36 mt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={financialChartData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                        <XAxis type="number" tickFormatter={v => `₹${formatNumber(v, 0)}`} tick={{ fill: '#64748b', fontSize: 10 }} />
                        <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 11 }} width={70} />
                        <Tooltip formatter={(val) => [`₹${formatNumber(val, 0)}`, '']}
                          contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', color: '#0f172a', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                          {financialChartData.map((e, idx) => <Cell key={idx} fill={e.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Baseline Comparison */}
              {result.financial_summary?.baseline && (
                <div className="glass-panel rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/20 p-4 space-y-2 shadow-sm">
                  <h3 className="text-xs font-bold text-indigo-950 dark:text-white uppercase tracking-wider">{t('harvestSplit.baseline_title')}</h3>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('harvestSplit.baseline_sold')}</p>
                      <p className="font-bold text-slate-900 dark:text-white">{formatNumber(result.financial_summary.baseline.sold_qty, 1)} qtl</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('harvestSplit.baseline_unsold')}</p>
                      <p className="font-bold text-amber-700 dark:text-amber-400">{formatNumber(result.financial_summary.baseline.unsold_qty, 1)} qtl</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('harvestSplit.baseline_net')}</p>
                      <p className="font-bold text-indigo-700 dark:text-indigo-300">{formatCurrency(result.financial_summary.baseline.net_return)}</p>
                    </div>
                  </div>
                  {result.financial_summary.optimization_gain_inr > 0 && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-1">
                      {t('harvestSplit.opt_gain_label')}: +{formatCurrency(result.financial_summary.optimization_gain_inr)} ({formatPercentage(result.financial_summary.optimization_gain_pct)})
                    </p>
                  )}
                </div>
              )}

              {/* Allocation Table */}
              {result.allocations?.length > 0 && (
                <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                    <Table2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />{t('harvestSplit.allocation_title')}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                          <th className="py-2 px-2 font-semibold">{t('harvestSplit.col_date')}</th>
                          <th className="py-2 px-2 font-semibold">{t('harvestSplit.col_days')}</th>
                          <th className="py-2 px-2 font-semibold">{t('harvestSplit.col_mandi')}</th>
                          <th className="py-2 px-2 font-semibold text-right">{t('harvestSplit.col_qty')}</th>
                          <th className="py-2 px-2 font-semibold text-right">{t('harvestSplit.col_price')}</th>
                          <th className="py-2 px-2 font-semibold text-right">{t('harvestSplit.col_gross')}</th>
                          <th className="py-2 px-2 font-semibold text-right">{t('harvestSplit.col_transport')}</th>
                          <th className="py-2 px-2 font-semibold text-right">{t('harvestSplit.col_storage')}</th>
                          <th className="py-2 px-2 font-semibold text-right">{t('harvestSplit.col_net')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.allocations.map((a, idx) => (
                          <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 text-slate-800 dark:text-slate-200">
                            <td className="py-1.5 px-2">{a.selling_date}</td>
                            <td className="py-1.5 px-2 text-center">{a.days_from_harvest}</td>
                            <td className="py-1.5 px-2 truncate max-w-[120px]">{a.mandi_name?.split('(')[0]?.trim()}</td>
                            <td className="py-1.5 px-2 text-right font-semibold">{formatNumber(a.quantity_qtl, 1)}</td>
                            <td className="py-1.5 px-2 text-right">{formatCurrency(a.expected_price)}</td>
                            <td className="py-1.5 px-2 text-right text-sky-600 dark:text-sky-400">{formatCurrency(a.gross_revenue)}</td>
                            <td className="py-1.5 px-2 text-right text-slate-500 dark:text-slate-400">{formatCurrency(a.transport_cost)}</td>
                            <td className="py-1.5 px-2 text-right text-purple-600 dark:text-purple-400">{formatCurrency(a.storage_cost)}</td>
                            <td className="py-1.5 px-2 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(a.net_return)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Daily Inventory Timeline */}
              {result.daily_inventory?.length > 0 && (
                <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                    <BarChart3 className="w-4 h-4 text-purple-500 dark:text-purple-400" />{t('harvestSplit.inventory_title')}
                  </h3>

                  {/* Chart */}
                  {inventoryChartData.length > 0 && (
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={inventoryChartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', color: '#0f172a', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="end" name={isKn ? 'ದಾಸ್ತಾನು' : 'Inventory'} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="sales" name={isKn ? 'ಮಾರಾಟ' : 'Sales'} fill="#0284c7" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="spoilage" name={isKn ? 'ಹಾನಿ' : 'Spoilage'} fill="#ea580c" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Inventory Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                          <th className="py-2 px-2">{t('harvestSplit.inv_day')}</th>
                          <th className="py-2 px-2">{t('harvestSplit.inv_date')}</th>
                          <th className="py-2 px-2 text-right">{t('harvestSplit.inv_start')}</th>
                          <th className="py-2 px-2 text-right">{t('harvestSplit.inv_spoilage')}</th>
                          <th className="py-2 px-2 text-right">{t('harvestSplit.inv_sales')}</th>
                          <th className="py-2 px-2 text-right">{t('harvestSplit.inv_end')}</th>
                          <th className="py-2 px-2 text-right">{t('harvestSplit.inv_storage_cost')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.daily_inventory.map((r, idx) => (
                          <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 text-slate-800 dark:text-slate-200">
                            <td className="py-1.5 px-2 font-semibold">{r.day}</td>
                            <td className="py-1.5 px-2">{r.date}</td>
                            <td className="py-1.5 px-2 text-right">{formatNumber(r.start_inventory, 1)}</td>
                            <td className="py-1.5 px-2 text-right text-amber-600 dark:text-amber-400">{formatNumber(r.spoilage_loss, 2)}</td>
                            <td className="py-1.5 px-2 text-right text-sky-600 dark:text-sky-400">{formatNumber(r.sales_volume, 1)}</td>
                            <td className="py-1.5 px-2 text-right font-bold text-purple-700 dark:text-purple-300">{formatNumber(r.end_inventory, 1)}</td>
                            <td className="py-1.5 px-2 text-right">{formatCurrency(r.storage_cost_incurred)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Advisory Rationale */}
              {result.advisory_rationale && (
                <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-agri-400" />{t('harvestSplit.advisory_title')}
                  </h3>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{result.advisory_rationale}</p>
                </div>
              )}

              {/* Assumptions Disclosure */}
              {result.assumptions && (
                <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Settings2 className="w-3.5 h-3.5 text-slate-500" />{t('harvestSplit.assumptions_title')}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-500">{t('harvestSplit.shelf_life')}</p>
                      <p className="text-slate-800 dark:text-slate-300 font-medium">{result.assumptions.shelf_life_days} {t('harvestSplit.days_suffix')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">{t('harvestSplit.first_prohibited')}</p>
                      <p className="text-slate-800 dark:text-slate-300 font-medium">{isKn ? 'ದಿನ' : 'Day'} {result.assumptions.first_prohibited_day}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">{t('harvestSplit.decay_rate')}</p>
                      <p className="text-slate-800 dark:text-slate-300 font-medium">{(result.assumptions.daily_decay_rate * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">{t('harvestSplit.risk_mode')}</p>
                      <p className="text-slate-800 dark:text-slate-300 font-medium capitalize">{result.assumptions.risk_mode_applied}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">{t('harvestSplit.salvage_value')}</p>
                      <p className="text-slate-800 dark:text-slate-300 font-medium">₹{result.assumptions.terminal_salvage_value_per_qtl}/qtl</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">{t('harvestSplit.storage_type_label')}</p>
                      <p className="text-slate-800 dark:text-slate-300 font-medium capitalize">{result.assumptions.storage_type}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3.5 flex items-start gap-2.5 text-[11px] text-slate-600 dark:text-slate-400">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                <p>
                  {isKn
                    ? 'ಹಕ್ಕು ನಿರಾಕರಣೆ: ಇದು ಶೈಕ್ಷಣಿಕ ಮತ್ತು ಯೋಜನಾ ಅಂದಾಜು ಮಾತ್ರ. ನಿಜವಾದ ಲಾಭಗಳು ಹರಾಜು, ಗ್ರೇಡಿಂಗ್, ಹವಾಮಾನ ಮತ್ತು ಮಾರುಕಟ್ಟೆ ಪರಿಸ್ಥಿತಿಗಳ ಮೇಲೆ ಅವಲಂಬಿತ. ಭವಿಷ್ಯದ ಬೆಲೆಗಳನ್ನು ಖಾತ್ರಿಪಡಿಸಲಾಗುವುದಿಲ್ಲ.'
                    : 'DISCLAIMER: This optimisation uses simulated demonstration data and mathematical modelling for educational purposes only. Actual outcomes depend on auction dynamics, weather, grading, and market conditions. Future prices are never guaranteed.'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HarvestSplitPage;
