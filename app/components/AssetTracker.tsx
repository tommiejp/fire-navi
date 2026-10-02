"use client";

/**
 * AssetTracker（PRO機能）
 * ─────────────────────────────────────────────────────
 * 資産を時系列で記録・管理する習慣化機能。
 *
 * 機能：
 *   - 任意のタイミングで資産を記録（日付指定可・過去日も可）
 *   - 時系列グラフで実績推移を可視化（2件以上で表示）
 *   - タイムライン形式の記録一覧（前回比・メモ付き）
 *   - 記録の削除
 *   - FIREシミュレーターの目標資産と連携した達成率バー
 *   - localStorageへの自動保存・復元
 */

import { useState, useEffect } from "react";
import TrackingChart, { AssetRecord } from "./TrackingChart";
import { formatCurrency } from "./FireCalculator";

// ─── 定数 ──────────────────────────────────────────────
const TRACKING_STORAGE_KEY = "fire_navi_tracking_v1";
const FIRE_DATA_STORAGE_KEY = "fire_navi_v1";

// ─── ユーティリティ ────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function relativeDate(dateStr: string): string {
  const today = new Date(todayString() + "T00:00:00");
  const target = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  if (diffDays < 30) return `${diffDays}日前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}ヶ月前`;
  return `${Math.floor(diffDays / 365)}年前`;
}

