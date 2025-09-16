# India CCTS — MACC Builder (Multi‑Firm, Catalog‑Aware)

A React app for building **Marginal Abatement Cost Curves (MACCs)** for firms in India. It supports multiple firms, per‑firm sectors and baselines, catalog‑aware measure modeling, adoption ramps, financing, carbon‑price deltas, and export/import workflows.

> **Highlights**
> - Multi‑firm profiles with per‑firm **sectors**, **baselines**, **catalogs**, **currency (₹)**, and **carbon price**  
> - **Wizard data source switch**: *Sample / Custom / Merged* (custom overrides sample)  
> - **Firm Catalogs Editor**: fuels, raw materials, transport, waste, and electricity (CSV/JSON import/export)  
> - **MACC builder**: step bars or quadratic fit, adoption ramps, NPV/IRR, PNG export  
> - **Hover overlay guards**, **quadratic fit (a,b,c) + R²**, carbon‑price delta handling, legend overflow, safer inputs  
> - Local persistence via **localStorage**; full **firm export/import (.json)**

---

## Table of Contents

- [Quickstart](#quickstart)  
- [Data Files & Schemas](#data-files--schemas)  
- [How the App Works](#how-the-app-works)  
- [Methodology (Formulas)](#methodology-formulas)  
- [Key UI Components](#key-ui-components)  
- [Persistence & Import/Export](#persistence--importexport)  
- [Troubleshooting](#troubleshooting)  
- [Tech Stack & Scripts](#tech-stack--scripts)  
- [Folder Structure](#folder-structure)  
- [License](#license)

---

## Quickstart

### 1) Prerequisites
- **Node.js 18+**
- A React app scaffold (Vite or CRA). Tailwind CSS is optional but recommended (the app uses Tailwind utility classes for styling).
- Dependencies:
  ```bash
  npm i react react-dom recharts
  # Optional, for styling:
  # npm i -D tailwindcss postcss autoprefixer
  ```

### 2) Add the component
Place `MACCApp.jsx` in your `src/` folder and render it from your app entry:
```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import MACCApp from "./MACCApp";

ReactDOM.createRoot(document.getElementById("root")).render(<MACCApp />);
```

### 3) Provide sample data
Create `public/data/` and add:
- `measures.csv`
- `sectors.json`
- `baselines.json`
- `fuels.json`
- `raw.json`
- `transport.json`
- `waste.json`
- `electricity.json`

See **[Data Files & Schemas](#data-files--schemas)** for formats. The app loads these via `fetch('/data/...')`.

### 4) Run
```bash
npm run dev   # Vite or CRA dev server
```
Open the app, confirm the sample data loads, then start modeling.

---

## Data Files & Schemas

All sample data is read from `/public/data/`. You can ship richer defaults here; firms can later override catalogs in‑app.

### `measures.csv`
Headers (minimum):
```csv
id,name,sector,abatement_tco2,cost_per_tco2,selected,details
```
- `details` can be empty or a JSON string. If you save a measure from the wizard, it includes `details.mode`, `per_year`, `finance_summary`, and `saved_cost_includes_carbon_price`.

### `sectors.json`
```json
["Power","Cement","Steel","Chemicals"]
```

### `baselines.json`
```json
{
  "Power":    { "production_label": "MWh",  "annual_production": 100000, "annual_emissions": 800000 },
  "Cement":   { "production_label": "t",    "annual_production": 50000,  "annual_emissions": 600000 },
  "Steel":    { "production_label": "t",    "annual_production": 30000,  "annual_emissions": 450000 }
}
```

### Catalogs

All catalogs support **CSV import** and **JSON import** in the app. The wizard uses **resolved catalogs** based on the selected mode:
- **Sample**: use only `/public/data/*`.
- **Custom**: use only the firm’s custom catalogs.
- **Merged** (default): Sample with Custom overriding by `name` (or `state` for electricity).

#### `fuels.json`, `raw.json`, `transport.json`, `waste.json`
```json
[
  { "name": "Coal", "unit": "t", "price_per_unit_inr": 7000, "ef_tco2_per_unit": 2.42 },
  { "name": "Diesel", "unit": "kl", "price_per_unit_inr": 90000, "ef_tco2_per_unit": 2.68 }
]
```
CSV columns:
```
name,unit,price_per_unit_inr,ef_tco2_per_unit
```
Aliases accepted by the parser: `price_per_unit | price`, `ef_t_per_unit | ef_t`

#### `electricity.json`
```json
[
  { "state": "India", "price_per_mwh_inr": 5000, "ef_tco2_per_mwh": 0.71 },
  { "state": "Gujarat", "price_per_mwh_inr": 4800, "ef_tco2_per_mwh": 0.64 }
]
```
CSV columns:
```
state,price_per_mwh_inr,ef_tco2_per_mwh
```
Aliases: `price_per_mwh | price`, `ef_t_per_mwh | ef_t`

---

## How the App Works

### Firms & Persistence
- Multiple firms stored in **localStorage** with keys like `macc_firm_{id}_*`.
- Each firm has: sectors, baselines, measures, currency (₹), carbon price, and **custom catalogs**.
- Use **Manage Firms** to create, rename, switch, delete, export/import.

### Catalog Modes (Wizard data source)
- **Sample**: use only `/public/data/*`.
- **Custom**: use only the firm’s custom catalogs.
- **Merged** (default): Sample with Custom overriding by `name`/`state`.

### Measure Wizard (Template/Quick)
- **Quick**: directly set abatement (tCO₂) and cost (₹/tCO₂).
- **Template (catalog‑aware)**:
  - **Adoption** (0–1) over `[2025, 2030, 2035, 2040, 2045, 2050]`
  - **Drivers**: Fuels, Raw, Transport, Waste, Electricity — each with Δ series, price/EF overrides, and yearly drifts
  - **Other direct reductions** (tCO₂e): positive = reduction
  - **Cost stack** (₹ cr): opex, savings, other, capex upfront, capex financed, tenure, interest
  - **Finance**: NPV/IRR (with/without CP)
  - **Save representative year**: first year with abatement > 0; else 2035; else midpoint  
  - Option to **save cost including carbon price** (stores flags for correct future normalization)

### MACC Construction
- Bars sorted by **effective cost** ascending:
  - If a measure was saved **including** CP at `cp_at_save`:  
    `effective_cost = saved_cost − (cp_now − cp_at_save)`
  - If saved **without** CP:  
    `effective_cost = saved_cost − cp_now`
- **X axis**:
  - **Capacity**: cumulative **tCO₂**
  - **Intensity**: cumulative **% of baseline emissions** = `(tons / baseline_emissions) × 100`
- **Y axis**: marginal cost (₹/tCO₂), unaffected by intensity mode
- **Quadratic fit** (optional): shows `cost(x) = a + b·x + c·x²` with R²

### Target & Budget
- Set a % target. In capacity mode that % is converted back to tons using the baseline emissions.
- Budget is computed as Σ(taken tons × effective cost).

### Export / Import
- Measures CSV export/import
- Firm JSON export/import (sectors, baselines, measures, catalogs, CP, mode)
- Chart **PNG export**

---

## Methodology (Formulas)

**Year set**: `YEARS = [2025, 2030, 2035, 2040, 2045, 2050]`, base year `2025`.  
**Adoption**: `a_i ∈ [0,1]` per year.  
**Other Direct**: `otherDirectT[i]` (tCO₂e); positive means **reduction**.

### For each year *i* (Δt = `year - 2025`)

**Non‑electric line** (fuel/raw/transport/waste):
```
P_i  = (priceOv ?? catalog_price)   * (1 + gP)^(Δt)   // ₹/unit
EF_i = (efOv    ?? catalog_ef)      * (1 + gEF)^(Δt)  // tCO₂/unit
Q_i  = a_i * Δ[i]                                   // signed quantity change

t_line_i  = Q_i * EF_i                              // tCO₂
cr_line_i = (Q_i * P_i) / 10_000_000                // ₹ cr
```

**Electricity line**:
```
P_i  = (priceOv ?? price_per_mwh) * (1 + gP)^(Δt)     // ₹/MWh
EF_i = efOvPerYear[i] !== "" ? efOvPerYear[i]
      : catalog_ef * (1 + gEF)^(Δt)                   // tCO₂/MWh
M_i  = a_i * deltaMWh[i]

t_elec_i  = M_i * EF_i                                // tCO₂
cr_elec_i = (M_i * P_i) / 10_000_000                  // ₹ cr
```

**Totals**:
```
emission_delta_t = Σ t_line_i + Σ t_elec_i + (− a_i * otherDirectT[i])
reduction_t      = max(0, − emission_delta_t)         // non-negative
driver_cr        = Σ cr_line_i + Σ cr_elec_i          // ₹ cr
```

**Financing**:
```
financedAnnual_cr = capex_financed_cr[i] * annuityFactor(interest_rate_pct[i]/100, tenure[i])
```

**Net cost (₹ cr)** used for per‑ton:
```
net_cost_cr = driver_cr + opex_cr[i] + other_cr[i] − savings_cr[i] + financedAnnual_cr
```

**Cashflows (₹)**:
```
CF_woCP = (savings_cr − opex_cr − driver_cr − other_cr − financedAnnual_cr − capex_upfront_cr) * 10_000_000
CF_wCP  = CF_woCP + carbon_price * reduction_t
```

**Per‑ton (₹/tCO₂) when reduction_t > 0**:
```
cost_woCP = (net_cost_cr * 10_000_000) / reduction_t
cost_wCP  = (net_cost_cr * 10_000_000 − carbon_price * reduction_t) / reduction_t
```

**Representative year saved**:
```
abatement_tco2 = reduction_t[repIdx]
cost_per_tco2  = cost_wCP[repIdx] if saved_including_CP else cost_woCP[repIdx]
```

**MACC effective cost at runtime**:
```
effective_cost =
  saved_including_CP ? saved_cost − (cp_now − cp_at_save)
                     : saved_cost − cp_now
```

---

## Key UI Components

- **Manage Firms**: create/rename/switch/delete; export/import full firm JSON. Renaming syncs the “Firm – {name}” sector label.
- **Catalogs Editor**: pick data source, add rows, CSV/JSON import/export, reset to sample, start blank.
- **Measure Wizard**:
  - **Quick**: manual abatement & cost
  - **Template**: catalog‑aware multi‑line drivers, adoption profile, finance stack, EF/price drifts, electricity EFs per year
  - Interpolate 5‑year columns linearly
  - Save “including carbon price” option (stores flags)
- **MACC Chart**: step rectangles w/ hover overlay; quadratic fit mode (a,b,c,R²); export PNG
- **Timeseries Viewer**: per‑year `direct_t` and `net_cost_cr` for a specific measure

---

## Persistence & Import/Export

**LocalStorage keys** (per firm):
```
macc_firm_{id}_sectors
macc_firm_{id}_baselines
macc_firm_{id}_measures
macc_firm_{id}_currency
macc_firm_{id}_carbon_price
macc_firm_{id}_catalogs_fuels
macc_firm_{id}_catalogs_raw
macc_firm_{id}_catalogs_transport
macc_firm_{id}_catalogs_waste
macc_firm_{id}_catalogs_electricity
macc_firm_{id}_catalog_mode
```

**Export Firm (.json)**: bundles the above into a single file.  
**Import Firm (.json)**: replaces the active firm’s data.

---

## Troubleshooting

- **“Failed to load data”**: Ensure all files exist in `public/data/` and are valid JSON/CSV. The app uses `fetch('/data/*.json')` and `fetch('/data/measures.csv')`.
- **Blank chart**: Measures may be unselected or have `abatement_tco2 <= 0`. Ensure the representative year in the wizard has positive reductions.
- **Carbon price looks double‑counted**: Check the measure’s `details.saved_cost_includes_carbon_price` and `details.carbon_price_at_save`. The runtime normalization subtracts only the **delta** vs. current CP if it was already included.
- **Legend overflow**: The legend truncates intentionally and shows `+N more` to avoid clutter.

---

## Tech Stack & Scripts

- **React + Recharts** (charts)
- **Tailwind CSS** (optional but recommended for styling)
- **LocalStorage** for persistence
- **PNG export** by serializing the Recharts SVG → `<canvas>` → `.png`

Typical scripts (Vite):
```json
{
  "scripts": {
    "dev":    "vite",
    "build":  "vite build",
    "preview":"vite preview"
  }
}
```

---

## Folder Structure

```
your-app/
  public/
    data/
      measures.csv
      sectors.json
      baselines.json
      fuels.json
      raw.json
      transport.json
      waste.json
      electricity.json
  src/
    MACCApp.jsx
    main.jsx
    index.css
  package.json
  README.md
  ...
```

> **Note**: The app expects data at runtime under `/data/…`. In CRA/Vite, `public/` is served at the root (`/)`, so `public/data/...` becomes `/data/...`.

---

## License

This project is provided as‑is. Add your preferred license here (e.g., MIT) and attribution lines if you package sample datasets.

---

### Acknowledgements

Built for **India CCTS**; © Shunya Lab.  
Thanks to the open‑source community behind React and Recharts.
