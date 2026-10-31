
# AgriNexa — The Next Generation of Agricultural Intelligence

AgriNexa is an AI-powered agricultural intelligence platform designed to help farmers make smarter, data-driven decisions. The platform provides real-time mandi price intelligence, statistical AI price forecasting with explicit uncertainty bands, mixed-integer linear programming (PuLP) for harvest split optimization, net return financial calculators, geospatial mandi comparisons, and a community transparency forum for reporting unfair weighing and delayed payment practices.

---

## 🌟 Core Features

- **Farmer Dashboard**: Bilingual (Kannada & English), responsive mobile-first dashboard providing crop status, price tickers, and quick recommendations.
- **Mandi Price Intelligence**: Real Agmarknet historical trends, modal prices, daily arrivals as market signals, and price volatility indicators.
- **AI Price Forecasting**: Multi-scenario predictions (Optimistic, Normal, Pessimistic) with explicit uncertainty modeling — never promising false certainty.
- **Smart Harvest Split Optimizer (PuLP)**: Mathematical optimization advising how much produce to sell immediately vs. store and sell later across nearby mandis, accounting for storage costs and non-linear perishability decay.
- **Profit & Spoilage Calculator**: Granular breakdown of gross revenue, freight costs, daily storage, market cess, handling fees, and spoilage losses.
- **Mandi Comparison (Leaflet Map)**: Spatial radius search showing distance, freight expenses, and net-realizable prices across regional mandis.
- **Farmer Community & Transparency**: Peer discussions, mandi ratings, and grievance reporting with verified vs. unverified status flags.

---

## 🏗️ Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, Leaflet, i18next (Kannada + English)
- **Backend**: Python 3.11+, FastAPI, Pydantic V2, Uvicorn
- **Database & Auth**: PostgreSQL, Supabase Auth, Supabase Storage
- **AI & Optimization**: Pandas, NumPy, Scikit-learn, XGBoost, PuLP
- **Hosting Targets**: Vercel (Frontend), Render (Backend), Supabase (Database)

---

## 📂 Project Structure

```text
AgriNexa/
├── backend/                  # FastAPI Application, ML Engine, PuLP Optimizer
│   ├── app/
│   │   ├── api/v1/           # REST Endpoints
│   │   ├── core/             # Configuration & Auth Security
│   │   ├── db/               # Supabase Connection & Migrations
│   │   ├── ml_engine/        # Time-Series Forecasting & Feature Pipeline
│   │   ├── optimizer/        # PuLP Harvest Split LP Solver
│   │   ├── schemas/          # Pydantic V2 Data Contracts
│   │   └── services/         # Business Logic Layer
│   ├── data/                 # Raw & Processed Verified Mandi Datasets
│   ├── tests/                # Automated Backend Test Suite
│   └── requirements.txt
├── frontend/                 # React 18 + Vite SPA
│   ├── public/locales/       # English & Kannada Translation Dictionaries
│   └── src/
│       ├── components/       # Modular, Reusable UI Components
│       ├── context/          # React State Providers (Auth, Language, Farm Config)
│       ├── pages/            # Farmer Application Views
│       └── services/         # Axios API Integration Layer
```

---

## 🚀 Quickstart Guide

### Application link
Link: https://agri-nexa-app.vercel.app

# AgriNexa

