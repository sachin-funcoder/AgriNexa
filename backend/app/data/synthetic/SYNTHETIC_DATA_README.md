# AgriNexa — Synthetic Demonstration Dataset Documentation

---

## 1. Purpose & Ethical Disclaimer

> [!IMPORTANT]
> **DEMONSTRATION AND TESTING ONLY**  
> The datasets in this directory (`mandis.json`, `crops.json`, `prices.csv`, `arrivals.csv`, `costs.json`) are **statistically simulated synthetic records**.  
> They are strictly for development, testing, and system prototyping. They are **NOT** genuine transactions, nor are they verified records from AGMARKNET, e-NAM, or the Karnataka State Agricultural Marketing Board (KSAMB).  
> Every API record returned from this dataset is marked with:
> ```json
> {
>   "data_source": "synthetic",
>   "is_demo": true
> }
> ```

---

## 2. Standardized Units

| Measurement | Unit | Definition |
| :--- | :--- | :--- |
| **Crop Prices** | `INR/quintal` (₹/qtl) | 1 Quintal = 100 Kilograms |
| **Market Arrivals** | `quintals` (qtl) | Total physical produce arriving at the APMC yard per calendar day |
| **Distance** | `km` | Road transit distance between mandi yard centroids |
| **Freight Cost** | `INR / quintal / km` | ₹2.25 per quintal per km standard freight rate |
| **Storage Cost** | `INR / quintal / day` | ₹3.50 (ambient) and ₹8.00 (cold storage) per quintal per day |

---

## 3. Scope & Coverage

### Mandis (8 Karnataka APMC Markets)
1. **Bengaluru** (`mandi_bengaluru`): Yeshwanthpur APMC (Primary state urban consumer hub)
2. **Kolar** (`mandi_kolar`): Kolar APMC Market Yard (Asia's second largest tomato trading hub)
3. **Mysuru** (`mandi_mysuru`): Bandipalya APMC
4. **Mandya** (`mandi_mandya`): Mandya APMC Yard
5. **Hubballi** (`mandi_hubballi`): Amargol APMC (North Karnataka commercial trading hub)
6. **Belagavi** (`mandi_belagavi`): Belagavi APMC Yard
7. **Davanagere** (`mandi_davanagere`): Davanagere APMC Yard (Central Karnataka grain hub)
8. **Hassan** (`mandi_hassan`): Hassan APMC Yard (State potato trading center)

### Crops (6 Major Karnataka Commodities)
1. **Tomato** (`crop_tomato`): Perishable vegetable (base ~₹2,200/qtl, shelf life 6 days ambient)
2. **Onion** (`crop_onion`): Semi-perishable vegetable (base ~₹2,100/qtl, shelf life 45 days ambient)
3. **Potato** (`crop_potato`): Tuber vegetable (base ~₹1,650/qtl, shelf life 60 days ambient)
4. **Maize** (`crop_maize`): Grain/cereal staple (base ~₹2,150/qtl, shelf life 180 days ambient)
5. **Green Chilli** (`crop_chilli`): Perishable spice (base ~₹4,200/qtl, shelf life 5 days ambient)
6. **Ragi** (`crop_ragi`): Finger millet staple (base ~₹3,100/qtl, shelf life 240 days ambient)

---

## 4. Modeling & Simulation Assumptions

1. **Temporal Horizon**: 1,029 consecutive calendar days from `2024-01-01` through `2026-10-25`.
2. **Price Bounds Guarantee**: Every record mathematically satisfies:
   $$\text{min\_price} \le \text{modal\_price} \le \text{max\_price}$$
3. **Seasonality**: Annual sinusoidal harmonic representing post-monsoon and summer harvesting peaks.
4. **Arrival Elasticity**: Higher daily arrival volumes apply downward pressure on the modal price, modeled through negative elasticity $(\epsilon = -0.15)$ plus stochastic Gaussian noise.
5. **Regional Variation**: Urban consumer centers (e.g. Bengaluru) exhibit a +8% premium, while major producing centers have higher localized arrival spikes.
6. **Simulated Shock Events**: 4 isolated shock windows (unseasonal rains / supply chain halts) triggering sudden arrival drops and temporary price spikes.
7. **Reproducibility**: Seed fixed at `RANDOM_SEED = 42`.

---

## 5. How to Regenerate the Dataset

From the `backend/` directory:
```powershell
.\venv\Scripts\python app\data\synthetic\generate_synthetic_data.py
```
This overwrites `mandis.json`, `crops.json`, `costs.json`, `prices.csv`, and `arrivals.csv` deterministically.
