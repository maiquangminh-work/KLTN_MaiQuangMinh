export const formatVND = (val) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(Number(val) || 0));

export const formatPercent = (val, digits = 2) =>
  `${Number(val || 0).toLocaleString('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;

export const formatCapitalBillions = (val) =>
  Number(val || 0).toLocaleString('vi-VN', {
    minimumFractionDigits: Number(val || 0) >= 100 ? 0 : 2,
    maximumFractionDigits: Number(val || 0) >= 100 ? 0 : 2,
  });

export const parseCapitalValueToBillions = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (value >= 1_000_000_000) return value / 1_000_000_000;
    if (value >= 1_000) return value;
    if (value >= 1) return value / 1000;
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  const numericPart = normalized.replace(/[^0-9,.-]/g, '').replace(/,/g, '');
  if (!numericPart) return null;
  const numericValue = Number(numericPart);
  if (!Number.isFinite(numericValue)) return null;

  if (normalized.includes('tỷ')) return numericValue;
  if (normalized.includes('triệu')) return numericValue / 1000;
  if (normalized.includes('đồng') || normalized.includes('vnd'))
    return numericValue / 1_000_000_000;
  if (numericValue >= 1_000_000_000) return numericValue / 1_000_000_000;
  if (numericValue >= 1_000) return numericValue;
  if (numericValue >= 1) return numericValue / 1000;
  return numericValue;
};
