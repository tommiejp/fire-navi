const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),ts=require("typescript"),React=require("react");
function load(file,mocks,browser={}) {
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function("require","module","exports","FormData",code)(n=>{if(n in mocks)return mocks[n];if(n==="@/lib/settings-input")return load("lib/settings-input.ts",{});if(n==="react/jsx-runtime"||n==="react")return require(n);throw Error(n)},module,module.exports,browser.FormData||FormData);
 return module.exports;
}
function setup({user={id:"verified"},error=null,fail=false}={}) {
 const rows=new Map(),calls=[];
 const api=load("app/my-plan/actions.ts",{
 "@/lib/rate-limit":{checkRateLimit:async()=>"ALLOWED"},
 "@/lib/auth/user":{getAuthenticatedUser:async()=>user},
 "next/cache":{revalidatePath:p=>calls.push(p)},
 "@/lib/supabase/server":{createClient:async options=>{
  assert.deepEqual(options,{writableCookies:true});
  return {from:table=>{assert.equal(table,"user_financial_settings");return {upsert:async(payload,options)=>{
   calls.push(payload); assert.deepEqual(options,{onConflict:"user_id"});
   if(fail)throw Error("private detail");if(!error)rows.set(payload.user_id,payload);return {error};
  }}}};
 }}});
 return {rows,calls,save:patch=>{const form=new FormData();for(const [k,v]of Object.entries({total_assets:"0",annual_expenses:"1",monthly_contribution:"0",expected_return:"5",user_id:"attacker",...patch}))form.set(k,v);return api.saveFinancialSettings(form)}};
}
test("unauthenticated save is rejected without write",async()=>{const s=setup({user:null});assert.deepEqual(await s.save(),{status:"UNAUTHORIZED"});assert.equal(s.calls.length,0)});
test("upsert inserts then updates only verified owner, ignores supplied user_id and target",async()=>{
 const s=setup();assert.equal((await s.save({fire_target:"123"})).status,"SUCCESS");
 assert.deepEqual(s.rows.get("verified"),{user_id:"verified",total_assets:0,annual_expenses:1,expected_return:5,monthly_contribution:0});
 assert.equal((await s.save({total_assets:"500",expected_return:"20"})).status,"SUCCESS");assert.equal(s.rows.size,1);assert.equal(s.rows.get("verified").total_assets,500);
 assert.equal((await s.save({total_assets:String(Number.MAX_SAFE_INTEGER),expected_return:"0"})).status,"SUCCESS");
 assert.equal((await s.save({expected_return:"5.25"})).status,"SUCCESS");assert.ok(s.calls.includes("/my-plan"));
});
test("invalid amounts and returns are rejected before DB write",async()=>{
 for(const key of ["total_assets","annual_expenses","monthly_contribution"])for(const value of ["-1","1e3","NaN","Infinity","9007199254740992","1.2",""," 1","1abc"]){const s=setup();assert.equal((await s.save({[key]:value})).status,"VALIDATION_ERROR");assert.equal(s.calls.length,0)}
 for(const patch of [{annual_expenses:"0"},...['-1','20.01','NaN','Infinity','1e1','5abc','', '5.123'].map(expected_return=>({expected_return}))]){const s=setup();assert.equal((await s.save(patch)).status,"VALIDATION_ERROR");assert.equal(s.calls.length,0)}
});
test("DB errors and exceptions are generalized",async()=>{for(const opts of [{error:{message:"private row"}},{fail:true}])assert.deepEqual(await setup(opts).save(),{status:"SERVER_ERROR"})});
function nodes(n){return !n||typeof n!=="object"?[]:[n,...React.Children.toArray(n.props?.children).flatMap(nodes)]}
test("form initial values, no owner input, duplicate prevention, success and retry",async()=>{
 let resolve,calls=0;const states=[];
 const Form=load("app/my-plan/SettingsForm.tsx",{
 react:{useState:v=>[v,x=>states.push(x)],useRef:v=>({current:v})},
 "./actions":{saveFinancialSettings:async()=>{calls++;return new Promise(r=>resolve=r)}}
 },{FormData:class{get(key){return {total_assets:"10",annual_expenses:"20",monthly_contribution:"0",expected_return:"5"}[key]}}}).default;
 const tree=nodes(Form({initial:{total_assets:10,annual_expenses:20,expected_return:5}}));
 assert.deepEqual(tree.filter(n=>n.type==="input").map(n=>[n.props.name,n.props.defaultValue]),[["total_assets",10],["annual_expenses",20],["monthly_contribution",0],["expected_return",5]]);
 const handler=tree.find(n=>n.type==="form").props.onSubmit,event={preventDefault(){},currentTarget:{}};
 const first=handler(event);await handler(event);assert.equal(calls,1);resolve({status:"SUCCESS"});await first;assert.ok(states.includes("SUCCESS"));
 const retry=handler(event);assert.equal(calls,2);resolve({status:"SERVER_ERROR"});await retry;assert.ok(states.includes("SERVER_ERROR"));
});

