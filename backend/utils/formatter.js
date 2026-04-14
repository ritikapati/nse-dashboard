function parseMarketNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value).replace(/,/g, '').replace(/%/g, '').trim();
  if (!normalized || normalized === '-') {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCurrentPrice(priceInfo) {
  if (!priceInfo) {
    return null;
  }

  if (priceInfo.lastPrice !== undefined && priceInfo.lastPrice !== null && priceInfo.lastPrice !== '') {
    return priceInfo.lastPrice;
  }

  if (priceInfo.last !== undefined && priceInfo.last !== null && priceInfo.last !== '') {
    return priceInfo.last;
  }

  if (priceInfo.close !== undefined && priceInfo.close !== null && priceInfo.close !== '') {
    return priceInfo.close;
  }

  return null;
}

module.exports = {
  parseMarketNumber,
  getCurrentPrice
};
