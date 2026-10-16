// Input is newest first, as returned by the limited history query.
export function calculateAssetChange(rows: readonly { total_assets: number | string }[]) {
  if (rows.length < 2) return null;
  const values = rows.slice(0, 2).map(row => {
    const value = row.total_assets;
    return typeof value === "string" && !/^\d+$/.test(value) ? NaN : Number(value);
  });
  if (values.some(value => !Number.isSafeInteger(value) || value < 0)) return null;
  const [current, previous] = values;
  const amount = current - previous;
  return { amount, percentage: previous === 0 ? null : amount / previous * 100 };
}
