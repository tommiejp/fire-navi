const {test}=require("node:test");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),ts=require("typescript");
function config(env){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,"../next.config.ts"),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS}}).outputText;
 new Function("module","exports","process",code)(module,module.exports,{env});
 return module.exports.default;
}
const env={NODE_ENV:"production",NEXT_PUBLIC_SUPABASE_URL:"https://project.supabase.co",KV_REST_API_URL:"https://private.upstash.io",KV_REST_API_TOKEN:"PRIVATE_TOKEN",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"PUBLIC_KEY",SUPABASE_SERVICE_ROLE_KEY:"PRIVATE_ROLE"};
test("required headers and safe production CSP rollout",async()=>{
 const rules=await config(env).headers();const headers=Object.fromEntries(rules[0].headers.map(h=>[h.key,h.value]));
 assert.equal(rules[0].source,"/:path*");
 assert.equal(headers["X-Content-Type-Options"],"nosniff");
 assert.equal(headers["Referrer-Policy"],"strict-origin-when-cross-origin");
 assert.equal(headers["Permissions-Policy"],"camera=(), microphone=(), geolocation=()");
 for(const key of ["Content-Security-Policy","Content-Security-Policy-Report-Only"]){
  const csp=headers[key];for(const directive of ["object-src 'none'","base-uri 'self'","frame-ancestors 'none'"])assert.ok(csp.includes(directive));
  for(const disallowed of ["*","unsafe-eval","unsafe-inline","data:","blob:"])assert.ok(!csp.includes(disallowed));
 }
 const report=headers["Content-Security-Policy-Report-Only"];
 for(const directive of ["default-src 'self'","script-src 'self'","style-src 'self'","img-src 'self'","font-src 'self'","connect-src 'self' https://project.supabase.co","frame-src 'none'","form-action 'self'"])assert.ok(report.includes(directive));
 for(const secret of ["PRIVATE_TOKEN","PUBLIC_KEY","PRIVATE_ROLE","upstash.io","accounts.google.com"])assert.ok(!JSON.stringify(headers).includes(secret));
 // Strict script restrictions are report-only until inline runtime is addressed.
 assert.ok(!headers["Content-Security-Policy"].includes("script-src"));
 assert.deepEqual(rules[1],{source:"/auth/callback",headers:[{key:"Referrer-Policy",value:"no-referrer"}]});
});
test("development allows eval and local HMR only in report policy",async()=>{
 const rules=await config({NODE_ENV:"development",PORT:"3005",NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54321"}).headers();
 const report=rules[0].headers.find(h=>h.key==="Content-Security-Policy-Report-Only").value;
 for(const text of ["'unsafe-eval'","ws://localhost:3005","http://127.0.0.1:54321"])assert.ok(report.includes(text));
});
test("missing public URL has no wildcard fallback; malformed URL never exposes input",async()=>{
 const rules=await config({NODE_ENV:"production"}).headers();assert.ok(!JSON.stringify(rules[0].headers).includes("supabase"));
 for(const value of ["https://user:SECRET@project.supabase.co","https://project.supabase.co?token=SECRET","https://project.supabase.co/path","https://*.supabase.co","http://localhost:54321","bad SECRET"]){
  await assert.rejects(config({NODE_ENV:"production",NEXT_PUBLIC_SUPABASE_URL:value}).headers(),{message:"Invalid public Supabase URL for security headers."});
 }
});