test("monthly contributions preserve zero, positive and safe integer boundary on insert/update", async()=>{
 const s=setup();
 for(const value of ["0","50000",String(Number.MAX_SAFE_INTEGER)]){
  assert.equal((await s.save({monthly_contribution:value,user_id:"other"})).status,"SUCCESS");
  assert.equal(s.rows.get("verified").monthly_contribution,Number(value));
  assert.equal(s.rows.size,1);
 }
});
test("monthly contribution form defaults and saved initial value",()=>{
 const Form=load("app/my-plan/SettingsForm.tsx",{
  react:{useState:v=>[v,()=>{}],useRef:v=>({current:v})},
  "./actions":{saveFinancialSettings:async()=>({status:"SUCCESS"})}
 }).default;
 for(const [initial,expected] of [[null,0],[{monthly_contribution:50000},50000]]){
  const input=nodes(Form({initial})).find(n=>n.type==="input"&&n.props.name==="monthly_contribution");
  assert.equal(input.props.defaultValue,expected);
 }
});

test("input guidance matches server boundaries",()=>{
 const validate=load("lib/settings-input.ts",{}).settingsInputError;
 for(const name of ["total_assets","annual_expenses","monthly_contribution"]){
  for(const value of ["","-1","1.5","1e3","NaN","Infinity","1,000","9007199254740992"])assert.ok(validate(name,value));
  assert.equal(validate(name,"9007199254740991"),undefined);
 }
 assert.ok(validate("annual_expenses","0"));
 assert.equal(validate("total_assets","0"),undefined);
 for(const value of ["0","5.25","20"])assert.equal(validate("expected_return",value),undefined);
 for(const value of ["-1","20.01","1e1","5.123","NaN","Infinity"])assert.ok(validate("expected_return",value));
});
test("invalid submit retains values, skips action and focuses first invalid field",async()=>{
 let calls=0,focused;const states=[];
 const Form=load("app/my-plan/SettingsForm.tsx",{
 react:{useState:v=>[v,x=>states.push(x)],useRef:v=>({current:v})},
 "./actions":{saveFinancialSettings:async()=>{calls++}}
 },{FormData:class{get(name){return name==="total_assets"?"0":""}}}).default;
 const tree=nodes(Form({initial:null}));
 const form=tree.find(n=>n.type==="form");
 assert.equal(form.props.noValidate,true);
 await form.props.onSubmit({preventDefault(){},currentTarget:{querySelector(selector){focused=selector;return {focus(){}}}}});
 assert.equal(calls,0);assert.equal(focused,'[name="annual_expenses"]');
 const errors=states.find(s=>s&&s.annual_expenses);
 assert.ok(errors.annual_expenses);assert.ok(errors.expected_return);
 for(const input of tree.filter(n=>n.type==="input"))assert.ok(input.props["aria-describedby"].includes("-hint"));
});
