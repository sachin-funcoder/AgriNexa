-- ===========================================================================
-- Migration: 001_initial_mandi_schema.sql
-- Description: Core schema for Mandis, Crops, Mandi Prices, and Mandi Arrivals
-- Platform: Supabase / PostgreSQL 15+
-- ===========================================================================

-- 1. MANDIS TABLE
CREATE TABLE IF NOT EXISTS mandis (
    mandi_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    district VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL DEFAULT 'Karnataka',
    latitude DECIMAL(9, 6) NOT NULL,
    longitude DECIMAL(9, 6) NOT NULL,
    facilities JSONB DEFAULT '[]'::jsonb,
    market_fee_percent DECIMAL(4, 2) NOT NULL DEFAULT 1.50,
    handling_charge_per_qtl DECIMAL(6, 2) NOT NULL DEFAULT 15.00,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_demo BOOLEAN NOT NULL DEFAULT true,
    data_source VARCHAR(50) NOT NULL DEFAULT 'synthetic',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mandis_district ON mandis(district);

-- 2. CROPS TABLE
CREATE TABLE IF NOT EXISTS crops (
    crop_id VARCHAR(50) PRIMARY KEY,
    name_en VARCHAR(100) NOT NULL,
    name_kn VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    shelf_life_ambient_days INTEGER NOT NULL CHECK (shelf_life_ambient_days > 0),
    shelf_life_cold_days INTEGER NOT NULL CHECK (shelf_life_cold_days > 0),
    daily_decay_rate_ambient DECIMAL(5, 4) NOT NULL CHECK (daily_decay_rate_ambient >= 0.0),
    daily_decay_rate_cold DECIMAL(5, 4) NOT NULL CHECK (daily_decay_rate_cold >= 0.0),
    standard_unit VARCHAR(50) NOT NULL DEFAULT 'Quintal (100 kg)',
    base_price_inr DECIMAL(10, 2) NOT NULL CHECK (base_price_inr >= 0.0),
    is_demo BOOLEAN NOT NULL DEFAULT true,
    data_source VARCHAR(50) NOT NULL DEFAULT 'synthetic',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. MANDI PRICES TABLE
CREATE TABLE IF NOT EXISTS mandi_prices (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    mandi_id VARCHAR(50) NOT NULL REFERENCES mandis(mandi_id) ON DELETE CASCADE,
    crop_id VARCHAR(50) NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    min_price DECIMAL(10, 2) NOT NULL CHECK (min_price >= 0.0),
    modal_price DECIMAL(10, 2) NOT NULL,
    max_price DECIMAL(10, 2) NOT NULL,
    price_unit VARCHAR(30) NOT NULL DEFAULT 'INR/quintal',
    is_demo BOOLEAN NOT NULL DEFAULT true,
    data_source VARCHAR(50) NOT NULL DEFAULT 'synthetic',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_price_ordering CHECK (min_price <= modal_price AND modal_price <= max_price),
    CONSTRAINT uq_mandi_prices_record UNIQUE (date, mandi_id, crop_id)
);

CREATE INDEX IF NOT EXISTS idx_prices_crop_date ON mandi_prices(crop_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_prices_mandi_crop_date ON mandi_prices(mandi_id, crop_id, date DESC);

-- 4. MANDI ARRIVALS TABLE
CREATE TABLE IF NOT EXISTS mandi_arrivals (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    mandi_id VARCHAR(50) NOT NULL REFERENCES mandis(mandi_id) ON DELETE CASCADE,
    crop_id VARCHAR(50) NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    arrival_quantity DECIMAL(12, 2) NOT NULL CHECK (arrival_quantity >= 0.0),
    arrival_unit VARCHAR(30) NOT NULL DEFAULT 'quintals',
    is_demo BOOLEAN NOT NULL DEFAULT true,
    data_source VARCHAR(50) NOT NULL DEFAULT 'synthetic',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_mandi_arrivals_record UNIQUE (date, mandi_id, crop_id)
);

CREATE INDEX IF NOT EXISTS idx_arrivals_crop_date ON mandi_arrivals(crop_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_arrivals_mandi_crop_date ON mandi_arrivals(mandi_id, crop_id, date DESC);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE mandis ENABLE ROW LEVEL SECURITY;
ALTER TABLE crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE mandi_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE mandi_arrivals ENABLE ROW LEVEL SECURITY;

-- Public read access for market transparency
CREATE POLICY "Public read access for mandis" ON mandis FOR SELECT USING (true);
CREATE POLICY "Public read access for crops" ON crops FOR SELECT USING (true);
CREATE POLICY "Public read access for mandi_prices" ON mandi_prices FOR SELECT USING (true);
CREATE POLICY "Public read access for mandi_arrivals" ON mandi_arrivals FOR SELECT USING (true);
