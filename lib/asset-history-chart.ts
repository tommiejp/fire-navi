export type AssetPoint = { timestamp: number; assets: number };

export function toAssetPoints(rows: readonly { recorded_at: string; total_assets: number | string }[]): AssetPoint[] {
  return rows.map(row => ({ timestamp: Date.parse(row.recorded_at), assets:
    typeof row.total_assets === "string" && !/^\d+$/.test(row.total_assets) ? NaN : Number(row.total_assets) }))
    .filter(point => Number.isFinite(point.timestamp) && Number.isSafeInteger(point.assets) && point.assets >= 0)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-50);
}

export function formatAssetYen(value: number) {
  return `${value.toLocaleString("ja-JP")} 円`;
}
