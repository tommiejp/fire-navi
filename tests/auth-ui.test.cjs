const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function load(file, mocks = {}, env = {}, browser = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", "window", "FormData", code)(
    name => {
      if (name in mocks) return mocks[name];
      if (["react", "react/jsx-runtime"].includes(name)) return require(name);
      throw Error(`Unexpected import ${name}`);
    }, module, module.exports, { env }, browser.window, browser.FormData,
  );
  return module.exports;
}
const callbackUrl = "https://fire-navi.vercel.app/auth/callback";
function formModule(auth) {
  return load("lib/auth/form.ts", { "@/lib/supabase/client": { createClient: () => ({ auth }) } });
}

test("registration validation rejects missing/invalid email, short password and mismatch before API", async () => {
  let calls = 0;
  const { submitCredentials } = formModule({ signUp: async () => { calls++; throw Error("unexpected"); } });
  for (const [email, password, confirm] of [
    ["", "abcdefghijkl", "abcdefghijkl"], ["invalid", "abcdefghijkl", "abcdefghijkl"],
    ["a@b.test", "", ""], ["a@b.test", "abcdefghijk", "abcdefghijk"],
    ["a@b.test", "abcdefghijkl", "different"], ["a@b.test", "😀".repeat(6), "😀".repeat(6)],
  ]) assert.equal((await submitCredentials("register", email, password, confirm, callbackUrl)).status, "error");
  assert.equal(calls, 0);
});

test("registration: confirmation vs immediate session; only credentials and fixed callback sent", async () => {
  for (const session of [null, { access_token: "test-only" }]) {
    const { submitCredentials } = formModule({ signUp: async payload => {
      assert.deepEqual(payload, { email: "a@b.test", password: "abcdefghijkl", options: { emailRedirectTo: callbackUrl } });
      return { data: { session }, error: null };
    } });
    assert.equal((await submitCredentials("register", " a@b.test ", "abcdefghijkl", "abcdefghijkl", callbackUrl)).status, session ? "authenticated" : "confirmation");
  }
});

test("login validation and success; short existing passwords are not subject to signup policy", async () => {
  let calls = 0;
  const { submitCredentials } = formModule({ signInWithPassword: async payload => {
    calls++; assert.deepEqual(payload, { email: "a@b.test", password: "oldpass" });
    return { data: { session: {} }, error: null };
  } });
  assert.equal((await submitCredentials("login", "", "oldpass", "", callbackUrl)).status, "error");
  assert.equal((await submitCredentials("login", "a@b.test", "", "", callbackUrl)).status, "error");
  assert.equal((await submitCredentials("login", "a@b.test", "oldpass", "", callbackUrl)).status, "authenticated");
  assert.equal(calls, 1);
});

test("Auth errors, exceptions and client creation failures are generalized", async () => {
  for (const fail of [async () => ({ data: {}, error: { message: "private internal detail" } }), async () => { throw Error("private internal detail"); }]) {
    const api = formModule({ signUp: fail, signInWithPassword: fail, signInWithOAuth: fail });
    for (const mode of ["login", "register"]) {
      assert.deepEqual(await api.submitCredentials(mode, "a@b.test", "abcdefghijkl", "abcdefghijkl", callbackUrl), { status: "error", message: api.AUTH_ERROR });
    }
    assert.deepEqual(await api.startGoogleLogin(callbackUrl), { status: "error", message: api.AUTH_ERROR });
  }
  const api = load("lib/auth/form.ts", { "@/lib/supabase/client": { createClient: () => { throw Error("secret config"); } } });
  assert.equal((await api.startGoogleLogin(callbackUrl)).message, api.AUTH_ERROR);
  assert.equal((await api.submitCredentials("login", "a@b.test", "password", "", callbackUrl)).message, api.AUTH_ERROR);
});

test("Google uses Supabase OAuth with existing callback and no user-controlled next", async () => {
  const { startGoogleLogin } = formModule({ signInWithOAuth: async payload => {
    assert.deepEqual(payload, { provider: "google", options: { redirectTo: callbackUrl } });
    return { error: null };
  } });
  assert.equal((await startGoogleLogin(callbackUrl)).status, "oauth");
});

