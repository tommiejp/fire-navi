const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { NextRequest, NextResponse } = require("next/server");

function load(file, mocks = {}, env = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", code)(
    (name) => {
      if (name === "server-only") return {};
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import: ${name}`);
    }, module, module.exports, { env }
  );
  return module.exports;
}
const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

function callback(result = { error: null }, env = {}) {
  const calls = [];
  const route = load("app/auth/callback/route.ts", {
    "next/server": { NextResponse },
    "@/lib/supabase/server": { createClient: async (options) => {
      assert.equal(options.writableCookies, true);
      options.responseHeaders.set("Expires", "0");
      return { auth: { exchangeCodeForSession: async (code) => {
        calls.push(code);
        if (result instanceof Error) throw result;
        return result;
      } } };
    } },
  }, env);
  return { calls, get: (query) => route.GET(new Request(`https://untrusted.example/auth/callback?${query}`, {
    headers: { "x-forwarded-host": "evil.example" },
  })) };
}

test("callback: exact allowlist, default and trusted origin", async () => {
  const { get, calls } = callback();
  for (const next of ["/", "/my-plan", "/history", "/account"]) {
    const response = await get(new URLSearchParams({ code: "test-code", next }));
    assert.equal(response.headers.get("location"), `https://fire-navi.vercel.app${next}`);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(response.headers.get("expires"), "0");
  }
  assert.equal(calls.length, 4);
  assert.equal((await get("code=test-code")).headers.get("location"), "https://fire-navi.vercel.app/my-plan");
});

test("callback: external, backslash, query, fragment and encoded redirects rejected", async () => {
  const { get } = callback();
  for (const next of ["//evil.example", "https://evil.example", "https://fire-navi.vercel.app/account", "/\\evil.example", "\\evil.example", "/account?next=https://evil.example", "/history#x", "%2F%2Fevil.example", "/my-plan/", " /account", "/account\n"]) {
    const response = await get(new URLSearchParams({ code: "test-code", next }));
    assert.equal(response.headers.get("location"), "https://fire-navi.vercel.app/my-plan", next);
  }
});

test("callback: missing code, provider error, exchange failure and thrown error", async () => {
  const missing = callback();
  for (const query of ["", "code=", "code=test-code&error=access_denied"]) {
    assert.equal((await missing.get(query)).headers.get("location"), "https://fire-navi.vercel.app/login?error=auth");
  }
  assert.equal(missing.calls.length, 0);
  for (const result of [{ error: { message: "private detail" } }, Error("private detail")]) {
    const response = await callback(result).get("code=test-code");
    assert.equal(response.headers.get("location"), "https://fire-navi.vercel.app/login?error=auth");
  }
  assert.equal((await callback(undefined, { APP_ORIGIN: "http://localhost:3000" }).get("code=test-code")).headers.get("location"), "http://localhost:3000/my-plan");
});

test("server client: read-only default, explicit writes, cache headers, no swallowed write failures", async () => {
  let options;
  let fail = false;
  const writes = [];
  const store = { getAll: () => [{ name: "auth", value: "old" }], set: (...args) => {
    if (fail) throw Error("write failed");
    writes.push(args);
  } };
  const { createClient } = load("lib/supabase/server.ts", {
    "next/headers": { cookies: async () => store },
    "@supabase/ssr": { createServerClient: (_url, _key, value) => { options = value; return {}; } },
  }, publicEnv);
  assert.notEqual(await createClient(), await createClient());
  assert.deepEqual(options.cookies.getAll(), store.getAll());
  const batch = [{ name: "auth", value: "new", options: { httpOnly: true } }];
  options.cookies.setAll(batch, {});
  assert.equal(writes.length, 0);
  const headers = new Headers();
  await createClient({ writableCookies: true, responseHeaders: headers });
  options.cookies.setAll(batch, { "Cache-Control": "private, no-store" });
  assert.deepEqual(writes[0], ["auth", "new", { httpOnly: true }]);
  assert.equal(headers.get("cache-control"), "private, no-store");
  fail = true;
  assert.throws(() => options.cookies.setAll(batch, {}), /write failed/);
});

