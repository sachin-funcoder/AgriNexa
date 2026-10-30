import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MapPin, TrendingUp, TrendingDown, Award, AlertTriangle,
  Info, Check, RefreshCw, Truck, ArrowUpDown, ChevronDown,
  Filter, CheckSquare, Square, BarChart2, DollarSign,
  Scale, Navigation, ShieldCheck, Sparkles, AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell
} from 'recharts';

import { SUPPORTED_CROPS, KARNATAKA_MANDIS, LOGISTICS_DEFAULTS } from '../utils/constants';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatters';
import mandiApi from '../services/mandiApi';

// ─── Distance Matrix across Karnataka APMC Mandis (in km) ───────────────────────
const DISTANCE_MATRIX = {
  mandi_bengaluru: {
    mandi_bengaluru: 15,
    mandi_kolar: 70,
    mandi_mysuru: 145,
    mandi_mandya: 100,
    mandi_hubballi: 410,
    mandi_belagavi: 505,
    mandi_davanagere: 260,
    mandi_hassan: 180,
  },
  mandi_kolar: {
    mandi_bengaluru: 70,
    mandi_kolar: 15,
    mandi_mysuru: 215,
    mandi_mandya: 170,
    mandi_hubballi: 465,
    mandi_belagavi: 560,
    mandi_davanagere: 320,
    mandi_hassan: 245,
  },
  mandi_mysuru: {
    mandi_bengaluru: 145,
    mandi_kolar: 215,
    mandi_mysuru: 15,
    mandi_mandya: 45,
    mandi_hubballi: 490,
    mandi_belagavi: 585,
    mandi_davanagere: 350,
    mandi_hassan: 120,
  },
  mandi_mandya: {
    mandi_bengaluru: 100,
    mandi_kolar: 170,
    mandi_mysuru: 45,
    mandi_mandya: 15,
    mandi_hubballi: 450,
    mandi_belagavi: 545,
    mandi_davanagere: 310,
    mandi_hassan: 105,
  },
  mandi_hubballi: {
    mandi_bengaluru: 410,
    mandi_kolar: 465,
    mandi_mysuru: 490,
    mandi_mandya: 450,
    mandi_hubballi: 15,
    mandi_belagavi: 95,
    mandi_davanagere: 150,
    mandi_hassan: 340,
  },
  mandi_belagavi: {
    mandi_bengaluru: 505,
    mandi_kolar: 560,
    mandi_mysuru: 585,
    mandi_mandya: 545,
    mandi_hubballi: 95,
    mandi_belagavi: 15,
    mandi_davanagere: 240,
    mandi_hassan: 430,
  },
  mandi_davanagere: {
    mandi_bengaluru: 260,
    mandi_kolar: 320,
    mandi_mysuru: 350,
    mandi_mandya: 310,
    mandi_hubballi: 150,
    mandi_belagavi: 240,
    mandi_davanagere: 15,
    mandi_hassan: 190,
  },
  mandi_hassan: {
    mandi_bengaluru: 180,
    mandi_kolar: 245,
    mandi_mysuru: 120,
    mandi_mandya: 105,
    mandi_hubballi: 340,
    mandi_belagavi: 430,
    mandi_davanagere: 190,
    mandi_hassan: 15,
  }
};