// ─── メインコンポーネント ──────────────────────────────
export default function AssetTracker() {
  const [records, setRecords] = useState<AssetRecord[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [fireTarget, setFireTarget] = useState<number>(0);

  // フォーム状態
  const [formDate, setFormDate] = useState(todayString());
  const [formAssets, setFormAssets] = useState<string>("");
  const [formNote, setFormNote] = useState("");
  const [formError, setFormError] = useState("");

  // ── localStorage 復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TRACKING_STORAGE_KEY);
      if (saved) {
        const parsed: AssetRecord[] = JSON.parse(saved);
        if (Array.isArray(parsed)) setRecords(parsed);
      }
    } catch { /* ignore */ }

    // FIREシミュレーターの目標資産を参照
    try {
      const fireData = localStorage.getItem(FIRE_DATA_STORAGE_KEY);
      if (fireData) {
        const parsed = JSON.parse(fireData);
        if (typeof parsed.annual_spending === "number") {
          setFireTarget(Math.round(parsed.annual_spending / 0.04));
        }
      }
    } catch { /* ignore */ }

    setIsHydrated(true);
  }, []);

  // ── localStorage 自動保存
  useEffect(() => {
    if (!isHydrated) return;
    try { localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(records)); } catch { /* ignore */ }
  }, [records, isHydrated]);

  // ── 記録の追加
  const handleSave = () => {
    setFormError("");
    const amount = parseInt(formAssets.replace(/,/g, ""), 10);
    if (!formDate) { setFormError("日付を入力してください"); return; }
    if (isNaN(amount) || amount < 0) { setFormError("資産額を正しく入力してください"); return; }

    const newRecord: AssetRecord = {
      id: generateId(),
      date: formDate,
      total_assets: amount,
      note: formNote.trim(),
      recorded_at: new Date().toISOString(),
    };

    // 日付順でソートして追加
    setRecords((prev) =>
      [...prev, newRecord].sort((a, b) => a.date.localeCompare(b.date))
    );

    setFormDate(todayString());
    setFormAssets("");
    setFormNote("");
    setIsModalOpen(false);
  };

  // ── 記録の削除
  const handleDelete = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    setDeleteConfirmId(null);
  };

  // ── モーダルを開く
  const openModal = () => {
    setFormDate(todayString());
    setFormAssets("");
    setFormNote("");
    setFormError("");
    setIsModalOpen(true);
  };

  // ── 新しい順ソート（表示用）
  const sortedDesc = [...records].sort((a, b) => b.date.localeCompare(a.date));

  const latestRecord = sortedDesc[0];
  const prevRecord = sortedDesc[1];
  const latestAssets = latestRecord?.total_assets ?? 0;
  const assetDelta = latestRecord && prevRecord
    ? latestRecord.total_assets - prevRecord.total_assets
    : null;
  const progressPct = fireTarget > 0
    ? Math.min(100, Math.round((latestAssets / fireTarget) * 100))
    : 0;

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400 text-sm animate-pulse">読み込み中…</p>
      </div>
    );
  }

  return (
    <>
      {/* ─── メインコンテンツ ─────────────────────────── */}
      <div className="space-y-4">

        {/* ════════════════════════════════════
            ① PROヒーローカード
            ════════════════════════════════════ */}
        <div className="rounded-2xl p-5 bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-white/25 text-white text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase">
              ✦ PRO機能
            </span>
            <span className="text-amber-100 text-xs">資産トラッキング</span>
          </div>

          {records.length === 0 ? (
            <div>
              <p className="text-3xl font-black tracking-tight leading-tight">
                最初の記録を<br />始めよう
              </p>
              <p className="text-amber-100 text-xs mt-2">
                資産を記録するたびに、成長が見えてきます
              </p>
            </div>
          ) : (
            <div>
              <p className="text-amber-200 text-xs font-medium mb-0.5">最新の記録資産</p>
              <p className="text-4xl font-black tracking-tight">
                {formatCurrency(latestAssets)}
              </p>
              <div className="flex items-center gap-3 mt-1">
                {assetDelta !== null && (
                  <span className={`text-xs font-semibold flex items-center gap-1 ${assetDelta >= 0 ? "text-green-200" : "text-red-200"}`}>
                    {assetDelta >= 0 ? "▲" : "▼"} {formatCurrency(Math.abs(assetDelta))}
                    <span className="text-amber-200 font-normal">前回比</span>
                  </span>
                )}
                <span className="text-amber-200 text-xs">{relativeDate(latestRecord.date)}記録</span>
              </div>

              {/* FIRE達成率バー */}
              {fireTarget > 0 && (
                <div className="mt-3 bg-orange-600/40 rounded-xl p-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-amber-200">FIRE達成率</span>
                    <span className="text-white font-bold">{progressPct}%</span>
                  </div>
                  <div className="w-full bg-orange-900/40 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-white transition-all duration-700 ease-out"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] mt-1.5 text-amber-200">
                    <span>{formatCurrency(latestAssets)}</span>
                    <span>目標 {formatCurrency(fireTarget)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════
            ② 記録ボタン
            ════════════════════════════════════ */}
        <button
          onClick={openModal}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-sm rounded-2xl py-4 shadow-md shadow-amber-200 transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 4v12M4 10h12" />
          </svg>
          今すぐ資産を記録する
        </button>

        {/* ════════════════════════════════════
            ③ 資産推移グラフ（2件以上で表示）
            ════════════════════════════════════ */}
        {records.length >= 2 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-bold text-gray-800">📊 実績推移グラフ</h2>
              <span className="bg-amber-100 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full">PRO</span>
            </div>
            <p className="text-[11px] text-gray-400 mb-4">
              実際に記録した資産の成長推移（{records.length}件）
            </p>
            <TrackingChart
              records={[...records].sort((a, b) => a.date.localeCompare(b.date))}
              fireTarget={fireTarget}
              formatCurrency={formatCurrency}
            />
          </div>
        )}

        {/* 1件のみのときはグラフ代わりに案内 */}
        {records.length === 1 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
            <p className="text-2xl mb-2">📊</p>
            <p className="text-sm font-medium text-gray-600">あと1件記録するとグラフが表示されます</p>
            <p className="text-xs text-gray-400 mt-1">継続して記録することで成長が見えます</p>
          </div>
        )}

        {/* ════════════════════════════════════
            ④ タイムライン記録一覧
            ════════════════════════════════════ */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-800">📋 記録履歴</h2>
              {records.length > 0 && (
                <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {records.length}件
                </span>
              )}
            </div>
          </div>

          {sortedDesc.length === 0 ? (
            <div className="px-5 pb-8 text-center">
              <p className="text-4xl mb-3">📝</p>
              <p className="text-sm font-medium text-gray-500">まだ記録がありません</p>
              <p className="text-xs text-gray-400 mt-1">上のボタンから最初の記録を始めましょう</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50 pb-2">
              {sortedDesc.map((record, index) => {
                const prevInList = sortedDesc[index + 1]; // 時系列的に前の記録
                const delta = prevInList ? record.total_assets - prevInList.total_assets : null;
                const isDeleting = deleteConfirmId === record.id;
                const recDate = new Date(record.date + "T00:00:00");

                return (
                  <li key={record.id} className="px-5 py-4">
                    {isDeleting ? (
                      /* 削除確認 */
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-red-500 font-medium flex-1">この記録を削除しますか？</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 font-medium transition-colors"
                          >
                            キャンセル
                          </button>
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="text-xs text-white bg-red-500 hover:bg-red-600 rounded-lg px-3 py-1.5 font-medium transition-colors"
                          >
                            削除する
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        {/* 日付カラム */}
                        <div className="flex-shrink-0 text-center w-12">
                          <p className="text-[10px] text-gray-400 leading-none">
                            {recDate.getFullYear()}
                          </p>
                          <p className="text-sm font-black text-gray-800 leading-tight mt-0.5">
                            {String(recDate.getMonth() + 1).padStart(2, "0")}/
                            {String(recDate.getDate()).padStart(2, "0")}
                          </p>
                          <p className="text-[10px] text-amber-500 leading-none mt-0.5 font-medium">
                            {relativeDate(record.date)}
                          </p>
                        </div>

                        {/* タイムライン縦線 */}
                        <div className="flex flex-col items-center self-stretch pt-1 flex-shrink-0">
                          <div className="w-3 h-3 rounded-full bg-amber-400 border-2 border-white shadow-sm flex-shrink-0" />
                          {index < sortedDesc.length - 1 && (
                            <div className="w-0.5 flex-1 bg-amber-100 mt-1" />
                          )}
                        </div>

                        {/* コンテンツ */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-base font-black text-gray-900">
                                {formatCurrency(record.total_assets)}
                              </p>
                              {delta !== null && (
                                <p className={`text-xs font-semibold mt-0.5 flex items-center gap-1 ${delta >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                                  {delta >= 0 ? "▲" : "▼"} {formatCurrency(Math.abs(delta))}
                                  <span className="text-gray-400 font-normal">前回比</span>
                                </p>
                              )}
                              {record.note && (
                                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed bg-gray-50 rounded-lg px-2.5 py-1.5">
                                  💬 {record.note}
                                </p>
                              )}
                            </div>
                            {/* 削除ボタン */}
                            <button
                              onClick={() => setDeleteConfirmId(record.id)}
                              className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 p-1 -mr-1 mt-0.5"
                              title="削除"
                            >
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

        {/* ════════════════════════════════════
            ⑤ 習慣化ヒント
            ════════════════════════════════════ */}
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
          <h3 className="text-xs font-bold text-amber-700 mb-2">💡 資産記録のコツ</h3>
          <ul className="space-y-1.5 text-[11px] text-amber-600 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0">📅</span>
              <span>月初・月末など決まったタイミングで記録すると継続しやすい</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0">📝</span>
              <span>メモに「給料日後」「ボーナス入金」など状況を書くと振り返りに役立つ</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0">📈</span>
              <span>2件以上記録するとグラフで成長の実感が得られます</span>
            </li>
          </ul>
        </div>

      </div>

      {/* ─── 記録モーダル（ボトムシート） ─────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* オーバーレイ */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />

          {/* シート本体 */}
          <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8 max-w-xl w-full mx-auto shadow-2xl">
            {/* ドラッグハンドル */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            {/* タイトル */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-gray-900">資産を記録する</h3>
                <p className="text-xs text-gray-400 mt-0.5">任意の日付・金額で記録できます</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* 日付入力 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  記録日 <span className="text-gray-400 font-normal text-xs">（過去の日付でも記録可）</span>
                </label>
                <input
                  type="date"
                  value={formDate}
                  max={todayString()}
                  onChange={(e) => { setFormDate(e.target.value); setFormError(""); }}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-gray-50"
                />
              </div>

              {/* 資産額入力 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  総資産額
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formAssets}
                    onChange={(e) => { setFormAssets(e.target.value); setFormError(""); }}
                    placeholder="5000000"
                    inputMode="numeric"
                    min={0}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-gray-900 text-right text-base focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-gray-50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">円</span>
                </div>
                {formAssets && !isNaN(parseInt(formAssets)) && (
                  <p className="text-xs text-amber-500 mt-1 text-right font-medium">
                    {formatCurrency(parseInt(formAssets))}
                  </p>
                )}
              </div>

              {/* メモ（任意） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  メモ <span className="text-gray-400 font-normal text-xs">（任意）</span>
                </label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="例：給料日後、ボーナス入金後など"
                  maxLength={50}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-gray-50"
                />
              </div>

              {/* エラーメッセージ */}
              {formError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-500 flex-shrink-0">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  <p className="text-red-600 text-xs">{formError}</p>
                </div>
              )}

              {/* 保存ボタン */}
              <button
                onClick={handleSave}
                className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-sm rounded-xl py-4 transition-colors shadow-md shadow-amber-200 mt-2"
              >
                記録を保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
