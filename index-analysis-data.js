const indexCatalog = [
  {
    symbol: 'NIFTY50',
    name: 'NIFTY 50',
    nseIndexName: 'NIFTY 50',
    description: 'Broad market benchmark with diversified sector exposure.'
  },
  {
    symbol: 'NIFTYNEXT50',
    name: 'NIFTY NEXT 50',
    nseIndexName: 'NIFTY NEXT 50',
    description: 'Large-cap expansion basket tracking the next rung below NIFTY 50 leaders.'
  },
  {
    symbol: 'NIFTY100',
    name: 'NIFTY 100',
    nseIndexName: 'NIFTY 100',
    description: 'Combined large-cap benchmark covering NIFTY 50 and NIFTY NEXT 50 constituents.'
  },
  {
    symbol: 'NIFTY500',
    name: 'NIFTY 500',
    nseIndexName: 'NIFTY 500',
    description: 'Broad market index spanning large, mid, and small-cap companies across sectors.'
  },
  {
    symbol: 'NIFTYBANK',
    name: 'NIFTY BANK',
    nseIndexName: 'NIFTY BANK',
    description: 'Banking-heavy basket focused on large private and PSU lenders.'
  },
  {
    symbol: 'NIFTYIT',
    name: 'NIFTY IT',
    nseIndexName: 'NIFTY IT',
    description: 'Technology-focused index with global export sensitivity.'
  },
  {
    symbol: 'NIFTYFMCG',
    name: 'NIFTY FMCG',
    nseIndexName: 'NIFTY FMCG',
    description: 'Consumer staples basket with defensive earnings and steady cash generation.'
  },
  {
    symbol: 'NIFTYAUTO',
    name: 'NIFTY AUTO',
    nseIndexName: 'NIFTY AUTO',
    description: 'Automobile and auto-ancillary index tied to domestic demand and export cycles.'
  },
  {
    symbol: 'NIFTYPHARMA',
    name: 'NIFTY PHARMA',
    nseIndexName: 'NIFTY PHARMA',
    description: 'Pharmaceutical and healthcare names with regulatory and export exposure.'
  },
  {
    symbol: 'NIFTYMETAL',
    name: 'NIFTY METAL',
    nseIndexName: 'NIFTY METAL',
    description: 'Cyclical metals and mining index sensitive to commodity prices and capex demand.'
  },
  {
    symbol: 'NIFTYENERGY',
    name: 'NIFTY ENERGY',
    nseIndexName: 'NIFTY ENERGY',
    description: 'Energy-focused basket spanning oil, gas, power, and related infrastructure.'
  },
  {
    symbol: 'NIFTYMIDCAP100',
    name: 'NIFTY MIDCAP 100',
    nseIndexName: 'NIFTY MIDCAP 100',
    description: 'Mid-cap benchmark capturing growth-oriented companies beyond the large-cap universe.'
  },
  {
    symbol: 'NIFTYSMALLCAP100',
    name: 'NIFTY SMALLCAP 100',
    nseIndexName: 'NIFTY SMALLCAP 100',
    description: 'Small-cap basket reflecting higher-risk, higher-volatility emerging market segments.'
  },
  {
    symbol: 'NIFTYMIDCAP50',
    name: 'NIFTY MIDCAP 50',
    nseIndexName: 'NIFTY MIDCAP 50',
    description: 'Mid-cap benchmark capturing growth-oriented companies beyond the large-cap universe.'
  },
  {
    symbol: 'NIFTYSMALLCAP50',
    name: 'NIFTY SMALLCAP 50',
    nseIndexName: 'NIFTY SMALLCAP 50',
    description: 'Small-cap basket reflecting higher-risk, higher-volatility emerging market segments.'
  }
];

function getIndexByName(name) {
  const normalizedName = String(name || '').trim().toUpperCase();
  return indexCatalog.find((item) => item.symbol === normalizedName || item.name.toUpperCase() === normalizedName) || null;
}

module.exports = {
  indexCatalog,
  getIndexByName
};
