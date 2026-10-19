const {test}=require("node:test");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),ts=require("typescript");
function load(file,mocks={}){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS}}).outputText;
 new Function("require","module","exports",code)(n=>{if(n==="server-only")return {};if(n in mocks)return mocks[n];throw Error(n)},module,module.exports);
 return module.exports;
}
const {createRateLimiter,checkRateLimit}=load("lib/rate-limit/index.ts", { "./upstash": { upstashStore: { incrementWithTtl: async () => { throw Error("unconfigured"); } } } });
const limits={saveFinancialSettings:20,recordCurrentAssets:10,updateProfile:10};
test("limits, action/user keys and first-request TTL contract",async()=>{
 let now=0;const entries=new Map(),keys=[];
 const check=createRateLimiter({incrementWithTtl:async(key,ttl)=>{
  assert.equal(ttl,60);keys.push(key);let e=entries.get(key);
  if(!e||now>=e.expires){e={count:0,expires:now+ttl};entries.set(key,e)}
  return ++e.count;
 }});
 for(const [action,max]of Object.entries(limits)){
  for(let i=0;i<max;i++)assert.equal(await check(action,"A"),"ALLOWED");
  assert.equal(await check(action,"A"),"RATE_LIMITED");assert.equal(await check(action,"B"),"ALLOWED");
 }
 assert.equal(new Set(keys).size,6);assert.ok(keys.includes("fire-navi:rate-limit:v1:saveFinancialSettings:A"));
 now=59;assert.equal(await check("saveFinancialSettings","A"),"RATE_LIMITED");
 now=60;assert.equal(await check("saveFinancialSettings","A"),"ALLOWED");
});
test("unconfigured store, backend exceptions and invalid counts yield safe errors",async()=>{
 assert.equal(await checkRateLimit("saveFinancialSettings","A"),"SERVER_ERROR");
 for(const count of [0,-1,NaN,Infinity,1.5])assert.equal(await createRateLimiter({incrementWithTtl:async()=>count})("updateProfile","A"),"SERVER_ERROR");
 assert.equal(await createRateLimiter({incrementWithTtl:async()=>{throw Error("private token")}})("updateProfile","A"),"SERVER_ERROR");
});
function actionHarness(name,{user={id:"verified"},count=1,fail=false}={}){
 const events=[];
 const check=createRateLimiter({incrementWithTtl:async(key,ttl)=>{events.push(["store",key,ttl]);if(fail)throw Error("raw error");return count}});
 const query={};
 for(const method of ["from","upsert","insert","update","eq","select"]){query[method]=()=>{events.push(method);return query}}
 query.then=resolve=>resolve({data:{display_name:"ok"},error:null});query.maybeSingle=async()=>({data:{display_name:"ok"},error:null});
 const api=load(name==="updateProfile"?"app/account/actions.ts":"app/my-plan/actions.ts",{
 "next/cache":{revalidatePath:()=>{}},"next/navigation":{redirect:()=>{}},
 "@/lib/auth/user":{getAuthenticatedUser:async()=>{events.push("auth");return user}},
 "@/lib/rate-limit":{checkRateLimit:check},
 "@/lib/supabase/server":{createClient:async()=>{events.push("db");return {from:query.from}}},
 });
 return {events,run:invalid=>api[name]({get:key=>{events.push(["input",key]);return invalid?"":({total_assets:"0",annual_expenses:"1",monthly_contribution:"0",expected_return:"5",display_name:"ok",user_id:"attacker"})[key]}})};
}
test("all actions: auth then rate limit then validation then DB, verified keys only",async()=>{
 for(const name of Object.keys(limits)){
  const s=actionHarness(name);assert.equal((await s.run(false)).status,"SUCCESS");
  assert.equal(s.events[0],"auth");assert.deepEqual(s.events[1],["store",`fire-navi:rate-limit:v1:${name}:verified`,60]);
  assert.equal(s.events[2][0],"input");assert.ok(s.events.indexOf("db")>2);assert.ok(!JSON.stringify(s.events).includes("attacker"));
 }
});
test("all actions: unauthenticated skips store; limit/failure skips validation and DB",async()=>{
 for(const [name,max]of Object.entries(limits)){
  const anon=actionHarness(name,{user:null});assert.equal((await anon.run()).status,"UNAUTHORIZED");assert.deepEqual(anon.events,["auth"]);
  for(const [options,status]of [[{count:max+1},"RATE_LIMITED"],[{fail:true},"SERVER_ERROR"]]){
   const s=actionHarness(name,options);assert.equal((await s.run(true)).status,status);assert.equal(s.events.length,2);
  }
 }
});
test("invalid input consumes quota before validation",async()=>{
 const s=actionHarness("saveFinancialSettings");assert.equal((await s.run(true)).status,"VALIDATION_ERROR");assert.equal(s.events[1][0],"store");assert.ok(!s.events.includes("db"));
});
