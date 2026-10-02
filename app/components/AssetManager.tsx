"use client";

/**
 * AssetManager（PRO機能）
 * ─────────────────────────────────────────────────────
 * 資産管理タブのメインコンポーネント。
 * 「資産記録」と「資産詳細管理」を一画面に統合。
 *
 * セクション構成：
 *   ① 資産記録    … 時系列スナップショット記録・グラフ・履歴
 *   ② 資産内訳    … カテゴリ別管理（現金・株・ETF等）+ 円グラフ
 *   ③ CSVインポート … 証券会社CSV → 資産内訳へ一括登録
 *   ④ 目標資産設定 … 4%ルール以外の任意目標額を設定
 */

import { useState, useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "./FireCalculator";

// ─── ストレージキー ────────────────────────────────────
const TRACKING_KEY  = "fire_navi_tracking_v1";
const ASSETS_KEY    = "fire_navi_assets_v1";
const TARGET_KEY    = "fire_navi_custom_target_v1";
const FIRE_DATA_KEY = "fire_navi_v1";

// ─── 型定義 ────────────────────────────────────────────

/** 資産スナップショット（時系列記録） */
interface AssetRecord {
  id: string;
  date: string;         // "YYYY-MM-DD"
  total_assets: number; // 円
  note: string;
  recorded_at: string;  // ISO datetime
}

/** 資産カテゴリ種別 */
type AssetType =
  | "cash" | "domestic_stock" | "foreign_stock"
  | "etf"  | "fund"           | "real_estate"
  | "other";

/** カテゴリ別資産アイテム */
interface AssetItem {
  id: string;
  name: string;
  amount: number;
  type: AssetType;
  ticker?: string;
  shares?: number;
  broker?: string;
}

/** カスタムFIRE目標 */
interface CustomTarget {
  enabled: boolean;
  amount: number;
}

// ─── 定数：カテゴリメタ情報 ────────────────────────────
const ASSET_TYPE_META: Record<AssetType, { label: string; color: string; emoji: string }> = {
  cash:           { label: "現金・預金",  color: "#6b7280", emoji: "🏦" },
  domestic_stock: { label: "国内株",      color: "#3b82f6", emoji: "🇯🇵" },
  foreign_stock:  { label: "外国株",      color: "#8b5cf6", emoji: "🌍" },
  etf:            { label: "ETF",        color: "#10b981", emoji: "📊" },
  fund:           { label: "投資信託",    color: "#f59e0b", emoji: "📁" },
  real_estate:    { label: "不動産",      color: "#ef4444", emoji: "🏠" },
  other:          { label: "その他",      color: "#64748b", emoji: "📦" },
};

/** 証券会社CSV形式 */
const BROKER_FORMATS = [
  {
    id: "sbi",      label: "SBI証券",      desc: "保有証券一覧CSV（UTF-8）",
    nameKeywords: ["銘柄"],          valueKeywords: ["評価額"],
    tickerKeywords: ["銘柄コード"],  sharesKeywords: ["保有株数", "保有数量"],
  },
  {
    id: "rakuten",  label: "楽天証券",     desc: "保有証券一覧CSV",
    nameKeywords: ["銘柄名"],        valueKeywords: ["時価評価額"],
    tickerKeywords: ["銘柄コード"],  sharesKeywords: ["保有数量"],
  },
  {
    id: "monex",    label: "マネックス証券", desc: "保有証券照会CSV",
    nameKeywords: ["銘柄"],          valueKeywords: ["評価額"],
    tickerKeywords: ["銘柄コード", "コード"], sharesKeywords: ["保有数", "数量"],
  },
  {
    id: "generic",  label: "汎用（自動判定）", desc: "銘柄名と評価額の列を自動検出",
    nameKeywords: ["銘柄", "name", "Name"],
    valueKeywords: ["評価額", "時価評価額", "評価金額", "value", "amount"],
    tickerKeywords: ["コード", "code"],
    sharesKeywords: ["保有数", "数量", "shares"],
  },
] as const;

// ─── ユーティリティ ────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function relativeDate(dateStr: string): string {
  const diff = Math.round(
    (new Date(todayString() + "T00:00:00").getTime() -
      new Date(dateStr + "T00:00:00").getTime()) / 86_400_000
  );
  if (diff === 0) return "今日";
  if (diff === 1) return "昨日";
  if (diff < 30)  return `${diff}日前`;
  if (diff < 365) return `${Math.floor(diff / 30)}ヶ月前`;
  return `${Math.floor(diff / 365)}年前`;
}

