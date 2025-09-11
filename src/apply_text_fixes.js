#!/usr/bin/env node
'use strict';

/**
 * One-time text cleanser for MACCApp.jsx UI copy.
 * - Backs up the original file with a timestamp.
 * - Applies exact literal find→replace pairs for user-visible text only.
 * - Safe to re-run: replacements are idempotent.
 *
 * Usage:
 *   node apply_text_fixes.js /path/to/MACCApp.jsx --dry-run
 *   node apply_text_fixes.js /path/to/MACCApp.jsx
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (!args.length || args.some(a => a === '--help' || a === '-h')) {
  console.log('Usage: node apply_text_fixes.js <path-to-MACCApp.jsx> [--dry-run]');
  process.exit(0);
}
const dryRun = args.includes('--dry-run');
const filePath = args.find(a => !a.startsWith('--')) || 'MACCApp.jsx';

function countOccurrences(haystack, needle) {
  if (!needle || !haystack) return 0;
  let count = 0, idx = 0;
  for (;;) {
    idx = haystack.indexOf(needle, idx);
    if (idx === -1) break;
    count++;
    idx += needle.length;
  }
  return count;
}

function ts() {
  // ISO-like, safe for filenames: 2025-09-11T14-22-33Z
  return new Date().toISOString().replace(/:/g, '-');
}

const replacements = [
  // App header & global
  { find: `India CCTS – Marginal Abatement Cost Curve (MACC) Builder`, replace: `India CCTS — Marginal Abatement Cost Curve (MACC) Builder` },
  { find: `Use sample data or bring your own catalogs, then build your firm’s MACC.`, replace: `Load sample data or your own catalogs to build your firm's MACC.` },

  // Header controls
  { find: `Wizard data:`, replace: `Data source:` },
  { find: `Wizard data`,  replace: `Data source` },

  // Settings (view & cost model)
  { find: `Capacity-based`, replace: `Capacity` },
  { find: `Intensity-based`, replace: `Intensity` },
  { find: `Capacity: cumulative tCO₂; Intensity: cumulative % reduction vs baseline.`, replace: `Capacity: cumulative tCO₂. Intensity: cumulative % reduction vs. baseline.` },
  { find: `Continuous (coloured)`, replace: `Step (stacked)` },
  { find: `Costs in MACC reflect <b>saved cost − carbon price</b> (delta-adjusted if cost already included CP).`, replace: `MACC costs reflect <b>savings − carbon price</b>. If a measure already included a carbon price, only the difference from the current carbon price is subtracted.` },

  // Firm data & catalogs
  { find: `Driver & EF Catalogs (Fuels / Raw / Transport / Waste / Electricity)`, replace: `Catalogs — Drivers & EFs (Fuels, Raw, Transport, Waste, Electricity)` },
  { find: `Firm Catalogs — Drivers & EFs`, replace: `Catalogs — Drivers & emission factors` },
  { find: `+ Add Row`, replace: `+ Add row` },
  { find: `Reset to Sample`, replace: `Reset to sample` },
  { find: `Start Blank`, replace: `Start blank` },
  { find: `CSV columns expected:`, replace: `CSV columns:` },
  { find: `state, price_per_mwh_inr, ef_tco2_per_mwh (aliases accepted: price_per_mwh | price; ef_t_per_mwh | ef_t)`, replace: `state, price_per_mwh_inr, ef_tco2_per_mwh (aliases: price_per_mwh | price; ef_t_per_mwh | ef_t)` },
  { find: `name, unit, price_per_unit_inr, ef_tco2_per_unit (aliases accepted: price_per_unit | price; ef_t_per_unit | ef_t)`, replace: `name, unit, price_per_unit_inr, ef_tco2_per_unit (aliases: price_per_unit | price; ef_t_per_unit | ef_t)` },

  // Manage Firms modal
  { find: `Your Firms`, replace: `Firms` },
  { find: `Create New Firm`, replace: `Create new firm` },
  { find: `Create Firm`, replace: `Create firm` },
  { find: `Export / Import`, replace: `Export / import` },
  { find: `Export Active Firm (.json)`, replace: `Export active firm (.json)` },

  // Measure Wizard — tabs & quick
  { find: `Template (DB-aware)`, replace: `Template (catalog-aware)` },
  { find: `Use in MACC`, replace: `Include in MACC` },

  // Measure Wizard — metadata & adoption
  { find: `Project Metadata`, replace: `Project details` },
  { find: `Adoption profile (fraction 0–1)`, replace: `Adoption profile (0–1)` },
  { find: `Adoption fraction`, replace: `Adoption` },
  { find: `Share of total potential adopted in each year. 0=no adoption, 1=full adoption. Multiplies all Δ quantities for that year.`, replace: `Share of total potential adopted in each year (0 = none, 1 = full). Applied to all Δ quantities that year.` },
  { find: `Applied multiplicatively to all Δ quantities (fuel/raw/transport/waste/electricity/other).`, replace: `Applied to all Δ quantities (fuel/raw/transport/waste/electricity/other).` },
  { find: `Driver & Emissions Lines`, replace: `Drivers & Emissions` },

  // Drivers
  { find: `EF override (blank = use state/EF drift)`, replace: `EF override (blank uses state/EF drift)` },
  { find: `Leave blank to use the catalog price for this item. If filled, this replaces the catalog price in the base year; annual Price drift then applies on top.`, replace: `Leave blank to use the catalog value. If set, this overrides the base‑year value; annual drift applies afterward.` },
  { find: `Leave blank to use the catalog emission factor (EF). If filled, this replaces EF in the base year; EF drift then applies on top.`, replace: `Leave blank to use the catalog EF. If set, this overrides the base‑year EF; EF drift applies afterward.` },
  { find: `Water & waste lines`, replace: `Water and waste lines` },
  { find: `ΔWater/waste quantity`, replace: `ΔWater and waste quantity` },

  // Other reductions & financing
  { find: `Other direct emissions reduction (optional)`, replace: `Other direct reductions (optional)` },
  { find: `Direct reductions not captured by the lines above (e.g., process changes, fugitives). Positive = reduction; negative = increase.`, replace: `Direct reductions not captured above (e.g., process changes, fugitives). Positive reduces emissions; negative increases.` },
  { find: `Cost stack & financing (₹ cr)`, replace: `Cost stack and financing (₹ cr)` },
  { find: `Recurring operating costs (positive adds cost, negative reduces cost). Applied to each year.`, replace: `Recurring operating costs (positive adds cost; negative is savings). Applied each year.` },
  { find: `Recurring operating savings (positive lowers net cost). Applied to each year.`, replace: `Recurring operating savings (positive). Applied each year.` },
  { find: `Portion of capex to be financed and converted to a yearly annuity using Interest rate and Tenure.`, replace: `Portion of capex to be financed and converted to a yearly annuity using the interest rate and tenure.` },

  // Roll-ups
  { find: `Rep. cost (w/o CP)`, replace: `Rep. cost (without CP)` },
  { find: `Rep. cost (with CP =`, replace: `Rep. cost (with carbon price =` },
  { find: `NPV (w/o CP)`, replace: `NPV (without CP)` },
  { find: `IRR (w/o CP)`, replace: `IRR (without CP)` },
  { find: `w/o CP:`, replace: `without CP:` },

  // MACC chart & side panel
  { find: `Target & Budget (greedy stack)`, replace: `Target & budget` },
  { find: `In <b>Intensity</b> mode, % refers to share of baseline emissions per <b>`, replace: `In <b>Intensity</b> mode, % is the share of baseline emissions per <b>` },
  { find: `Budget required (Σ cost×tCO₂):`, replace: `Budget required (∑ cost × tCO₂):` },
  { find: `Costs reflect <b>saved cost − carbon price</b>. If a measure was saved “including carbon price”, the chart subtracts only the <i>difference</i> between the current and saved carbon price.`, replace: `Costs reflect <b>savings − carbon price</b>. If a measure was saved “including carbon price,” the chart subtracts only the difference from the current carbon price.` },

  // Measures table & help
  { find: `Marginal cost (input) (`, replace: `Input marginal cost (` },
  { find: `View timeseries`, replace: `View time series` },
  { find: `CSV columns: <code>id, name, sector, abatement_tco2, cost_per_tco2, selected, details</code>. If <code>details.saved_cost_includes_carbon_price=true</code>, the chart subtracts only the <i>delta</i> between the current carbon price and <code>details.carbon_price_at_save</code>.`, replace: `CSV columns: <code>id, name, sector, abatement_tco2, cost_per_tco2, selected, details</code>. If <code>details.saved_cost_includes_carbon_price = true</code>, the chart subtracts only the difference between the current carbon price and <code>details.carbon_price_at_save</code>.` },

  // Time-series viewer
  { find: `Measure timeseries —`, replace: `Time series —` },

  // Methodology & footer
  { find: `Wizard uses the selected <b>catalog source</b> (Sample / Custom / Merged). In Merged mode, custom entries override sample by <code>name</code> (or <code>state</code> for electricity).`, replace: `Wizard uses the selected data source (Sample / Custom / Merged). In Merged mode, custom entries override sample values by <code>name</code> (or <code>state</code> for electricity).` },
  { find: `Continuous MACC uses coloured rectangles (width = potential, height = cost − carbon price or delta‑adjusted if already applied).`, replace: `The step MACC uses colored rectangles (width = potential; height = cost − carbon price, adjusted if already included).` },
  { find: `Built for India CCTS exploration — sample DB + your custom data, all in one app.`, replace: `Built for India CCTS—works with sample and custom data.` },
];

let text;
try {
  text = fs.readFileSync(filePath, 'utf8');
} catch (e) {
  console.error(`✖ Cannot read file: ${filePath}\n${e.message}`);
  process.exit(1);
}

const report = [];
let updated = text;

for (const { find, replace } of replacements) {
  const hits = countOccurrences(updated, find);
  if (hits > 0) {
    updated = updated.split(find).join(replace);
    report.push({ find, replace, hits });
  }
}

if (dryRun) {
  console.log(`🛈 Dry run: ${report.length} distinct strings would change in ${path.basename(filePath)}.`);
  const total = report.reduce((s, r) => s + r.hits, 0);
  console.log(`   Total occurrences affected: ${total}`);
  report.slice(0, 25).forEach((r, i) =>
    console.log(`${String(i + 1).padStart(2, ' ')}. "${r.find}" → "${r.replace}"  [${r.hits}]`)
  );
  if (report.length > 25) console.log(`   …and ${report.length - 25} more mappings.`);
  process.exit(0);
}

// If nothing changed, exit gracefully
if (updated === text) {
  console.log('✓ No changes needed (all replacements already applied).');
  process.exit(0);
}

// Backup then write
try {
  const { dir, name, ext } = path.parse(filePath);
  const backup = path.join(dir, `${name}.before_text_fixes.${ts()}${ext}`);
  fs.writeFileSync(backup, text, 'utf8');
  fs.writeFileSync(filePath, updated, 'utf8');

  const total = report.reduce((s, r) => s + r.hits, 0);
  console.log(`✓ Applied ${report.length} distinct replacements (${total} occurrences).`);
  console.log(`  Backup saved as: ${backup}`);
} catch (e) {
  console.error(`✖ Failed to write changes: ${e.message}`);
  process.exit(1);
}
