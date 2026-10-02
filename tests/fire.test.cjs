const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
// 既存のTypeScriptだけを使い、実装そのものをメモリ内で読み込む。
const source = fs.readFileSync(path.join(__dirname, "../lib/fire.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function("exports", "module", compiled)(loaded.exports, loaded);
const { parseAmount, restoreFireData, isValidFireData, calculateFire, MAX_AMOUNT } = loaded.exports;
const data = { total_assets: 10_000_000, annual_spending: 2_400_000, return_rate: 0.05 };

test("0円は資産のみ有効。空欄・指数・小数・負数・混在文字列を拒否", () => {
  assert.equal(parseAmount("0", false).value, 0);
  assert.equal(parseAmount("0", true).value, null);
  for (const raw of ["", " ", "1e7", "Infinity", "NaN", "-1", "+1", "1.5", "123abc", "１", "1,000", "9".repeat(400)]) {
    assert.equal(parseAmount(raw, false).value, null, raw);
    assert.ok(parseAmount(raw, false).error, raw);
  }
  assert.equal(parseAmount("00012", false).value, 12);
  assert.equal(parseAmount(String(MAX_AMOUNT), false).value, MAX_AMOUNT);
  assert.equal(parseAmount(String(MAX_AMOUNT + 1), false).value, null);
});

test("復元は通常値のみ受理し、壊れたJSON・型・範囲を拒否", () => {
  assert.deepEqual(restoreFireData(JSON.stringify(data)), data);
  for (const raw of ["{", "null", "[]", '"text"', "{}", '{"total_assets":1e309,"annual_spending":1,"return_rate":0.05}']) {
    assert.equal(restoreFireData(raw), null, raw);
  }
  for (const patch of [{total_assets:-1}, {total_assets:Infinity}, {total_assets:NaN}, {total_assets:1.5}, {total_assets:"10"}, {total_assets:MAX_AMOUNT+1}, {annual_spending:0}, {annual_spending:-1}, {annual_spending:null}, {return_rate:0.029}, {return_rate:0.071}, {return_rate:Infinity}]) {
    assert.equal(isValidFireData({...data, ...patch}), false);
    assert.equal(restoreFireData(JSON.stringify({...data, ...patch})), null);
    assert.equal(calculateFire({...data, ...patch}), null);
  }
});

test("3/5/7%：理論式の初回到達年と一致し、毎年丸めない", () => {
  for (const rate of [0.03, 0.05, 0.07]) {
    const result = calculateFire({...data, return_rate:rate});
    const theoretical = Math.ceil(Math.log(6) / Math.log(1+rate));
    assert.equal(result.fireTarget, 60_000_000);
    assert.equal(result.yearsToFire, theoretical <= 60 ? theoretical : null);
    const last = result.simulation.at(-1);
    assert.ok(Math.abs(last.assets - data.total_assets * (1+rate)**last.year) < 0.001);
    if (result.yearsToFire !== null) assert.ok(result.simulation.at(-2).assets < result.fireTarget);
  }
  const tiny = calculateFire({total_assets:10, annual_spending:1, return_rate:0.03});
  assert.equal(tiny.yearsToFire, Math.ceil(Math.log(2.5)/Math.log(1.03)));
});

test("達成済み・0円・上限60年の境界", () => {
  for (const total_assets of [60_000_000, 70_000_000]) {
    const r = calculateFire({...data,total_assets});
    assert.equal(r.yearsToFire,0); assert.equal(r.simulation.length,1);
  }
  const zero=calculateFire({...data,total_assets:0});
  assert.equal(zero.yearsToFire,null); assert.equal(zero.simulation.length,61);
  assert.equal(zero.simulation.at(-1).assets,0);
  const at60=Math.ceil(60_000_000/(1.05**60));
  assert.equal(calculateFire({...data,total_assets:at60}).yearsToFire,60);
  assert.equal(calculateFire({...data,total_assets:at60-1}).yearsToFire,null);
});