const MandiComparePage = () => {
  const { t, i18n } = useTranslation();
  const isKn = i18n.language?.startsWith('kn');

  // ─── Selections & Filters ───────────────────────────────────────────────────
  const [selectedCrop, setSelectedCrop] = useState(SUPPORTED_CROPS[0]);
  const [cropDropdownOpen, setCropDropdownOpen] = useState(false);
  const [selectedMandiIds, setSelectedMandiIds] = useState(KARNATAKA_MANDIS.map(m => m.id));
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('netReturn'); // 'netReturn' | 'modalPrice' | 'transport' | 'arrivals' | 'name'

  // Farmer Harvest Parameters
  const [harvestQuantity, setHarvestQuantity] = useState('50'); // quintals
  const [originMandiId, setOriginMandiId] = useState('mandi_kolar'); // default farm location near Kolar
  const [originDropdownOpen, setOriginDropdownOpen] = useState(false);
  const [storageDays, setStorageDays] = useState('0'); // days of storage

  // ─── Backend Data State ─────────────────────────────────────────────────────
  const [mandiMetadata, setMandiMetadata] = useState([]);
  const [priceDataMap, setPriceDataMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // ─── Unique Districts for Filtering ─────────────────────────────────────────
  const districts = useMemo(() => {
    const set = new Set(KARNATAKA_MANDIS.map(m => m.district));
    return ['ALL', ...Array.from(set)];
  }, []);

  // ─── Fetch Mandi Metadata and Latest Prices for the Crop ───────────────────
  const loadComparisonData = useCallback(async (cropId) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      // 1. Fetch Mandis
      const mandisRes = await mandiApi.getMandis();
      const mandisArray = mandisRes?.mandis || KARNATAKA_MANDIS;
      setMandiMetadata(mandisArray);

      // 2. Fetch prices for this crop across all mandis (limit: 64 to cover multiple days)
      const pricesRes = await mandiApi.getCropPrices(cropId, { limit: 64 });
      const rawPrices = pricesRes?.prices || [];

      // Group by mandi_id, taking the latest observation date for each
      const latestPriceByMandi = {};
      rawPrices.forEach(item => {
        const mid = item.mandi_id;
        if (!latestPriceByMandi[mid] || item.date > latestPriceByMandi[mid].date) {
          latestPriceByMandi[mid] = item;
        }
      });

      setPriceDataMap(latestPriceByMandi);
    } catch (err) {
      setFetchError(err.message || 'Failed to load mandi comparison data');
      setMandiMetadata(KARNATAKA_MANDIS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComparisonData(selectedCrop.id);
  }, [selectedCrop.id, loadComparisonData]);

  // ─── Mandi Selection Handlers ───────────────────────────────────────────────
  const toggleMandiSelection = (id) => {
    setSelectedMandiIds(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const selectAllMandis = () => {
    const filtered = districtFilter === 'ALL'
      ? KARNATAKA_MANDIS.map(m => m.id)
      : KARNATAKA_MANDIS.filter(m => m.district === districtFilter).map(m => m.id);
    setSelectedMandiIds(filtered);
  };

  const clearSelection = () => {
    setSelectedMandiIds([]);
  };

  // ─── Compute Comparisons & Net Returns ──────────────────────────────────────
  const comparisonResults = useMemo(() => {
    const qty = parseFloat(harvestQuantity) || 0;
    const freightRate = LOGISTICS_DEFAULTS.freight_rate_per_km_qtl || 2.25;
    const storageRate = LOGISTICS_DEFAULTS.storage_cost_per_qtl_day || 3.5;
    const daysStored = parseFloat(storageDays) || 0;

    // Filter by district and user selection
    const activeMandis = KARNATAKA_MANDIS.filter(m => {
      const matchesDistrict = districtFilter === 'ALL' || m.district === districtFilter;
      const isSelected = selectedMandiIds.includes(m.id);
      return matchesDistrict && isSelected;
    });

    return activeMandis.map(mandi => {
      const priceRecord = priceDataMap[mandi.id];
      const hasPrice = Boolean(priceRecord);

      // Distance from origin farm
      const originMatrix = DISTANCE_MATRIX[originMandiId] || {};
      const distanceKm = originMatrix[mandi.id] || 80;

      // Expense Calculations
      const transportCost = Math.round(distanceKm * freightRate * qty);
      const storageCost = Math.round(daysStored * storageRate * qty);

      // Backend APMC fees: handling charge (₹/qtl) & market cess (%)
      const meta = mandiMetadata.find(m => m.mandi_id === mandi.id) || mandi;
      const handlingChargePerQtl = meta.handling_charge_per_qtl || 15.0;
      const marketFeePercent = meta.market_fee_percent || 1.5;

      const handlingCost = Math.round(handlingChargePerQtl * qty);

      // Prices & Revenue
      const modalPrice = hasPrice ? priceRecord.modal_price : 0;
      const minPrice = hasPrice ? priceRecord.min_price : 0;
      const maxPrice = hasPrice ? priceRecord.max_price : 0;
      const arrivalQty = hasPrice ? priceRecord.arrival_quantity : 0;
      const observationDate = hasPrice ? priceRecord.date : null;

      const grossRevenue = Math.round(qty * modalPrice);
      const marketCess = Math.round((grossRevenue * marketFeePercent) / 100);

      const totalExpenses = transportCost + storageCost + handlingCost + marketCess;
      const netReturn = grossRevenue - totalExpenses;
      const netReturnPerQtl = qty > 0 ? Math.round(netReturn / qty) : 0;

      return {
        mandiId: mandi.id,
        name: mandi.name,
        shortName: mandi.name.split('(')[0].trim(),
        district: mandi.district,
        distanceKm,
        hasPrice,
        observationDate,
        minPrice,
        modalPrice,
        maxPrice,
        arrivalQty,
        grossRevenue,
        transportCost,
        storageCost,
        handlingCost,
        marketCess,
        marketFeePercent,
        totalExpenses,
        netReturn,
        netReturnPerQtl,
      };
    });
  }, [harvestQuantity, originMandiId, storageDays, districtFilter, selectedMandiIds, priceDataMap, mandiMetadata]);

  // ─── Fair Comparison Date Analysis ──────────────────────────────────────────
  const dateAnalysis = useMemo(() => {
    const datesWithData = comparisonResults
      .filter(r => r.hasPrice && r.observationDate)
      .map(r => r.observationDate);

    if (!datesWithData.length) return { isSameDate: true, commonDate: null, hasDiscrepancy: false };

    const uniqueDates = Array.from(new Set(datesWithData));
    const isSameDate = uniqueDates.length === 1;
    return {
      isSameDate,
      commonDate: isSameDate ? uniqueDates[0] : null,
      uniqueDates,
      hasDiscrepancy: !isSameDate
    };
  }, [comparisonResults]);

  // ─── Identify Key Benchmarks (Highest Price, Best Net Return, Lowest Transport)
  const benchmarks = useMemo(() => {
    const valid = comparisonResults.filter(r => r.hasPrice);
    if (!valid.length) return {};

    const highestPrice = [...valid].sort((a, b) => b.modalPrice - a.modalPrice)[0];
    const bestNetReturn = [...valid].sort((a, b) => b.netReturn - a.netReturn)[0];
    const lowestTransport = [...valid].sort((a, b) => a.transportCost - b.transportCost)[0];

    return {
      highestPriceId: highestPrice?.mandiId,
      bestNetReturnId: bestNetReturn?.mandiId,
      lowestTransportId: lowestTransport?.mandiId,
      bestMandi: bestNetReturn,
      highestPriceMandi: highestPrice,
      lowestTransportMandi: lowestTransport
    };
  }, [comparisonResults]);

  // ─── Sort Comparison Results ────────────────────────────────────────────────
  const sortedResults = useMemo(() => {
    const list = [...comparisonResults];
    switch (sortBy) {
      case 'netReturn':
        return list.sort((a, b) => b.netReturn - a.netReturn);
      case 'modalPrice':
        return list.sort((a, b) => b.modalPrice - a.modalPrice);
      case 'transport':
        return list.sort((a, b) => a.transportCost - b.transportCost);
      case 'arrivals':
        return list.sort((a, b) => (b.arrivalQty || 0) - (a.arrivalQty || 0));
      case 'minPrice':
        return list.sort((a, b) => b.minPrice - a.minPrice);
      case 'maxPrice':
        return list.sort((a, b) => b.maxPrice - a.maxPrice);
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return list;
    }
  }, [comparisonResults, sortBy]);

  // ─── Chart Data ─────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return sortedResults.filter(r => r.hasPrice).map(r => ({
      name: r.shortName,
      modalPrice: r.modalPrice,
      netReturnPerQtl: Math.max(0, r.netReturnPerQtl),
      transportPerQtl: parseFloat(harvestQuantity) > 0 ? Math.round(r.transportCost / parseFloat(harvestQuantity)) : 0,
      arrivals: Math.round(r.arrivalQty || 0)
    }));
  }, [sortedResults, harvestQuantity]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <MapPin className="w-6 h-6 text-sky-600 dark:text-sky-400" />
            <span>{t('mandiCompare.title', 'Smart Mandi Comparison & Net Return Ranking')}</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            {t('mandiCompare.subtitle', 'Compare Karnataka APMC market prices, arrival signals, and realistic take-home net returns after deducting transport and statutory market fees.')}
          </p>
        </div>

        {/* Demo Badge */}
        <div className="flex items-center space-x-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 px-3.5 py-2 text-xs text-amber-900 dark:text-amber-300 shadow-sm max-w-md">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="leading-tight">
            {t('mandiCompare.demoNotice', 'SIMULATED DEMONSTRATION DATA: All prices, fees, and arrival volumes are synthetic demonstration figures.')}
          </span>
        </div>
      </div>

      {/* ── Control Bar: Crop, Farm Origin & Harvest Quantity ──────────────── */}
      <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

          {/* 1. Crop Selector */}
          <div className="relative">
            <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
              {t('mandiCompare.selectCrop', 'Select Commodity')}
            </label>
            <button
              id="compare-crop-btn"
              onClick={() => {
                setCropDropdownOpen(prev => !prev);
                setOriginDropdownOpen(false);
              }}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-agri-500 text-slate-900 dark:text-white text-xs font-medium transition-colors shadow-sm"
            >
              <span className="flex items-center gap-2">
                <span>{selectedCrop.icon}</span>
                <span>{isKn ? selectedCrop.name_kn : selectedCrop.name_en}</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${cropDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {cropDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-40 max-h-56 overflow-y-auto py-1">
                {SUPPORTED_CROPS.map(crop => (
                  <button
                    key={crop.id}
                    onClick={() => {
                      setSelectedCrop(crop);
                      setCropDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      selectedCrop.id === crop.id ? 'text-emerald-700 dark:text-agri-400 bg-emerald-50 dark:bg-agri-950/40 font-bold' : 'text-slate-700 dark:text-slate-200'
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

          {/* 2. Farm Origin Vicinity */}
          <div className="relative">
            <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
              {t('mandiCompare.originLocation', 'Origin / Farm Vicinity')}
            </label>
            <button
              id="compare-origin-btn"
              onClick={() => {
                setOriginDropdownOpen(prev => !prev);
                setCropDropdownOpen(false);
              }}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-agri-500 text-slate-900 dark:text-white text-xs font-medium transition-colors shadow-sm"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span className="truncate">Near {KARNATAKA_MANDIS.find(m => m.id === originMandiId)?.name.split('(')[0].trim()}</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${originDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {originDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-40 max-h-56 overflow-y-auto py-1">
                {KARNATAKA_MANDIS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setOriginMandiId(m.id);
                      setOriginDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      originMandiId === m.id ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 font-bold' : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span>{m.name.split('(')[0].trim()} ({m.district})</span>
                    {originMandiId === m.id && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Harvest Quantity */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
              {t('mandiCompare.harvestQuantity', 'Harvest Quantity Sold')}
            </label>
            <div className="relative">
              <input
                id="compare-quantity-input"
                type="number"
                min="1"
                step="any"
                value={harvestQuantity}
                onChange={e => setHarvestQuantity(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-agri-500 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none shadow-sm"
                placeholder="50"
              />
              <span className="absolute right-3.5 top-2.5 text-[11px] text-slate-500">qtl</span>
            </div>
          </div>

          {/* 4. Sort By Selector */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
              {t('mandiCompare.sortBy', 'Sort By')}
            </label>
            <div className="relative">
              <select
                id="compare-sort-by"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-agri-500 appearance-none shadow-sm"
              >
                <option value="netReturn">🏆 {t('mandiCompare.sortNetReturn', 'Highest Net Return')}</option>
                <option value="modalPrice">💰 {t('mandiCompare.sortModalPrice', 'Highest Modal Price')}</option>
                <option value="transport">🚚 {t('mandiCompare.sortLowestTransport', 'Lowest Transport Cost')}</option>
                <option value="arrivals">📦 {t('mandiCompare.sortArrivals', 'Highest Arrivals')}</option>
                <option value="minPrice">📉 {t('mandiCompare.sortMinPrice', 'Highest Min Price')}</option>
                <option value="maxPrice">📈 {t('mandiCompare.sortMaxPrice', 'Highest Max Price')}</option>
                <option value="name">🔤 {t('mandiCompare.sortName', 'Mandi Name (A-Z)')}</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* District Filter & Mandi Multi-Select Bar */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>{t('mandiCompare.filterDistrict', 'District')}:</span>
            </span>
            <div className="flex flex-wrap gap-1">
              {districts.map(dist => (
                <button
                  key={dist}
                  onClick={() => setDistrictFilter(dist)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    districtFilter === dist
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {dist === 'ALL' ? t('mandiCompare.allDistricts', 'All') : dist}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={selectAllMandis}
              className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-medium flex items-center gap-1"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{t('mandiCompare.selectAll', 'Select All')}</span>
            </button>
            <span className="text-slate-400 dark:text-slate-600">|</span>
            <button
              onClick={clearSelection}
              className="text-[11px] text-slate-600 dark:text-slate-400 hover:underline font-medium flex items-center gap-1"
            >
              <Square className="w-3.5 h-3.5" />
              <span>{t('mandiCompare.deselectAll', 'Clear')}</span>
            </button>
          </div>
        </div>

        {/* Mandi Checkbox Chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {KARNATAKA_MANDIS.map(mandi => {
            const isChecked = selectedMandiIds.includes(mandi.id);
            return (
              <button
                key={mandi.id}
                onClick={() => toggleMandiSelection(mandi.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  isChecked
                    ? 'bg-sky-100 dark:bg-sky-950/40 border-sky-400 dark:border-sky-600 text-sky-800 dark:text-sky-300 font-semibold shadow-sm'
                    : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                }`}
              >
                {isChecked ? <Check className="w-3 h-3 text-sky-600 dark:text-sky-400" /> : <span className="w-3 h-3 rounded border border-slate-300 dark:border-slate-600 inline-block" />}
                <span>{mandi.name.split('(')[0].trim()}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Fair Comparison Benchmark Status Notice ──────────────────────── */}
      {dateAnalysis.commonDate ? (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700/50 p-3 text-xs text-emerald-900 dark:text-emerald-300 flex items-center gap-2 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>
            {t('mandiCompare.sameDateNotice', 'Fair Benchmark: All displayed prices are from the same observation date ({{date}}).', { date: dateAnalysis.commonDate })}
          </span>
        </div>
      ) : dateAnalysis.hasDiscrepancy ? (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-600/60 p-3 text-xs text-amber-900 dark:text-amber-300 flex items-center gap-2 shadow-sm">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span>
            {t('mandiCompare.dateMismatchWarning', 'Notice: Observation dates differ across mandis. Price comparisons reflect the latest available observation for each yard.')}
          </span>
        </div>
      ) : null}

      {/* ── Smart Recommendation Card ────────────────────────────────────── */}
      {benchmarks.bestMandi && !isLoading && (
        <div className="glass-panel rounded-2xl border border-emerald-300 dark:border-emerald-600/60 bg-gradient-to-r from-emerald-50/90 via-white to-emerald-50/50 dark:from-emerald-950/40 dark:via-slate-900/60 dark:to-slate-900/40 p-5 space-y-3 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 dark:border-emerald-800/40 pb-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {t('mandiCompare.recommendationTitle', 'Smart Marketing Recommendation')}
              </h2>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:border-emerald-500/50 dark:text-emerald-300 border border-emerald-300 shadow-sm">
              #1 Recommended APMC: {benchmarks.bestMandi.name.split('(')[0].trim()}
            </span>
          </div>

          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
            {isKn ? (
              <span>
                <strong>{benchmarks.bestMandi.name.split('(')[0].trim()}</strong> ಮಾರುಕಟ್ಟೆಯು ನಿಮ್ಮ ತೋಟದಿಂದ ಗರಿಷ್ಠ ಅಂದಾಜು ನಿವ್ವಳ ಆದಾಯವಾದ <strong>₹{formatNumber(benchmarks.bestMandi.netReturn, 0)}</strong> (ಕ್ವಿಂಟಾಲಿಗೆ ₹{formatNumber(benchmarks.bestMandi.netReturnPerQtl, 0)}) ಅನ್ನು ಒದಗಿಸುತ್ತದೆ.
                {benchmarks.highestPriceMandi?.mandiId !== benchmarks.bestMandi.mandiId && benchmarks.highestPriceMandi ? (
                  ` ${benchmarks.highestPriceMandi.name.split('(')[0].trim()} ನಲ್ಲಿ ಹೆಚ್ಚಿನ ಸರಾಸರಿ ಬೆಲೆ (₹${formatNumber(benchmarks.highestPriceMandi.modalPrice, 0)}) ಇದ್ದರೂ, ಹೆಚ್ಚಿನ ಸಾರಿಗೆ ವೆಚ್ಚದ ಕಾರಣ ${benchmarks.bestMandi.name.split('(')[0].trim()} ಮಾರುಕಟ್ಟೆ ಹೆಚ್ಚು ಲಾಭದಾಯಕವಾಗಿದೆ.`
                ) : (
                  ` ಇಲ್ಲಿನ ಆಕರ್ಷಕ ಸರಾಸರಿ ಬೆಲೆ (₹${formatNumber(benchmarks.bestMandi.modalPrice, 0)}) ಸಾರಿಗೆ ವೆಚ್ಚವನ್ನು ಸರಿದೂಗಿಸಿ ಹೆಚ್ಚಿನ ಲಾಭ ತಂದುಕೊಡುತ್ತದೆ.`
                )}
              </span>
            ) : (
              <span>
                <strong>{benchmarks.bestMandi.name.split('(')[0].trim()}</strong> yields the highest estimated net return of <strong>₹{formatNumber(benchmarks.bestMandi.netReturn, 0)}</strong> (₹{formatNumber(benchmarks.bestMandi.netReturnPerQtl, 0)} per quintal).
                {benchmarks.highestPriceMandi?.mandiId !== benchmarks.bestMandi.mandiId && benchmarks.highestPriceMandi ? (
                  ` Although ${benchmarks.highestPriceMandi.name.split('(')[0].trim()} lists a higher modal price of ₹${formatNumber(benchmarks.highestPriceMandi.modalPrice, 0)}/qtl, higher freight expenses of ₹${formatNumber(benchmarks.highestPriceMandi.transportCost, 0)} reduce your take-home return, making ${benchmarks.bestMandi.name.split('(')[0].trim()} more profitable by ₹${formatNumber(benchmarks.bestMandi.netReturn - benchmarks.highestPriceMandi.netReturn, 0)}.`
                ) : (
                  ` Its strong modal price of ₹${formatNumber(benchmarks.bestMandi.modalPrice, 0)}/qtl effectively offsets transportation and statutory fees, delivering optimal net returns.`
                )}
              </span>
            )}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            <div className="bg-white dark:bg-slate-900/60 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{isKn ? 'ನಿರೀಕ್ಷಿತ ಮಾರಾಟ ಆದಾಯ' : 'Gross Revenue'}</span>
              <span className="text-sky-600 dark:text-sky-400 font-bold">₹{formatNumber(benchmarks.bestMandi.grossRevenue, 0)}</span>
            </div>
            <div className="bg-white dark:bg-slate-900/60 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{isKn ? 'ಒಟ್ಟು ವೆಚ್ಚ & ಮಂಡಿ ಶುಲ್ಕ' : 'Total Logistics & Fees'}</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">₹{formatNumber(benchmarks.bestMandi.totalExpenses, 0)}</span>
            </div>
            <div className="bg-white dark:bg-slate-900/60 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{isKn ? 'ನಿವ್ವಳ ಆದಾಯ' : 'Estimated Net Take-Home'}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹{formatNumber(benchmarks.bestMandi.netReturn, 0)}</span>
            </div>
            <div className="bg-white dark:bg-slate-900/60 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{isKn ? 'ತೋಟದಿಂದ ಸಾರಿಗೆ ದೂರ' : 'Estimated Distance'}</span>
              <span className="text-slate-900 dark:text-slate-200 font-bold">{benchmarks.bestMandi.distanceKm} km</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Side-by-Side Comparison Grid ─────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>{isKn ? 'ಮಾರುಕಟ್ಟೆವಾರು ವಿವರವಾದ ಹೋಲಿಕೆ' : 'Mandi-by-Mandi Comparison Table'}</span>
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {sortedResults.length} {t('mandiCompare.mandisCount', 'Mandis Selected')}
          </span>
        </div>

        {/* Loading / Error States */}
        {isLoading ? (
          <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-2">
            <RefreshCw className="w-8 h-8 text-sky-600 dark:text-sky-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-600 dark:text-slate-400">{t('mandiCompare.loadingMandis', 'Fetching market yards and price benchmarks...')}</p>
          </div>
        ) : fetchError ? (
          <div className="glass-panel rounded-2xl border border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 p-8 text-center text-rose-800 dark:text-rose-300 text-xs space-y-3 shadow-xl">
            <AlertTriangle className="w-8 h-8 mx-auto text-rose-600 dark:text-rose-400" />
            <p className="font-medium max-w-md mx-auto">{fetchError}</p>
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => loadComparisonData(selectedCrop.id)}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-rose-800 hover:bg-rose-700 text-white font-semibold text-xs transition active:scale-95 shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Retry Connection
              </button>
            </div>
          </div>
        ) : sortedResults.length === 0 ? (
          <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
            {t('mandiCompare.noMandis', 'Please select at least one mandi to compare.')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 glass-panel shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">{t('mandiCompare.tableMandi', 'Mandi Market Yard')}</th>
                  <th className="py-3 px-3 font-semibold">{t('mandiCompare.tableDate', 'Date')}</th>
                  <th className="py-3 px-3 font-semibold text-right">{t('mandiCompare.tableMin', 'Min Price')}</th>
                  <th className="py-3 px-3 font-semibold text-right">{t('mandiCompare.tableModal', 'Modal Price')}</th>
                  <th className="py-3 px-3 font-semibold text-right">{t('mandiCompare.tableMax', 'Max Price')}</th>
                  <th className="py-3 px-3 font-semibold text-right">{t('mandiCompare.tableArrivals', 'Arrivals')}</th>
                  <th className="py-3 px-3 font-semibold text-right">{t('mandiCompare.tableTransport', 'Est. Transport')}</th>
                  <th className="py-3 px-3 font-semibold text-right">{t('mandiCompare.tableFees', 'Fees & Cess')}</th>
                  <th className="py-3 px-4 font-semibold text-right">{t('mandiCompare.tableNetReturn', 'Est. Net Return')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {sortedResults.map((row, idx) => {
                  const isTopNet = benchmarks.bestNetReturnId === row.mandiId;
                  const isHighestPrice = benchmarks.highestPriceId === row.mandiId;
                  const isLowestTransport = benchmarks.lowestTransportId === row.mandiId;

                  return (
                    <tr
                      key={row.mandiId}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        isTopNet ? 'bg-emerald-50/70 dark:bg-emerald-950/20 font-medium' : ''
                      }`}
                    >
                      {/* Mandi Name + Badges */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">{row.shortName}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">({row.district})</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isTopNet && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                                🏆 {t('mandiCompare.bestNetReturnBadge', '#1 Best Net Return')}
                              </span>
                            )}
                            {isHighestPrice && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300 border border-sky-300 dark:border-sky-500/40">
                                💰 {t('mandiCompare.highestPriceBadge', 'Highest Market Price')}
                              </span>
                            )}
                            {isLowestTransport && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40">
                                🚚 {t('mandiCompare.lowestTransportBadge', 'Lowest Transport Cost')}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {row.observationDate || '—'}
                      </td>

                      {/* Min Price */}
                      <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300 font-mono">
                        {row.hasPrice ? `₹${formatNumber(row.minPrice, 0)}` : '—'}
                      </td>

                      {/* Modal Price */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {row.hasPrice ? `₹${formatNumber(row.modalPrice, 0)}` : '—'}
                      </td>

                      {/* Max Price */}
                      <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300 font-mono">
                        {row.hasPrice ? `₹${formatNumber(row.maxPrice, 0)}` : '—'}
                      </td>

                      {/* Arrivals */}
                      <td className="py-3 px-3 text-right text-amber-700 dark:text-amber-300 font-mono">
                        {row.hasPrice && row.arrivalQty ? `${formatNumber(row.arrivalQty, 0)} q` : '—'}
                      </td>

                      {/* Transport Expense */}
                      <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300 font-mono">
                        <span>₹{formatNumber(row.transportCost, 0)}</span>
                        <span className="block text-[10px] text-slate-500">{row.distanceKm} km</span>
                      </td>

                      {/* Mandi Fees & Handling */}
                      <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300 font-mono">
                        <span>₹{formatNumber(row.marketCess + row.handlingCost, 0)}</span>
                        <span className="block text-[10px] text-slate-500">{row.marketFeePercent}% cess</span>
                      </td>

                      {/* Estimated Net Return */}
                      <td className="py-3 px-4 text-right">
                        <span className={`text-sm font-black font-mono ${row.netReturn >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          ₹{formatNumber(row.netReturn, 0)}
                        </span>
                        <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                          ₹{formatNumber(row.netReturnPerQtl, 0)}/qtl
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Comparison Charts (Modal Price vs Net Return & Arrivals) ──────── */}
      {!isLoading && chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Chart 1: Modal Price vs Net Return per Quintal */}
          <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>{t('mandiCompare.priceComparisonChart', 'Modal Price vs. Net Return per Quintal')}</span>
              </h3>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                {isKn ? 'ಹರಾಜು ಬೆಲೆ ಮತ್ತು ವೆಚ್ಚ ಕಳೆದು ಉಳಿಯುವ ನೈಜ ನಿವ್ವಳ ಆದಾಯ' : 'Auction modal price compared to actual take-home earnings per quintal'}
              </p>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickFormatter={v => `₹${formatNumber(v, 0)}`}
                    width={60}
                  />
                  <Tooltip
                    formatter={(val) => [`₹${formatNumber(val, 0)}/qtl`, '']}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '11px', color: '#0f172a' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="modalPrice" name={isKn ? 'ಮೋಡಲ್ ಬೆಲೆ' : 'Modal Price'} fill="#0284c7" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="netReturnPerQtl" name={isKn ? 'ನಿವ್ವಳ ಆದಾಯ/ಕ್ವಿಂಟಾಲ್' : 'Net Return / Qtl'} fill="#16a34a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Arrival Volumes across Mandis */}
          <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{t('mandiCompare.arrivalsChart', 'Arrival Volume Comparison (Quintals)')}</span>
              </h3>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                {isKn ? 'ವಿವಿಧ ಮಂಡಿಗಳಿಗೆ ಆಗಮಿಸಿದ ಸರಕಿನ ಪ್ರಮಾಣ' : 'Volume of commodity arriving at each market yard'}
              </p>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickFormatter={v => `${formatNumber(v, 0)}q`}
                    width={56}
                  />
                  <Tooltip
                    formatter={(val) => [`${formatNumber(val, 0)} quintals`, '']}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '11px', color: '#0f172a' }}
                  />
                  <Bar dataKey="arrivals" name={isKn ? 'ಆವಕ ಪ್ರಮಾಣ' : 'Arrival Volume'} fill="#d97706" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      {/* ── Footer Disclaimer ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3.5 flex items-start gap-2.5 text-[11px] text-slate-600 dark:text-slate-400 shadow-sm">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-500" />
        <p>
          {t('mandiCompare.disclaimer', 'DISCLAIMER: Net return calculations are estimates based on your entered parameters and standard APMC fee schedules. Actual auction bids and transport freight may vary. Not a guaranteed price quote.')}
        </p>
      </div>

    </div>
  );
};

export default MandiComparePage;
