import React, { useEffect, useMemo, useState } from 'react';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, '') : 'N/A';
}

function toPercent(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return 50;
  }

  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

function toBandPercent(value, low, median, high) {
  const lower = median * 0.9;
  const upper = median * 1.1;

  if (!Number.isFinite(value) || !Number.isFinite(low) || !Number.isFinite(median) || !Number.isFinite(high)) {
    return 50;
  }

  if (value <= lower) {
    return toPercent(value, low, lower) * (1 / 3);
  }

  if (value <= upper) {
    return 33.3333 + (toPercent(value, lower, upper) * (1 / 3));
  }

  return 66.6667 + (toPercent(value, upper, high) * (1 / 3));
}

function getValuation(current, median) {
  if (!Number.isFinite(current) || !Number.isFinite(median)) {
    return { label: 'Unavailable', tone: 'neutral' };
  }

  if (current < median * 0.9) {
    return { label: 'Undervalued', tone: 'undervalued' };
  }

  if (current > median * 1.1) {
    return { label: 'Overvalued', tone: 'overvalued' };
  }

  return { label: 'Fairly Valued', tone: 'fair' };
}

export default function PEBand({
  low,
  median,
  high,
  current,
  currentLabel = 'Current PE',
  medianLabel = 'Median Range'
}) {
  const domainMin = Math.min(low, current);
  const domainMax = Math.max(high, current);
  const medianPercent = 50;
  const currentPercent = toBandPercent(current, domainMin, median, domainMax);
  const [animatedPercent, setAnimatedPercent] = useState(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setAnimatedPercent(currentPercent);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [currentPercent]);

  const valuation = useMemo(() => getValuation(current, median), [current, median]);
  const lowRangeUpper = median * 0.9;
  const highRangeLower = median * 1.1;

  return (
    <div className="pe-band-card premium">
      <div className="pe-band-header premium">
        <div>
          <h3>PE Band</h3>
          <p className="pe-band-subtitle">
            Current PE positioned within the historical valuation range
          </p>
        </div>
      </div>

      <div className="pe-band-widget premium">
        <div
          className="pe-band-track premium"
          style={{
            background: `linear-gradient(90deg,
              #22c55e 0%,
              #16a34a 33.3333%,
              #eab308 33.3333%,
              #f59e0b 66.6667%,
              #ef4444 66.6667%,
              #dc2626 100%)`
          }}
        >
          <div
            className="pe-band-marker pe-band-marker-median"
            style={{ left: `${medianPercent}%` }}
          >
            <div className="pe-band-marker-line" />
            <div className="pe-band-marker-chip">
              {medianLabel} {formatNumber(median)}
            </div>
          </div>

          <div
            className={`pe-band-thumb pe-band-thumb-${valuation.tone}`}
            style={{ left: `${animatedPercent}%` }}
          >
            <div className="pe-band-tooltip">
              {currentLabel} {formatNumber(current)}
            </div>
          </div>
        </div>

        <div className="pe-band-scale premium">
          <span>Low Range: {formatNumber(low)} - {formatNumber(lowRangeUpper)}</span>
          <span>Median Range: {formatNumber(lowRangeUpper)} - {formatNumber(highRangeLower)}</span>
          <span>High Range: {formatNumber(highRangeLower)} - {formatNumber(high)}</span>
        </div>
      </div>
    </div>
  );
}
