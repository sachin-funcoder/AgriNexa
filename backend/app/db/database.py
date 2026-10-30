"""SQLite database persistence layer for AgriNexa Task 7.

Stores users, subscriptions, predictions, claims, and audit logs.
Relational schema with foreign keys and ACID transactions.
"""

import os
import sqlite3
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("agrinexa.db")

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "agrinexa.db")


def get_connection() -> sqlite3.Connection:
    """Returns a SQLite connection with row_factory set to sqlite3.Row."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


get_db_connection = get_connection


def init_db():
    """Initializes tables and seeds initial demo data if empty."""
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        mobile TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'farmer',
        preferred_language TEXT NOT NULL DEFAULT 'en',
        district TEXT,
        preferred_crops TEXT,  -- JSON string or comma-separated
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

    # 2. Subscriptions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        billing_cycle TEXT NOT NULL DEFAULT 'monthly',
        amount_paid REAL NOT NULL DEFAULT 0.0,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        is_demo INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 3. Prediction records table (Immutable log of generated predictions)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS predictions (
        prediction_id TEXT PRIMARY KEY,
        user_id TEXT,
        crop_id TEXT NOT NULL,
        crop_name TEXT NOT NULL,
        mandi_id TEXT NOT NULL,
        mandi_name TEXT NOT NULL,
        prediction_timestamp TEXT NOT NULL,
        predicted_price REAL NOT NULL,
        forecast_horizon_days INTEGER NOT NULL DEFAULT 7,
        confidence_min REAL NOT NULL,
        confidence_max REAL NOT NULL,
        recommended_action TEXT NOT NULL DEFAULT 'HOLD',
        model_version TEXT NOT NULL DEFAULT 'AgriNexa-Ensemble-v1.4',
        is_demo INTEGER NOT NULL DEFAULT 1,
        subscription_tier_at_generation TEXT NOT NULL DEFAULT 'PROTECTION',
        created_at TEXT NOT NULL
    );
    """)

    # 4. Claims table (AI Prediction Protection claims)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS claims (
        claim_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_mobile TEXT NOT NULL,
        prediction_id TEXT NOT NULL,
        crop_id TEXT NOT NULL,
        crop_name TEXT NOT NULL,
        mandi_id TEXT NOT NULL,
        mandi_name TEXT NOT NULL,
        harvest_quantity_qtl REAL NOT NULL,
        actual_selling_price REAL NOT NULL,
        predicted_price REAL NOT NULL,
        gross_price_difference REAL NOT NULL,
        gross_loss REAL NOT NULL,
        verified_eligible_loss REAL NOT NULL,
        excluded_loss REAL NOT NULL DEFAULT 0.0,
        compensation_percentage REAL NOT NULL DEFAULT 35.0,
        proposed_compensation REAL NOT NULL,
        date_of_sale TEXT NOT NULL,
        evidence_description TEXT NOT NULL,
        financial_impact_description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Submitted',
        reviewer_notes TEXT,
        reviewed_by TEXT,
        reviewed_at TEXT,
        is_demo INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (prediction_id) REFERENCES predictions(prediction_id)
    );
    """)

    # 5. Claim Audit Trail table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS claim_audit_logs (
        log_id TEXT PRIMARY KEY,
        claim_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        explanation TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (claim_id) REFERENCES claims(claim_id) ON DELETE CASCADE
    );
    """)

    # 6. Chatbot Sessions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT,
        language TEXT NOT NULL DEFAULT 'auto',
        last_crop_id TEXT,
        last_crop_name TEXT,
        last_mandi_id TEXT,
        last_mandi_name TEXT,
        last_intent TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

    # 7. Chatbot Messages table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_messages (
        message_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        text TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'auto',
        intent TEXT,
        sources_used TEXT,
        action_chips TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
    );
    """)

    # 8. Farmer Land Profiles table (Task 9)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS land_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        farm_name TEXT,
        state TEXT NOT NULL DEFAULT 'Karnataka',
        district TEXT NOT NULL,
        taluk TEXT,
        village TEXT,
        latitude REAL,
        longitude REAL,
        total_area REAL NOT NULL,
        area_unit TEXT NOT NULL DEFAULT 'acres',
        land_type TEXT NOT NULL,
        soil_type TEXT NOT NULL,
        soil_ph REAL,
        electrical_conductivity REAL,
        nitrogen_level TEXT,
        phosphorus_level TEXT,
        potassium_level TEXT,
        organic_carbon REAL,
        soil_texture TEXT,
        drainage_capacity TEXT,
        water_source TEXT NOT NULL,
        water_availability TEXT NOT NULL,
        irrigation_frequency TEXT,
        preferred_categories TEXT,
        preferred_duration TEXT,
        crop_purpose TEXT,
        risk_preference TEXT NOT NULL DEFAULT 'balanced',
        budget_inr REAL,
        preferred_sowing_season TEXT,
        is_demo INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 9. Crop Recommendations History table (Task 9)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS crop_recommendations_history (
        id TEXT PRIMARY KEY,
        land_profile_id TEXT NOT NULL,
        user_id TEXT,
        district TEXT NOT NULL,
        season TEXT NOT NULL,
        recommendations_json TEXT NOT NULL,
        climate_summary_json TEXT NOT NULL,
        scoring_weights_version TEXT NOT NULL,
        dataset_version TEXT NOT NULL,
        is_demo INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (land_profile_id) REFERENCES land_profiles(id) ON DELETE CASCADE
    );
    """)

    conn.commit()
    conn.close()
    logger.info("Database initialized successfully.")


# Initialize on import
init_db()

