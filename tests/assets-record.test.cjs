const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),ts=require("typescript"),React=require("react");
function load(file,mocks,browser={}) {
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function("require","module","exports","FormData",code)(n=>{if(n in mocks)return mocks[n];if(n==="react/jsx-runtime"||n==="react")return require(n);throw Error(n)},module,module.exports,browser.FormData||FormData);
 return module.exports;
}

function setup({user={id:"verified"},error=null,failAt=null}={}) {
 const writes=[];
 let clients=0;
 const api=load("app/my-plan/actions.ts",{
 "next/cache":{revalidatePath:()=>{throw Error("No revalidation needed");}},
 "@/lib/auth/user":{getAuthenticatedUser:async()=>{if(failAt==="auth")throw Error("private auth");return user;}},
 "@/lib/supabase/server":{createClient:async options=>{
  clients++;if(failAt==="client")throw Error("private config");
  assert.deepEqual(options,{writableCookies:true});
  return {from:table=>{assert.equal(table,"asset_history");return {insert:async payload=>{
   writes.push(payload);if(failAt==="db")throw Error("private db");return {error};
  }}}};
 }}});
 return {writes,clients:()=>clients,record:async(value="100",extras={})=>{
  const form=new FormData();if(value!==null)form.set("total_assets",value);
  for(const [k,v]of Object.entries(extras))form.set(k,v);
  return api.recordCurrentAssets(form);
 }};
}
test("unauthenticated recording never creates DB client",async()=>{
 const s=setup({user:null});assert.deepEqual(await s.record(),{status:"UNAUTHORIZED"});assert.equal(s.clients(),0);
});
test("INSERT uses verified identity and only assets; database owns id and timestamp",async()=>{
 const s=setup();
 for(const value of ["0","100",String(Number.MAX_SAFE_INTEGER)])assert.equal((await s.record(value,{user_id:"attacker",id:"injected",recorded_at:"2000-01-01",annual_expenses:"123"})).status,"SUCCESS");
 assert.deepEqual(s.writes,[0,100,Number.MAX_SAFE_INTEGER].map(total_assets=>({user_id:"verified",total_assets})));
});
test("invalid asset amounts rejected without DB calls",async()=>{
 for(const value of [null,""," ","-1","9007199254740992","1e3","1E3","NaN","Infinity","1.2","12x",new Blob(["1"])]){
  const s=setup();assert.equal((await s.record(value)).status,"VALIDATION_ERROR");assert.equal(s.clients(),0);
 }
});
test("DB errors and auth/client/query exceptions are generalized",async()=>{
 for(const options of [{error:{message:"private error"}},{failAt:"auth"},{failAt:"client"},{failAt:"db"}])assert.deepEqual(await setup(options).record(),{status:"SERVER_ERROR"});
});
function nodes(n){return !n||typeof n!=="object"?[]:[n,...React.Children.toArray(n.props?.children).flatMap(nodes)]}
test("form has one assets input, initial value, duplicate guard and retry after error",async()=>{
 let resolve,calls=0;const states=[];
 const Form=load("app/my-plan/AssetHistoryForm.tsx",{
 react:{useState:v=>[v,x=>states.push(x)],useRef:v=>({current:v})},
 "./actions":{recordCurrentAssets:async()=>{calls++;return new Promise(r=>resolve=r)}}
 },{FormData:class{}}).default;
 const tree=nodes(Form({initialAssets:0}));
 assert.deepEqual(tree.filter(n=>n.type==="input").map(n=>[n.props.name,n.props.defaultValue]),[["total_assets",0]]);
 const submit=tree.find(n=>n.type==="form").props.onSubmit,event={preventDefault(){},currentTarget:{}};
 const first=submit(event);await submit(event);assert.equal(calls,1);resolve({status:"SERVER_ERROR"});await first;
 assert.ok(states.includes(true));assert.ok(states.includes(false));assert.ok(states.includes("SERVER_ERROR"));
 const second=submit(event);assert.equal(calls,2);resolve({status:"SUCCESS"});await second;assert.ok(states.includes("SUCCESS"));
});
