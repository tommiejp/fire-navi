const {test}=require("node:test");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),ts=require("typescript");
function load(file,mocks={},env={},fetcher){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS}}).outputText;
 new Function("require","module","exports","process","fetch",code)(n=>{if(n==="server-only")return {};if(n in mocks)return mocks[n];throw Error(n)},module,module.exports,{env},fetcher);
 return module.exports;
}
const env={KV_REST_API_URL:"https://example.upstash.io",KV_REST_API_TOKEN:"test-only-secret"};
function setup(e=env,fetcher=async()=>({ok:true,json:async()=>({result:1})})){
 const store=load("lib/rate-limit/upstash.ts",{},e,fetcher).upstashStore;
 const limiter=load("lib/rate-limit/index.ts",{"./upstash":{upstashStore:store}}).checkRateLimit;
 return {store,limiter};
}
test("one EVAL POST, first increment alone sets TTL; no cache/redirect/retry",async()=>{
 const calls=[];const {store}=setup(env,async(...args)=>{calls.push(args);return {ok:true,json:async()=>({result:2})}});
 assert.equal(await store.incrementWithTtl("test-key",60),2);assert.equal(calls.length,1);
 const [url,options]=calls[0];assert.equal(url.origin,env.KV_REST_API_URL);assert.equal(options.method,"POST");
 assert.equal(options.headers.Authorization,`Bearer ${env.KV_REST_API_TOKEN}`);
 assert.equal(options.cache,"no-store");assert.equal(options.redirect,"error");assert.ok(options.signal instanceof AbortSignal);
 const [command,script,numkeys,key,ttl]=JSON.parse(options.body);
 assert.equal(command,"EVAL");assert.equal(numkeys,1);assert.equal(key,"test-key");assert.equal(ttl,60);
 assert.equal(script,"local count = redis.call('INCR', KEYS[1])\nif count == 1 then\n  redis.call('EXPIRE', KEYS[1], ARGV[1])\nend\nreturn count");
 assert.ok(!options.body.includes(env.KV_REST_API_TOKEN));
});
test("missing config yields SERVER_ERROR without network or fallback",async()=>{
 for(const e of [{},{KV_REST_API_URL:env.KV_REST_API_URL},{KV_REST_API_TOKEN:env.KV_REST_API_TOKEN},{KV_REST_API_URL:env.KV_REST_API_URL,KV_REST_API_READ_ONLY_TOKEN:"ignored"}]){
 let calls=0;const {limiter}=setup(e,async()=>{calls++;throw Error("unexpected")});assert.equal(await limiter("updateProfile","A"),"SERVER_ERROR");assert.equal(calls,0);
 }
});
test("invalid response, HTTP and network errors expose no raw details and never retry",async()=>{
 const cases=[async()=>{throw Error("test-only-secret")},async()=>({ok:false,json:async()=>{throw Error("do not read")}}),async()=>({ok:true,json:async()=>{throw Error("bad JSON")}})];
 for(const body of [{result:"1"},{result:0},{result:-1},{result:1.5},{result:Number.MAX_SAFE_INTEGER+1},{result:Infinity},{result:null},{error:"test-only-secret",result:1},null,{}])cases.push(async()=>({ok:true,json:async()=>body}));
 for(const response of cases){let calls=0;const {store}=setup(env,async()=>{calls++;return response()});await assert.rejects(store.incrementWithTtl("key",60),{message:"Rate limit store unavailable."});assert.equal(calls,1)}
 const {limiter}=setup(env,async()=>{throw Error("private token")});assert.equal(await limiter("recordCurrentAssets","A"),"SERVER_ERROR");
});
test("real adapter wiring maintains 20/10/10 boundaries with REST counts",async()=>{
 for(const [action,max]of Object.entries({saveFinancialSettings:20,recordCurrentAssets:10,updateProfile:10})){
 let count=0;const {limiter}=setup(env,async()=>({ok:true,json:async()=>({result:++count})}));
 for(let i=0;i<max;i++)assert.equal(await limiter(action,"verified"),"ALLOWED");
 assert.equal(await limiter(action,"verified"),"RATE_LIMITED");
 }
});
