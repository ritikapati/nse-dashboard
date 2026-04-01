import React from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

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

export default function PEBand({
  low,
  median,
  high,
  current,
  currentDate,
  currentLabel = 'Current',
  medianLabel = 'Median'
}) {
  const domainMin = Math.min(low, current);
  const domainMax = Math.max(high, current);
  const currentValue = clamp(current, domainMin, domainMax);
  const medianValue = clamp(median, domainMin, domainMax);
  const currentPercent = toPercent(currentValue, domainMin, domainMax);
  const medianPercent = toPercent(medianValue, domainMin, domainMax);
  const markersClose = Math.abs(currentPercent - medianPercent) < 10;

  const renderBadge = (label, value, percent, variant, stacked) => (
    <div
      className={`pe-band-badge pe-band-badge-${variant}${stacked ? ' stacked' : ''}`}
      style={{ left: `${percent}%` }}
    >
      {label} {formatNumber(value)}
    </div>
  );

  return (
    <div className="pe-band-card">
      <div className="pe-band-header">
        <h3>PE Band</h3>
        <span>{currentDate}</span>
      </div>

      <div className="pe-band-widget">
        {renderBadge(currentLabel, current, currentPercent, 'current', false)}
        {renderBadge(medianLabel, median, medianPercent, 'median', markersClose)}

        <div className="pe-band-slider-wrap">
          <Slider
            range
            min={domainMin}
            max={domainMax}
            value={[currentValue, medianValue].sort((a, b) => a - b)}
            disabled
            allowCross={false}
            trackStyle={[{ background: 'transparent', height: 12 }]}
            railStyle={{
              height: 12,
              borderRadius: 999,
              background: 'linear-gradient(90deg, #2f9e44 0%, #2f9e44 33.33%, #f1c40f 33.33%, #f1c40f 66.66%, #d63336 66.66%, #d63336 100%)'
            }}
            handleStyle={[
              {
                width: 16,
                height: 16,
                marginTop: -2,
                borderWidth: 3,
                borderColor: '#111827',
                backgroundColor: '#111827',
                opacity: 1,
                boxShadow: '0 0 0 4px rgba(17, 24, 39, 0.14)'
              },
              {
                width: 16,
                height: 16,
                marginTop: -2,
                borderWidth: 3,
                borderColor: '#475569',
                backgroundColor: '#475569',
                opacity: 1,
                boxShadow: '0 0 0 4px rgba(71, 85, 105, 0.12)'
              }
            ]}
          />
        </div>

        <div className="pe-band-scale">
          <span>Low {formatNumber(low)}</span>
          <span>Median {formatNumber(median)}</span>
          <span>High {formatNumber(high)}</span>
        </div>
      </div>
    </div>
  );
}