function formatY(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(0)}億`;
  if (v >= 10_000)      return `${Math.round(v / 10_000)}万`;
  return String(v);
}

// ─── CSVパーサー ──────────────────────────────────────

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

function findColIndex(headers: string[], keywords: readonly string[]): number {
  for (const kw of keywords) {
    const idx = headers.findIndex((h) => h.includes(kw));
    if (idx >= 0) return idx;
  }
  return -1;
}

interface ParsedHolding { name: string; amount: number; ticker: string; shares: number; }

function parseSecuritiesCSV(
  text: string,
  fmt: (typeof BROKER_FORMATS)[number]
): { holdings: ParsedHolding[]; error: string | null } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return { holdings: [], error: "CSVファイルが空です" };

  let headerIdx = -1, nameCol = -1, valueCol = -1, tickerCol = -1, sharesCol = -1;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cells = splitCSVLine(lines[i]);
    const ni = findColIndex(cells, fmt.nameKeywords);
    const vi = findColIndex(cells, fmt.valueKeywords);
    if (ni >= 0 && vi >= 0) {
      headerIdx = i; nameCol = ni; valueCol = vi;
      tickerCol = findColIndex(cells, fmt.tickerKeywords);
      sharesCol = findColIndex(cells, fmt.sharesKeywords);
      break;
    }
  }
  if (headerIdx < 0)
    return { holdings: [], error: "ヘッダー行を検出できませんでした。証券会社を変えるか「汎用」を試してください。" };

  const holdings: ParsedHolding[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    if (cells.length <= Math.max(nameCol, valueCol)) continue;
    const name = cells[nameCol] ?? "";
    const amount = parseInt((cells[valueCol] ?? "").replace(/[,，円\s]/g, ""), 10);
    if (!name || isNaN(amount) || amount <= 0) continue;
    if (/^(合計|計|total|sum)/i.test(name)) continue;
    holdings.push({
      name, amount,
      ticker: tickerCol >= 0 ? (cells[tickerCol] ?? "").trim() : "",
      shares: parseFloat((sharesCol >= 0 ? cells[sharesCol] ?? "" : "").replace(/[,，\s]/g, "")) || 0,
    });
  }
  if (holdings.length === 0) return { holdings: [], error: "有効なデータ行が見つかりませんでした" };
  return { holdings, error: null };
}

function guessAssetType(h: ParsedHolding): AssetType {
  if (/etf/i.test(h.name)) return "etf";
  if (h.ticker && /^1[3-9]\d{2}$|^2\d{3}$/.test(h.ticker)) return "etf";
  if (h.ticker && /^[A-Z]{1,5}$/.test(h.ticker)) return "foreign_stock";
  if (/ファンド|fund|投信|信託/i.test(h.name)) return "fund";
  return "domestic_stock";
}

// ─── 円グラフカスタムラベル ────────────────────────────
interface PieLabelProps {
  cx?: number; cy?: number; midAngle?: number;
  innerRadius?: number; outerRadius?: number; percent?: number;
}
function PieLabel({ cx=0, cy=0, midAngle=0, innerRadius=0, outerRadius=0, percent=0 }: PieLabelProps) {
  if (percent < 0.05) return null;
  const R = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  return (
    <text
      x={cx + r * Math.cos(-midAngle * R)}
      y={cy + r * Math.sin(-midAngle * R)}
      fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={10} fontWeight="bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ─── トラッキングチャート用カスタムツールチップ ────────
interface TrackTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}
function TrackTooltip({ active, payload, label }: TrackTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-xs">
      <p className="font-bold text-gray-700 mb-1.5">{label}</p>
      {payload.map((e) => (
        <div key={e.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: e.color }} />
          <span className="text-gray-500">{e.name === "total_assets" ? "記録資産" : "FIRE目標"}:</span>
          <span className="font-semibold text-gray-900 ml-auto pl-2">{formatCurrency(e.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// メインコンポーネント
// ════════════════════════════════════════════════════════
export default function AssetManager() {

  // ── 資産記録（トラッキング）
  const [records, setRecords]           = useState<AssetRecord[]>([]);
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formDate, setFormDate]         = useState(todayString());
  const [formAssets, setFormAssets]     = useState("");
  const [formNote, setFormNote]         = useState("");
  const [formError, setFormError]       = useState("");

  // ── 資産内訳
  const [assets, setAssets]             = useState<AssetItem[]>([]);
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetAmount, setNewAssetAmount] = useState("");
  const [newAssetType, setNewAssetType] = useState<AssetType>("cash");
  const [assetDeleteId, setAssetDeleteId] = useState<string | null>(null);

  // ── CSVインポート
  const [csvStep, setCsvStep]           = useState<"idle" | "preview" | "done">("idle");
  const [selectedBroker, setSelectedBroker] = useState("sbi");
  const [csvPreview, setCsvPreview]     = useState<ParsedHolding[]>([]);
  const [csvError, setCsvError]         = useState<string | null>(null);
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  // ── カスタム目標
  const [customTarget, setCustomTarget] = useState<CustomTarget>({ enabled: false, amount: 0 });
  const [customTargetInput, setCustomTargetInput] = useState("");
  const [isEditingTarget, setIsEditingTarget] = useState(false);

  // ── 共通
  const [fireAutoTarget, setFireAutoTarget] = useState(0);
  const [isHydrated, setIsHydrated]     = useState(false);

  // ── localStorage 復元
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRACKING_KEY);
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) setRecords(p); }
    } catch { /* ignore */ }

    try {
      const raw = localStorage.getItem(ASSETS_KEY);
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) setAssets(p); }
    } catch { /* ignore */ }

    try {
      const raw = localStorage.getItem(TARGET_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.enabled === "boolean") { setCustomTarget(p); setCustomTargetInput(String(p.amount)); }
      }
    } catch { /* ignore */ }

    try {
      const raw = localStorage.getItem(FIRE_DATA_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.annual_spending === "number") setFireAutoTarget(Math.round(p.annual_spending / 0.04));
      }
    } catch { /* ignore */ }

    setIsHydrated(true);
  }, []);

  // ── 自動保存
  useEffect(() => { if (!isHydrated) return; try { localStorage.setItem(TRACKING_KEY, JSON.stringify(records)); } catch { /* ignore */ } }, [records, isHydrated]);
  useEffect(() => { if (!isHydrated) return; try { localStorage.setItem(ASSETS_KEY, JSON.stringify(assets)); } catch { /* ignore */ } }, [assets, isHydrated]);
  useEffect(() => { if (!isHydrated) return; try { localStorage.setItem(TARGET_KEY, JSON.stringify(customTarget)); } catch { /* ignore */ } }, [customTarget, isHydrated]);

  // ── 計算値
  const fireTarget    = customTarget.enabled ? customTarget.amount : fireAutoTarget;
  const totalItems    = assets.reduce((s, a) => s + a.amount, 0);

  // トラッキング集計
  const sortedDesc    = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const latestRecord  = sortedDesc[0];
  const prevRecord    = sortedDesc[1];
  const latestAssets  = latestRecord?.total_assets ?? 0;
  const assetDelta    = latestRecord && prevRecord ? latestRecord.total_assets - prevRecord.total_assets : null;
  const trackProgress = fireTarget > 0 ? Math.min(100, Math.round((latestAssets / fireTarget) * 100)) : 0;

  // トラッキングチャート用データ
  const trackChartData = [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      const d = new Date(r.date);
      return {
        label: `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`,
        total_assets: r.total_assets,
        fire_target: fireTarget,
      };
    });

  // 円グラフデータ
  const pieData = (Object.keys(ASSET_TYPE_META) as AssetType[])
    .map((type) => ({
      type, name: ASSET_TYPE_META[type].label, color: ASSET_TYPE_META[type].color,
      value: assets.filter((a) => a.type === type).reduce((s, a) => s + a.amount, 0),
    }))
    .filter((d) => d.value > 0);

  // ── ハンドラ：記録追加
  const handleSaveRecord = () => {
    setFormError("");
    const amount = parseInt(formAssets.replace(/,/g, ""), 10);
    if (!formDate)                { setFormError("日付を入力してください"); return; }
    if (isNaN(amount) || amount < 0) { setFormError("資産額を正しく入力してください"); return; }
    setRecords((prev) =>
      [...prev, { id: generateId(), date: formDate, total_assets: amount, note: formNote.trim(), recorded_at: new Date().toISOString() }]
        .sort((a, b) => a.date.localeCompare(b.date))
    );
    setFormDate(todayString()); setFormAssets(""); setFormNote(""); setIsModalOpen(false);
  };

  const openModal = () => {
    setFormDate(todayString()); setFormAssets(""); setFormNote(""); setFormError(""); setIsModalOpen(true);
  };

  // ── ハンドラ：カテゴリ資産追加
  const addAsset = () => {
    const amount = parseInt(newAssetAmount.replace(/,/g, ""), 10);
    if (!newAssetName.trim() || isNaN(amount) || amount <= 0) return;
    setAssets((prev) => [...prev, { id: generateId(), name: newAssetName.trim(), amount, type: newAssetType }]);
    setNewAssetName(""); setNewAssetAmount(""); setNewAssetType("cash"); setIsAddingAsset(false);
  };

  // ── ハンドラ：CSVインポート
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const fmt  = BROKER_FORMATS.find((b) => b.id === selectedBroker) ?? BROKER_FORMATS[3];
      const { holdings, error } = parseSecuritiesCSV(text, fmt);
      if (error) { setCsvError(error); setCsvPreview([]); }
      else       { setCsvPreview(holdings); setCsvStep("preview"); }
    };
    reader.onerror = () => setCsvError("ファイルの読み込みに失敗しました");
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const importFromCSV = () => {
    const brokerLabel = BROKER_FORMATS.find((b) => b.id === selectedBroker)?.label;
    setAssets((prev) => [
      ...prev,
      ...csvPreview.map((h) => ({
        id: generateId(), name: h.name, amount: h.amount,
        type: guessAssetType(h), ticker: h.ticker || undefined,
        shares: h.shares || undefined, broker: brokerLabel,
      })),
    ]);
    setCsvPreview([]); setCsvStep("done");
    setTimeout(() => setCsvStep("idle"), 2000);
  };

  // ── ハンドラ：カスタム目標
  const saveCustomTarget = () => {
    const amount = parseInt(customTargetInput.replace(/,/g, ""), 10);
    if (!isNaN(amount) && amount > 0) setCustomTarget({ enabled: true, amount });
    setIsEditingTarget(false);
  };

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400 text-sm animate-pulse">読み込み中…</p>
      </div>
    );
  }

  // ────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-4">

        {/* ════════════════════════════════════
            ① PRO ヒーローカード
            ════════════════════════════════════ */}
        <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-md">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-white/20 text-white text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase">
              ✦ PRO機能
            </span>
            <span className="text-emerald-100 text-xs">資産管理</span>
          </div>

          {records.length === 0 ? (
            <div>
              <p className="text-2xl font-black tracking-tight leading-snug">
                資産を記録して<br />成長を実感しよう
              </p>
              <p className="text-emerald-100 text-xs mt-2">
                スナップショット記録・カテゴリ管理・CSV一括インポートが使えます
              </p>
            </div>
          ) : (
            <div>
              <p className="text-emerald-200 text-xs font-medium mb-0.5">最新の記録資産</p>
              <p className="text-4xl font-black tracking-tight">{formatCurrency(latestAssets)}</p>
              <div className="flex items-center gap-3 mt-1">
                {assetDelta !== null && (
                  <span className={`text-xs font-semibold flex items-center gap-1 ${assetDelta >= 0 ? "text-green-200" : "text-red-200"}`}>
                    {assetDelta >= 0 ? "▲" : "▼"} {formatCurrency(Math.abs(assetDelta))}
                    <span className="text-emerald-200 font-normal">前回比</span>
                  </span>
                )}
                <span className="text-emerald-200 text-xs">{relativeDate(latestRecord.date)}記録</span>
              </div>
              {fireTarget > 0 && (
                <div className="mt-3 bg-emerald-900/30 rounded-xl p-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-emerald-200">FIRE達成率</span>
                    <span className="text-white font-bold">{trackProgress}%</span>
                  </div>
                  <div className="w-full bg-emerald-900/40 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full bg-white transition-all duration-700" style={{ width: `${trackProgress}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] mt-1.5 text-emerald-200">
                    <span>{formatCurrency(latestAssets)}</span>
                    <span>目標 {formatCurrency(fireTarget)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════
            ② 資産記録（トラッキング）
            ════════════════════════════════════ */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* セクションヘッダー */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-800">📅 資産記録</h2>
              {records.length > 0 && (
                <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {records.length}件
                </span>
              )}
            </div>
          </div>

          <div className="px-5 pb-5 space-y-4">
            {/* 記録ボタン */}
            <button
              onClick={openModal}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-sm rounded-2xl py-3.5 shadow-sm shadow-emerald-200 transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 4v12M4 10h12" />
              </svg>
              今すぐ資産を記録する
            </button>

            {/* 推移グラフ（2件以上） */}
            {records.length >= 2 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-3">📊 実績推移グラフ</p>
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trackChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradTrack" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tickFormatter={formatY} tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip content={<TrackTooltip />} />
                      {fireTarget > 0 && (
                        <ReferenceLine y={fireTarget} stroke="#10b981" strokeDasharray="5 4" strokeWidth={1.5}
                          label={{ value: "目標", position: "insideTopRight", fontSize: 9, fill: "#10b981" }} />
                      )}
                      <Area type="monotone" dataKey="total_assets" name="total_assets"
                        stroke="#10b981" strokeWidth={2.5} fill="url(#gradTrack)"
                        dot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {records.length === 1 && (
              <div className="text-center py-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500">あと1件記録するとグラフが表示されます</p>
              </div>
            )}

            {/* 履歴リスト */}
            {sortedDesc.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">📝</p>
                <p className="text-sm font-medium text-gray-500">まだ記録がありません</p>
                <p className="text-xs text-gray-400 mt-1">上のボタンから最初の記録を始めましょう</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50 -mx-5 px-5">
                {sortedDesc.map((record, index) => {
                  const prevInList = sortedDesc[index + 1];
                  const delta = prevInList ? record.total_assets - prevInList.total_assets : null;
                  const isDeleting = deleteConfirmId === record.id;
                  const d = new Date(record.date + "T00:00:00");

                  return (
                    <li key={record.id} className="py-3.5">
                      {isDeleting ? (
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-red-500 font-medium flex-1">この記録を削除しますか？</p>
                          <div className="flex gap-2">
                            <button onClick={() => setDeleteConfirmId(null)} className="text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-1.5 font-medium">キャンセル</button>
                            <button onClick={() => { setRecords((prev) => prev.filter((r) => r.id !== record.id)); setDeleteConfirmId(null); }} className="text-xs text-white bg-red-500 rounded-lg px-3 py-1.5 font-medium">削除</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          {/* 日付 */}
                          <div className="flex-shrink-0 text-center w-11">
                            <p className="text-[10px] text-gray-400 leading-none">{d.getFullYear()}</p>
                            <p className="text-sm font-black text-gray-800 leading-tight mt-0.5">
                              {String(d.getMonth()+1).padStart(2,"0")}/{String(d.getDate()).padStart(2,"0")}
                            </p>
                            <p className="text-[10px] text-emerald-500 font-medium leading-none mt-0.5">{relativeDate(record.date)}</p>
                          </div>
                          {/* タイムライン縦線 */}
                          <div className="flex flex-col items-center self-stretch pt-1 flex-shrink-0">
                            <div className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-white shadow-sm flex-shrink-0" />
                            {index < sortedDesc.length - 1 && <div className="w-0.5 flex-1 bg-emerald-100 mt-1" />}
                          </div>
                          {/* コンテンツ */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-base font-black text-gray-900">{formatCurrency(record.total_assets)}</p>
                                {delta !== null && (
                                  <p className={`text-xs font-semibold mt-0.5 flex items-center gap-1 ${delta >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                                    {delta >= 0 ? "▲" : "▼"} {formatCurrency(Math.abs(delta))}
                                    <span className="text-gray-400 font-normal">前回比</span>
                                  </p>
                                )}
                                {record.note && (
                                  <p className="text-xs text-gray-400 mt-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">💬 {record.note}</p>
                                )}
                              </div>
                              <button onClick={() => setDeleteConfirmId(record.id)} className="text-gray-300 hover:text-red-400 transition-colors p-1 flex-shrink-0">
                                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H4.084a2.25 2.25 0 01-2.244-2.077L1.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════
            ③ 資産内訳（カテゴリ別管理）
            ════════════════════════════════════ */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-800">💼 資産内訳</h2>
              {assets.length > 0 && (
                <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{assets.length}件</span>
              )}
            </div>
            {!isAddingAsset && (
              <button
                onClick={() => setIsAddingAsset(true)}
                className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-xl px-3 py-1.5 font-semibold transition-colors"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
                </svg>
                追加
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mb-4">カテゴリ別に資産を登録・管理</p>

          {/* 追加フォーム */}
          {isAddingAsset && (
            <div className="mb-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 space-y-3">
              <p className="text-xs font-bold text-emerald-700">資産を追加</p>
              <select
                value={newAssetType}
                onChange={(e) => setNewAssetType(e.target.value as AssetType)}
                className="w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {(Object.entries(ASSET_TYPE_META) as Array<[AssetType, typeof ASSET_TYPE_META[AssetType]]>).map(([type, meta]) => (
                  <option key={type} value={type}>{meta.emoji} {meta.label}</option>
                ))}
              </select>
              <input
                type="text" value={newAssetName} onChange={(e) => setNewAssetName(e.target.value)}
                placeholder="例：楽天銀行、トヨタ株、S&P500 ETF" maxLength={40}
                className="w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <div>
                <input
                  type="number" value={newAssetAmount} onChange={(e) => setNewAssetAmount(e.target.value)}
                  placeholder="評価額（円）" inputMode="numeric"
                  className="w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-sm bg-white text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                {newAssetAmount && !isNaN(parseInt(newAssetAmount)) && (
                  <p className="text-[10px] text-emerald-500 text-right mt-0.5">{formatCurrency(parseInt(newAssetAmount))}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setIsAddingAsset(false)} className="flex-1 py-2.5 rounded-xl text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 font-medium transition-colors">キャンセル</button>
                <button onClick={addAsset} disabled={!newAssetName.trim() || !newAssetAmount} className="flex-1 py-2.5 rounded-xl text-sm text-white bg-emerald-600 hover:bg-emerald-700 font-bold transition-colors disabled:opacity-40">追加する</button>
              </div>
            </div>
          )}

          {/* 円グラフ */}
          {pieData.length >= 2 && (
            <div style={{ width: "100%", height: 190 }} className="mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={(p) => <PieLabel {...p} />} outerRadius={75} dataKey="value">
                    {pieData.map((e) => <Cell key={e.type} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [formatCurrency(Number(v)), ""]} contentStyle={{ borderRadius: "12px", border: "1px solid #f3f4f6", fontSize: "12px" }} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 資産リスト */}
          {assets.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-3xl mb-2">💼</p>
              <p className="text-sm font-medium text-gray-500">資産をまだ登録していません</p>
              <p className="text-xs text-gray-400 mt-1">「追加」またはCSVインポートで登録できます</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {assets.map((asset) => {
                const meta = ASSET_TYPE_META[asset.type];
                return (
                  <li key={asset.id}>
                    {assetDeleteId === asset.id ? (
                      <div className="flex items-center justify-between gap-3 p-3 bg-red-50 rounded-xl">
                        <p className="text-xs text-red-500 font-medium flex-1">削除しますか？</p>
                        <div className="flex gap-2">
                          <button onClick={() => setAssetDeleteId(null)} className="text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-1.5 font-medium">キャンセル</button>
                          <button onClick={() => { setAssets((prev) => prev.filter((a) => a.id !== asset.id)); setAssetDeleteId(null); }} className="text-xs text-white bg-red-500 rounded-lg px-3 py-1.5 font-medium">削除</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50/50 transition-colors">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm" style={{ backgroundColor: meta.color + "20" }}>
                          {meta.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{asset.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: meta.color + "20", color: meta.color }}>
                              {meta.label}
                            </span>
                            {asset.ticker && <span className="text-[10px] text-gray-400">{asset.ticker}</span>}
                            {asset.broker && <span className="text-[10px] text-gray-400">({asset.broker})</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(asset.amount)}</p>
                          {asset.shares && asset.shares > 0 && <p className="text-[10px] text-gray-400">{asset.shares}株</p>}
                        </div>
                        <button onClick={() => setAssetDeleteId(asset.id)} className="text-gray-300 hover:text-red-400 transition-colors p-1 flex-shrink-0">
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H4.084a2.25 2.25 0 01-2.244-2.077L1.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
              <li className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-sm font-bold text-emerald-700">合計</span>
                <span className="text-base font-black text-emerald-700">{formatCurrency(totalItems)}</span>
              </li>
            </ul>
          )}
        </div>

        {/* ════════════════════════════════════
            ④ CSVインポート
            ════════════════════════════════════ */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-bold text-gray-800">📥 CSVインポート</h2>
            <span className="bg-emerald-100 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full">PRO</span>
          </div>
          <p className="text-[11px] text-gray-400 mb-4">ネット証券の保有証券CSVをインポートして資産内訳へ一括登録</p>

          {csvStep === "done" && (
            <div className="mb-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-sm font-bold text-emerald-700">インポート完了</p>
                <p className="text-xs text-emerald-600 mt-0.5">資産が「資産内訳」セクションに追加されました</p>
              </div>
            </div>
          )}

          {csvStep !== "preview" && (
            <>
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-600 mb-2">証券会社を選択</p>
                <div className="grid grid-cols-2 gap-2">
                  {BROKER_FORMATS.map((broker) => (
                    <button
                      key={broker.id} onClick={() => setSelectedBroker(broker.id)}
                      className={`p-3 rounded-xl border text-left transition-colors ${selectedBroker === broker.id ? "border-emerald-400 bg-emerald-50" : "border-gray-200 bg-gray-50 hover:bg-gray-100"}`}
                    >
                      <p className={`text-xs font-bold ${selectedBroker === broker.id ? "text-emerald-700" : "text-gray-700"}`}>{broker.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{broker.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileChange} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-emerald-200 hover:border-emerald-400 bg-emerald-50 rounded-xl py-5 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7 text-emerald-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <div className="text-center">
                  <p className="text-sm font-semibold text-emerald-600">CSVファイルを選択</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">UTF-8形式のCSVファイルに対応</p>
                </div>
              </button>

              {csvError && (
                <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-100 flex items-start gap-2">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-red-600">{csvError}</p>
                </div>
              )}
            </>
          )}

          {csvStep === "preview" && csvPreview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-700">{csvPreview.length}件の保有証券を検出</p>
                <button onClick={() => { setCsvStep("idle"); setCsvPreview([]); }} className="text-xs text-gray-400 hover:text-gray-600">キャンセル</button>
              </div>
              <div className="rounded-xl border border-gray-100 overflow-hidden mb-4">
                <div className="bg-gray-50 px-3 py-2 grid grid-cols-[1fr_auto] text-[10px] text-gray-500 font-medium gap-2 border-b border-gray-100">
                  <span>銘柄</span><span className="text-right">評価額</span>
                </div>
                <ul className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                  {csvPreview.map((h, i) => (
                    <li key={i} className="px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-800 truncate">{h.name}</p>
                        {h.ticker && <p className="text-[10px] text-gray-400">{h.ticker}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-gray-900">{formatCurrency(h.amount)}</p>
                        {h.shares > 0 && <p className="text-[10px] text-gray-400">{h.shares}株</p>}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="px-3 py-2 bg-emerald-50 border-t border-emerald-100 flex justify-between">
                  <span className="text-xs font-bold text-emerald-700">合計</span>
                  <span className="text-xs font-black text-emerald-700">{formatCurrency(csvPreview.reduce((s, h) => s + h.amount, 0))}</span>
                </div>
              </div>
              <button onClick={importFromCSV} className="w-full py-3.5 rounded-xl text-sm text-white bg-emerald-600 hover:bg-emerald-700 font-bold transition-colors shadow-sm">
                {csvPreview.length}件をインポートする
              </button>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════
            ⑤ 目標資産のカスタム設定
            ════════════════════════════════════ */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-bold text-gray-800">🎯 目標資産のカスタム設定</h2>
            <span className="bg-emerald-100 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full">PRO</span>
          </div>
          <p className="text-[11px] text-gray-400 mb-4">4%ルール以外の目標額を任意に設定できます</p>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100 mb-4">
            <div>
              <p className="text-xs text-gray-500">{customTarget.enabled ? "カスタム目標（設定中）" : "自動計算（4%ルール）"}</p>
              <p className="text-lg font-black text-gray-900 mt-0.5">
                {formatCurrency(customTarget.enabled ? customTarget.amount : fireAutoTarget)}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setCustomTargetInput(String(customTarget.enabled ? customTarget.amount : fireAutoTarget)); setIsEditingTarget(true); }}
                className="text-xs text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-xl px-3 py-2 font-semibold transition-colors"
              >変更</button>
              {customTarget.enabled && (
                <button
                  onClick={() => { setCustomTarget({ enabled: false, amount: 0 }); setCustomTargetInput(""); setIsEditingTarget(false); }}
                  className="text-xs text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 rounded-xl px-3 py-2 font-medium transition-colors"
                >解除</button>
              )}
            </div>
          </div>

          {isEditingTarget && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 space-y-3">
              <p className="text-xs font-bold text-emerald-700">目標資産を設定</p>
              <div>
                <input
                  type="number" value={customTargetInput} onChange={(e) => setCustomTargetInput(e.target.value)}
                  placeholder="例：75000000" inputMode="numeric"
                  className="w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-sm bg-white text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                {customTargetInput && !isNaN(parseInt(customTargetInput)) && (
                  <p className="text-[10px] text-emerald-600 text-right mt-0.5 font-medium">{formatCurrency(parseInt(customTargetInput))}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setIsEditingTarget(false)} className="flex-1 py-2.5 rounded-xl text-sm text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 font-medium transition-colors">キャンセル</button>
                <button onClick={saveCustomTarget} disabled={!customTargetInput || isNaN(parseInt(customTargetInput))} className="flex-1 py-2.5 rounded-xl text-sm text-white bg-emerald-600 hover:bg-emerald-700 font-bold transition-colors disabled:opacity-40">設定する</button>
              </div>
            </div>
          )}

          <div className="mt-3 bg-gray-50 rounded-xl p-3">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              💡 <strong>ヒント：</strong>サイドFIREや副収入がある場合など、4%ルールにとらわれない独自の目標を設定できます。
            </p>
          </div>
        </div>

      </div>

      {/* ════════════════════════════════════
          記録モーダル（ボトムシート）
          ════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8 max-w-xl w-full mx-auto shadow-2xl">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-gray-900">資産を記録する</h3>
                <p className="text-xs text-gray-400 mt-0.5">任意の日付・金額で記録できます</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  記録日 <span className="text-gray-400 font-normal text-xs">（過去の日付でも可）</span>
                </label>
                <input type="date" value={formDate} max={todayString()} onChange={(e) => { setFormDate(e.target.value); setFormError(""); }}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">総資産額</label>
                <div className="relative">
                  <input type="number" value={formAssets} onChange={(e) => { setFormAssets(e.target.value); setFormError(""); }}
                    placeholder="5000000" inputMode="numeric"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-gray-900 text-right text-base focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">円</span>
                </div>
                {formAssets && !isNaN(parseInt(formAssets)) && (
                  <p className="text-xs text-emerald-500 mt-1 text-right font-medium">{formatCurrency(parseInt(formAssets))}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  メモ <span className="text-gray-400 font-normal text-xs">（任意）</span>
                </label>
                <input type="text" value={formNote} onChange={(e) => setFormNote(e.target.value)}
                  placeholder="例：給料日後、ボーナス入金後など" maxLength={50}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50"
                />
              </div>
              {formError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-500 flex-shrink-0">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  <p className="text-red-600 text-xs">{formError}</p>
                </div>
              )}
              <button onClick={handleSaveRecord} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl py-4 transition-colors shadow-sm shadow-emerald-200 mt-2">
                記録を保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
