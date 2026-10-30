/**
 * Agricultural Constants & Default Parameters
 */

export const SUPPORTED_CROPS = [
  {
    id: 'crop_tomato',
    name_en: 'Tomato',
    name_kn: 'ಟೊಮ್ಯಾಟೋ (ಟೊಮೇಟೊ)',
    category: 'Perishable Vegetable',
    standard_shelf_life_days: 6,
    daily_decay_rate: 0.045,
    unit: 'Quintal (100 kg)',
    icon: '🍅'
  },
  {
    id: 'crop_onion',
    name_en: 'Onion',
    name_kn: 'ಈರುಳ್ಳಿ',
    category: 'Semi-Perishable Vegetable',
    standard_shelf_life_days: 45,
    daily_decay_rate: 0.005,
    unit: 'Quintal (100 kg)',
    icon: '🧅'
  },
  {
    id: 'crop_potato',
    name_en: 'Potato',
    name_kn: 'ಆಲೂಗಡ್ಡೆ',
    category: 'Tuber Vegetable',
    standard_shelf_life_days: 60,
    daily_decay_rate: 0.003,
    unit: 'Quintal (100 kg)',
    icon: '🥔'
  },
  {
    id: 'crop_maize',
    name_en: 'Maize (Corn)',
    name_kn: 'ಮೆಕ್ಕೆಜೋಳ',
    category: 'Grain / Cereal',
    standard_shelf_life_days: 180,
    daily_decay_rate: 0.0008,
    unit: 'Quintal (100 kg)',
    icon: '🌽'
  },
  {
    id: 'crop_chilli',
    name_en: 'Green Chilli',
    name_kn: 'ಹಸಿ ಮೆಣಸಿನಕಾಯಿ',
    category: 'Perishable Spice',
    standard_shelf_life_days: 5,
    daily_decay_rate: 0.055,
    unit: 'Quintal (100 kg)',
    icon: '🌶️'
  },
  {
    id: 'crop_ragi',
    name_en: 'Ragi',
    name_kn: 'ರಾಗಿ',
    category: 'Millet / Cereal',
    standard_shelf_life_days: 240,
    daily_decay_rate: 0.0005,
    unit: 'Quintal (100 kg)',
    icon: '🌾'
  }
];

export const KARNATAKA_MANDIS = [
  {
    id: 'mandi_bengaluru',
    name: 'Bengaluru (Yeshwanthpur APMC)',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    latitude: 13.0238,
    longitude: 77.5529,
  },
  {
    id: 'mandi_kolar',
    name: 'Kolar APMC Market Yard',
    district: 'Kolar',
    state: 'Karnataka',
    latitude: 13.1367,
    longitude: 78.1340,
  },
  {
    id: 'mandi_mysuru',
    name: 'Mysuru (Bandipalya APMC)',
    district: 'Mysuru',
    state: 'Karnataka',
    latitude: 12.2778,
    longitude: 76.6806,
  },
  {
    id: 'mandi_mandya',
    name: 'Mandya APMC Yard',
    district: 'Mandya',
    state: 'Karnataka',
    latitude: 12.5242,
    longitude: 76.8958,
  },
  {
    id: 'mandi_hubballi',
    name: 'Hubballi (Amargol APMC)',
    district: 'Dharwad',
    state: 'Karnataka',
    latitude: 15.3942,
    longitude: 75.1058,
  },
  {
    id: 'mandi_belagavi',
    name: 'Belagavi APMC Yard',
    district: 'Belagavi',
    state: 'Karnataka',
    latitude: 15.8497,
    longitude: 74.4977,
  },
  {
    id: 'mandi_davanagere',
    name: 'Davanagere APMC Yard',
    district: 'Davanagere',
    state: 'Karnataka',
    latitude: 14.4644,
    longitude: 75.9218,
  },
  {
    id: 'mandi_hassan',
    name: 'Hassan APMC Yard',
    district: 'Hassan',
    state: 'Karnataka',
    latitude: 13.0033,
    longitude: 76.1004,
  }
];

export const LOGISTICS_DEFAULTS = {
  freight_rate_per_km_qtl: 2.25,
  storage_cost_per_qtl_day: 3.5,
  cold_storage_cost_per_qtl_day: 8.0
};
