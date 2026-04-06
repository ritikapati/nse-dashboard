const indexCatalog = [
  { symbol: 'NIFTY50', slug: 'nifty-50', name: 'NIFTY 50', nseIndexName: 'NIFTY 50', sector: 'Broad Market', description: 'Broad market benchmark with diversified sector exposure.' },
  { symbol: 'NIFTYNEXT50', slug: 'nifty-next-50', name: 'NIFTY NEXT 50', nseIndexName: 'NIFTY NEXT 50', sector: 'Broad Market', description: 'Large-cap expansion basket tracking the next rung below NIFTY 50 leaders.' },
  { symbol: 'NIFTY100', slug: 'nifty-100', name: 'NIFTY 100', nseIndexName: 'NIFTY 100', sector: 'Broad Market', description: 'Combined large-cap benchmark covering NIFTY 50 and NIFTY NEXT 50 constituents.' },
  { symbol: 'NIFTY200', slug: 'nifty-200', name: 'NIFTY 200', nseIndexName: 'NIFTY 200', sector: 'Broad Market', description: 'Expanded diversified benchmark across large and upper mid-cap leaders.' },
  { symbol: 'NIFTY500', slug: 'nifty-500', name: 'NIFTY 500', nseIndexName: 'NIFTY 500', sector: 'Broad Market', description: 'Broad market index spanning large, mid, and small-cap companies across sectors.' },
  { symbol: 'NIFTYBANK', slug: 'nifty-bank', name: 'NIFTY BANK', nseIndexName: 'NIFTY BANK', sector: 'Financials', description: 'Banking-heavy basket focused on large private and PSU lenders.' },
  { symbol: 'NIFTYFINSERVICE', slug: 'nifty-financial-services', name: 'NIFTY FINANCIAL SERVICES', nseIndexName: 'NIFTY FINANCIAL SERVICES', sector: 'Financials', description: 'Financial ecosystem benchmark spanning banks, insurers, and diversified finance.' },
  { symbol: 'NIFTYIT', slug: 'nifty-it', name: 'NIFTY IT', nseIndexName: 'NIFTY IT', sector: 'Technology', description: 'Technology-focused index with global export sensitivity.' },
  { symbol: 'NIFTYFMCG', slug: 'nifty-fmcg', name: 'NIFTY FMCG', nseIndexName: 'NIFTY FMCG', sector: 'Consumer Staples', description: 'Consumer staples basket with defensive earnings and steady cash generation.' },
  { symbol: 'NIFTYAUTO', slug: 'nifty-auto', name: 'NIFTY AUTO', nseIndexName: 'NIFTY AUTO', sector: 'Automobiles', description: 'Automobile and auto-ancillary index tied to domestic demand and export cycles.' },
  { symbol: 'NIFTYPHARMA', slug: 'nifty-pharma', name: 'NIFTY PHARMA', nseIndexName: 'NIFTY PHARMA', sector: 'Healthcare', description: 'Pharmaceutical and healthcare names with regulatory and export exposure.' },
  { symbol: 'NIFTYMETAL', slug: 'nifty-metal', name: 'NIFTY METAL', nseIndexName: 'NIFTY METAL', sector: 'Materials', description: 'Cyclical metals and mining index sensitive to commodity prices and capex demand.' },
  { symbol: 'NIFTYENERGY', slug: 'nifty-energy', name: 'NIFTY ENERGY', nseIndexName: 'NIFTY ENERGY', sector: 'Energy', description: 'Energy-focused basket spanning oil, gas, power, and related infrastructure.' },
  { symbol: 'NIFTYREALTY', slug: 'nifty-realty', name: 'NIFTY REALTY', nseIndexName: 'NIFTY REALTY', sector: 'Real Estate', description: 'Real estate developers and property-linked businesses with cyclical sensitivity.' },
  { symbol: 'NIFTYPSUBANK', slug: 'nifty-psu-bank', name: 'NIFTY PSU BANK', nseIndexName: 'NIFTY PSU BANK', sector: 'Financials', description: 'Public-sector banking benchmark shaped by rate cycles and state-owned lenders.' },
  { symbol: 'NIFTYMIDCAP50', slug: 'nifty-midcap-50', name: 'NIFTY MIDCAP 50', nseIndexName: 'NIFTY MIDCAP 50', sector: 'Midcap', description: 'Mid-cap basket focused on the leading 50 names in the mid-cap segment.' },
  { symbol: 'NIFTYMIDCAP100', slug: 'nifty-midcap-100', name: 'NIFTY MIDCAP 100', nseIndexName: 'NIFTY MIDCAP 100', sector: 'Midcap', description: 'Mid-cap benchmark capturing growth-oriented companies beyond the large-cap universe.' },
  { symbol: 'NIFTYSMALLCAP50', slug: 'nifty-smallcap-50', name: 'NIFTY SMALLCAP 50', nseIndexName: 'NIFTY SMALLCAP 50', sector: 'Smallcap', description: 'Small-cap basket tracking a concentrated set of emerging smaller companies.' },
  { symbol: 'NIFTYSMALLCAP100', slug: 'nifty-smallcap-100', name: 'NIFTY SMALLCAP 100', nseIndexName: 'NIFTY SMALLCAP 100', sector: 'Smallcap', description: 'Small-cap basket reflecting higher-risk, higher-volatility emerging market segments.' },
  { symbol: 'NIFTYMICROCAP250', slug: 'nifty-microcap-250', name: 'NIFTY MICROCAP 250', nseIndexName: 'NIFTY MICROCAP 250', sector: 'Microcap', description: 'Microcap index representing the smaller end of the listed market universe.' },
  { symbol: 'NIFTYDIVOPP50', slug: 'nifty-dividend-opportunities-50', name: 'NIFTY DIVIDEND OPPORTUNITIES 50', nseIndexName: 'NIFTY DIVIDEND OPPORTUNITIES 50', sector: 'Strategy', description: 'Dividend-focused basket emphasizing high-yield companies with liquidity screens.' },
  { symbol: 'NIFTYGROWTH15', slug: 'nifty-growth-sectors-15', name: 'NIFTY GROWTH SECTORS 15', nseIndexName: 'NIFTY GROWTH SECTORS 15', sector: 'Strategy', description: 'Sector tilt toward growth-led businesses and structural expansion themes.' },
  { symbol: 'NIFTYVALUE20', slug: 'nifty-value-20', name: 'NIFTY VALUE 20', nseIndexName: 'NIFTY VALUE 20', sector: 'Strategy', description: 'Factor index favoring lower relative valuation across the eligible universe.' },
  { symbol: 'NIFTYLOWVOL50', slug: 'nifty-low-volatility-50', name: 'NIFTY LOW VOLATILITY 50', nseIndexName: 'NIFTY LOW VOLATILITY 50', sector: 'Strategy', description: 'Factor basket designed around historically lower realized volatility.' },
  { symbol: 'NIFTYINFRA', slug: 'nifty-infrastructure', name: 'NIFTY INFRASTRUCTURE', nseIndexName: 'NIFTY INFRASTRUCTURE', sector: 'Infrastructure', description: 'Infrastructure-linked companies across construction, utilities, and logistics.' },
  { symbol: 'NIFTYCONSUMPTION', slug: 'nifty-consumption', name: 'NIFTY CONSUMPTION', nseIndexName: 'NIFTY CONSUMPTION', sector: 'Consumer', description: 'Demand-side basket capturing consumer spending and discretionary staples exposure.' },
  { symbol: 'NIFTYCOMMODITIES', slug: 'nifty-commodities', name: 'NIFTY COMMODITIES', nseIndexName: 'NIFTY COMMODITIES', sector: 'Commodities', description: 'Commodity-linked businesses spanning metals, energy, and materials chains.' },
  { symbol: 'NIFTYSERVICES', slug: 'nifty-services-sector', name: 'NIFTY SERVICES SECTOR', nseIndexName: 'NIFTY SERVICES SECTOR', sector: 'Services', description: 'Service-led companies across telecom, finance, transport, and digital services.' },
  { symbol: 'NIFTYOILGAS', slug: 'nifty-oil-gas', name: 'NIFTY OIL & GAS', nseIndexName: 'NIFTY OIL & GAS', sector: 'Energy', description: 'Oil, gas, and downstream energy names sensitive to commodity and policy cycles.' }
];

function normalizeLookup(value) {
  return String(value || '').trim().toUpperCase();
}

function getIndexByName(name) {
  const normalizedName = normalizeLookup(name);
  return indexCatalog.find((item) => (
    item.symbol === normalizedName ||
    item.name.toUpperCase() === normalizedName ||
    item.slug.toUpperCase() === normalizedName ||
    item.nseIndexName.toUpperCase() === normalizedName
  )) || null;
}

module.exports = {
  indexCatalog,
  getIndexByName
};
