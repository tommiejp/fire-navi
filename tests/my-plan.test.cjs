const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function load({ user = { email: "member@example.com" }, authError, result = { data: null, error: null }, clientError, queryError } = {}) {
  const calls = [];
  const mocks = {
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/navigation": { redirect: path => { throw Error(`REDIRECT:${path}`); } },
    "@/lib/auth/user": { getAuthenticatedUser: async () => { calls.push("auth"); if (authError) throw authError; return user; } },
    "@/lib/supabase/server": { createClient: async (...args) => {
      calls.push(["client", ...args]);
      if (clientError) throw clientError;
      return { from: table => {
        calls.push(["from", table]);
        return { select: columns => {
          calls.push(["select", columns]);
          return { maybeSingle: async () => { calls.push("maybeSingle"); if (queryError) throw queryError; return result; } };
        } };
      } };
    } },
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../app/my-plan/page.tsx"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => {
    if (name in mocks) return mocks[name];
    if (name === "react/jsx-runtime") return require(name);
    throw Error(`Unexpected import ${name}`);
  }, module, module.exports);
  return { page: module.exports.default, dynamic: module.exports.dynamic, calls };
}

test("unauthenticated access redirects before creating a DB client", async () => {
  const { page, calls, dynamic } = load({ user: null });
  assert.equal(dynamic, "force-dynamic");
  await assert.rejects(page(), { message: "REDIRECT:/login" });
  assert.deepEqual(calls, ["auth"]);
});

test("authenticated empty state and minimal RLS query ignore supplied user_id", async () => {
  const { page, calls } = load();
  const html = renderToStaticMarkup(await page({ searchParams: { user_id: "attacker" }, user_id: "attacker" }));
  for (const text of ["マイプラン", "ログイン済み", "member@example.com", "設定はまだありません", 'href="/"']) assert.ok(html.includes(text));
  assert.ok(!html.includes("attacker"));
  assert.deepEqual(calls, ["auth", ["client"], ["from", "user_financial_settings"], ["select", "total_assets, annual_expenses, expected_return, updated_at"], "maybeSingle"]);
});

test("settings returned by the session-scoped DB read are displayed", async () => {
  const data = { total_assets: 0, annual_expenses: 2400000, expected_return: "5.00", updated_at: "2026-10-10T00:00:00+00:00" };
  const { page } = load({ result: { data, error: null } });
  const html = renderToStaticMarkup(await page());
  for (const text of ["総資産", "年間支出", "2400000", "5.00", data.updated_at]) assert.ok(html.includes(text));
  assert.ok(!html.includes("設定はまだありません"));
});

test("returned DB error, thrown query error and client failure show only a generic message", async () => {
  for (const options of [
    { result: { data: { total_assets: "private row" }, error: { message: "internal SQL detail" } } },
    { queryError: Error("internal SQL detail") },
    { clientError: Error("internal SQL detail") },
  ]) {
    const html = renderToStaticMarkup(await load(options).page());
    assert.ok(html.includes("設定を取得できませんでした"));
    assert.ok(!html.includes("internal SQL detail"));
    assert.ok(!html.includes("private row"));
    assert.ok(!html.includes("設定はまだありません"));
  }
});

test("auth failure exposes no protected contents and never reads the database", async () => {
  const { page, calls } = load({ authError: Error("private auth error") });
  const html = renderToStaticMarkup(await page());
  assert.ok(html.includes("認証を確認できませんでした"));
  for (const text of ["private auth error", "member@example.com", "ログイン済み", "FIRE設定"]) assert.ok(!html.includes(text));
  assert.deepEqual(calls, ["auth"]);
});