function page(user, error, env = {}) {
  return load("app/components/AuthPage.tsx", {
    "next/navigation": { redirect: target => { throw Error(`REDIRECT:${target}`); } },
    "@/lib/auth/user": { getAuthenticatedUser: async () => { if (error) throw error; return user; } },
    "./SupabaseAuthForm": { default: () => null },
  }, env).default;
}

test("anonymous pages render; authenticated access redirects; unavailable Auth safely disables form", async () => {
  for (const mode of ["login", "register"]) {
    const view = await page(null)( { mode });
    assert.equal(view.props.mode, mode);
    assert.equal(view.props.unavailable, false);
    assert.equal(view.props.callbackUrl, callbackUrl);
    await assert.rejects(page({ id: "verified" })({ mode }), /REDIRECT:\/my-plan/);
    const unavailable = await page(null, Error("private details"))({ mode });
    assert.equal(unavailable.props.unavailable, true);
    assert.ok(!unavailable.props.initialError.includes("private details"));
  }
  const failed = await page(null)({ mode: "login", callbackFailed: true });
  assert.ok(failed.props.initialError);
  const invalid = await page(null, null, { APP_ORIGIN: "https://evil.example/path" })({ mode: "login" });
  assert.equal(invalid.props.unavailable, true);
});

const link = { default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) };
const inertApi = { AUTH_ERROR: "安全なエラー", submitCredentials: async () => ({ status: "confirmation" }), startGoogleLogin: async () => ({ status: "oauth" }) };

test("rendered forms have labels, autocomplete, links, alerts and disabled state", () => {
  const Form = load("app/components/SupabaseAuthForm.tsx", { "next/link": link, "@/lib/auth/form": inertApi }).default;
  for (const mode of ["login", "register"]) {
    const html = renderToStaticMarkup(React.createElement(Form, { mode, callbackUrl, unavailable: true }));
    for (const text of ['href="/"', 'for="email"', 'for="password"', 'autoComplete="email"', 'role="alert"', 'disabled=""']) assert.ok(html.includes(text), text);
    assert.ok(html.includes(mode === "login" ? 'autoComplete="current-password"' : 'autoComplete="new-password"'));
    assert.ok(html.includes(mode === "login" ? 'href="/register"' : 'href="/login"'));
    if (mode === "register") assert.ok(html.includes('for="confirm"'));
    else assert.ok(html.includes("Googleでログイン"));
  }
});

function nodes(node) {
  if (!node || typeof node !== "object") return [];
  return [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];
}

test("UI blocks concurrent email/Google submissions and navigates only to /my-plan", async () => {
  let resolve, calls = 0;
  const destinations = [];
  const values = [];
  const Form = load("app/components/SupabaseAuthForm.tsx", {
    "next/link": link,
    react: { useState: value => [value, v => values.push(v)], useRef: value => ({ current: value }) },
    "@/lib/auth/form": { ...inertApi,
      submitCredentials: async () => { calls++; return new Promise(r => { resolve = r; }); },
      startGoogleLogin: async () => { calls++; return { status: "oauth" }; },
    },
  }, {}, { window: { location: { assign: target => destinations.push(target) } }, FormData: class { get() { return "test"; } } }).default;
  const tree = nodes(Form({ mode: "login", callbackUrl }));
  const submit = tree.find(n => n.type === "form").props.onSubmit;
  const google = tree.find(n => n.type === "button" && n.props.type === "button").props.onClick;
  const event = { preventDefault() {}, currentTarget: {} };
  submit(event); submit(event); google();
  assert.equal(calls, 1);
  resolve({ status: "authenticated" });
  await new Promise(setImmediate);
  assert.deepEqual(destinations, ["/my-plan"]);
  assert.ok(values.includes(true));
});


test("both route pages require per-request rendering and login maps callback errors safely", async () => {
  const mocks = { "../components/AuthPage": { default: () => null } };
  const login = load("app/login/page.tsx", mocks);
  const register = load("app/register/page.tsx", mocks);
  assert.equal(login.dynamic, "force-dynamic");
  assert.equal(register.dynamic, "force-dynamic");
  assert.equal((await login.default({ searchParams: Promise.resolve({ error: "auth" }) })).props.callbackFailed, true);
  assert.equal((await login.default({ searchParams: Promise.resolve({ error: "private error" }) })).props.callbackFailed, false);
  assert.equal(register.default().props.mode, "register");
});
