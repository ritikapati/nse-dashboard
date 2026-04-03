function round(value) {
  return Math.round(value * 100) / 100;
}

function createSeries(startYear, startMonth, points, base, amplitude, slope, phase = 0) {
  const series = [];

  for (let index = 0; index < points; index += 1) {
    const date = new Date(startYear, startMonth + index, 1);
    const seasonal = Math.sin((index + phase) / 2.4) * amplitude;
    const cyclical = Math.cos((index + phase) / 5.2) * (amplitude * 0.55);
    const pe = round(base + seasonal + cyclical + (index * slope));

    series.push({
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      pe
    });
  }

  return series;
}

function buildYears(series) {
  const yearsMap = new Map();

  series.forEach((point) => {
    const [yearText, monthText] = point.date.split('-');
    const year = Number.parseInt(yearText, 10);
    const monthIndex = Number.parseInt(monthText, 10) - 1;

    if (!yearsMap.has(year)) {
      yearsMap.set(year, new Array(12).fill(null));
    }

    yearsMap.get(year)[monthIndex] = point.pe;
  });

  return Array.from(yearsMap.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([year, months]) => ({ year, months }));
}

function summarize(series) {
  const values = series
    .map((point) => point.pe)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);

  const currentPE = values[values.length - 1];
  const medianPE = values[Math.floor(values.length / 2)];
  const lowestPE = values[Math.floor(values.length * 0.1)];
  const highestPE = values[Math.floor(values.length * 0.9)];
  const diffFromMedian = round(((currentPE - medianPE) / medianPE) * 100);

  let valuation = 'FAIR';
  let valuationLabel = 'Fair';

  if (currentPE < medianPE * 0.9) {
    valuation = 'UNDERVALUED';
    valuationLabel = 'Undervalued';
  } else if (currentPE > medianPE * 1.1) {
    valuation = 'OVERVALUED';
    valuationLabel = 'Overvalued';
  }

  return {
    currentPE,
    medianPE,
    lowestPE,
    highestPE,
    diffFromMedian,
    valuation,
    valuationLabel,
    fairRangeLow: round(medianPE * 0.9),
    fairRangeHigh: round(medianPE * 1.1),
    currentDate: series[series.length - 1]?.date || 'N/A',
    lookbackYears: 5,
    dataQuality: 'Seeded',
    coveragePct: 100,
    cleanedRecords: series.length,
    marketMood:
      diffFromMedian > 5
        ? 'Market is trading above its 5Y median valuation'
        : diffFromMedian < -5
          ? 'Market is trading below its 5Y median valuation'
          : 'Market is near its 5Y median valuation'
  };
}

function createIndex(symbol, name, description, base, amplitude, slope, phase, pb, dy) {
  const series = createSeries(2022, 0, 36, base, amplitude, slope, phase);
  const peSummary = summarize(series);

  return {
    symbol,
    name,
    description,
    pb,
    dy,
    series,
    years: buildYears(series),
    peSummary
  };
}

const indexAnalysisData = [
  createIndex('NIFTY50', 'NIFTY 50', 'Broad market benchmark with diversified sector exposure.', 21.8, 2.8, 0.03, 0, 3.6, 1.22),
  createIndex('NIFTYBANK', 'NIFTY BANK', 'Banking-heavy basket focused on large private and PSU lenders.', 17.4, 2.1, 0.02, 2, 2.8, 1.08),
  createIndex('NIFTYIT', 'NIFTY IT', 'Technology-focused index with global export sensitivity.', 26.3, 3.6, 0.01, 4, 7.1, 1.54)
];

function getIndexByName(name) {
  const normalizedName = String(name || '').trim().toUpperCase();
  return indexAnalysisData.find((item) => item.symbol === normalizedName || item.name.toUpperCase() === normalizedName) || null;
}

function getIndexComparison() {
  return indexAnalysisData.map((item) => ({
    name: item.name,
    symbol: item.symbol,
    pe: item.peSummary.currentPE,
    medianPE: item.peSummary.medianPE,
    valuation: item.peSummary.valuationLabel
  }));
}

module.exports = {
  indexAnalysisData,
  getIndexByName,
  getIndexComparison
};