test("proxy: refreshed cookies reach request, downstream request and response across multiple writes", async () => {
  const request = new NextRequest("https://example.com/my-plan", { headers: { cookie: "auth=old" } });
  let verified = false;
  const { updateSession } = load("lib/supabase/proxy.ts", {
    "next/server": { NextResponse },
    "@supabase/ssr": { createServerClient: (_url, _key, { cookies }) => ({ auth: { getClaims: async () => {
      verified = true;
      assert.equal(cookies.getAll()[0].value, "old");
      cookies.setAll([{ name: "auth", value: "new", options: { httpOnly: true, path: "/" } }], { "Cache-Control": "private, no-store", Expires: "0" });
      cookies.setAll([{ name: "second", value: "value", options: { path: "/" } }], {});
      return { data: { user: null }, error: null };
    } } }) },
  }, publicEnv);
  const response = await updateSession(request);
  assert.ok(verified);
  assert.equal(request.cookies.get("auth").value, "new");
  assert.equal(response.cookies.get("auth").value, "new");
  assert.equal(response.cookies.get("auth").httpOnly, true);
  assert.equal(response.cookies.get("second").value, "value");
  assert.match(response.headers.get("x-middleware-request-cookie"), /auth=new/);
  assert.equal(response.headers.get("expires"), "0");
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("proxy: missing configuration passes through without auth calls; public calculator is excluded", async () => {
  const { updateSession } = load("lib/supabase/proxy.ts", {
    "next/server": { NextResponse }, "@supabase/ssr": { createServerClient: () => { throw Error("Must not call"); } },
  });
  assert.equal((await updateSession(new NextRequest("https://example.com/login"))).status, 200);
  const { config } = load("proxy.ts", { "@/lib/supabase/proxy": { updateSession } });
  const { unstable_doesMiddlewareMatch } = require("next/experimental/testing/server");
  for (const url of ["/login", "/register", "/my-plan", "/history", "/account"]) {
    assert.ok(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }));
  }
  for (const url of ["/", "/auth/callback", "/_next/static/test.js", "/favicon.ico"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), false);
  }
});

test("user helper: verified user, unauthenticated null, generic infrastructure error", async () => {
  for (const [result, expected] of [
    [{ data: { user: { id: "verified-id" } }, error: null }, "verified-id"],
    [{ data: { user: null }, error: null }, null],
    [{ data: { user: null }, error: { name: "AuthSessionMissingError" } }, null],
    [{ data: { user: null }, error: { status: 401 } }, null],
    [{ data: { user: null }, error: { status: 403 } }, null],
  ]) {
    const { getAuthenticatedUser } = load("lib/auth/user.ts", { "@/lib/supabase/server": {
      createClient: async () => ({ auth: { getUser: async () => result } }),
    } });
    const user = await getAuthenticatedUser();
    assert.equal(user?.id ?? null, expected);
  }
  const { getAuthenticatedUser } = load("lib/auth/user.ts", { "@/lib/supabase/server": {
    createClient: async () => ({ auth: { getUser: async () => { throw Error("sensitive detail"); } } }),
  } });
  await assert.rejects(getAuthenticatedUser(), { message: "SERVER_ERROR" });
});


test("user helper: client creation and returned Auth failures become SERVER_ERROR", async () => {
  for (const createClient of [
    async () => { throw Error("private configuration detail"); },
    async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: { status: 500, message: "private detail" } }) } }),
  ]) {
    const { getAuthenticatedUser } = load("lib/auth/user.ts", {
      "@/lib/supabase/server": { createClient },
    });
    await assert.rejects(getAuthenticatedUser(), { message: "SERVER_ERROR" });
  }
});
