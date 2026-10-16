const {test}=require("node:test");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),ts=require("typescript"),React=require("react");
const {renderToStaticMarkup}=require("react-dom/server");
function load(file,mocks={}){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function("require","module","exports",code)(n=>n==="react/jsx-runtime"?require(n):mocks[n],m,m.exports);return m.exports}
const helper=load("lib/asset-change.ts"),calc=helper.calculateAssetChange;
const rows=(...values)=>values.map(total_assets=>({total_assets}));
test("increase, decrease and unchanged",()=>{
 assert.deepEqual(calc(rows(120,100)),{amount:20,percentage:20});
 assert.deepEqual(calc(rows(80,100)),{amount:-20,percentage:-20});
 assert.deepEqual(calc(rows(100,100)),{amount:0,percentage:0});
});
test("0 or 1 record and zero denominator",()=>{
 assert.equal(calc([]),null);assert.equal(calc(rows(100)),null);
 assert.deepEqual(calc(rows(100,0)),{amount:100,percentage:null});
 assert.deepEqual(calc(rows(0,0)),{amount:0,percentage:null});
});
test("safe integer strings accepted; unsafe values not calculated",()=>{
 assert.deepEqual(calc(rows("120","100")),{amount:20,percentage:20});
 assert.equal(calc(rows("1e3",100)),null);assert.equal(calc(rows(9007199254740992,100)),null);
});
async function render(data,error=null){
 const calls=[];
 const query={select:(...args)=>{calls.push(["select",...args]);return query},order:(...args)=>{calls.push(["order",...args]);return query},limit:async n=>{calls.push(["limit",n]);return {data,error}}};
 const View=load("app/my-plan/AssetChange.tsx",{
 "@/lib/asset-change":helper,
 "next/link":{default:({children,...props})=>React.createElement("a",props,children)},
 "@/lib/supabase/server":{createClient:async()=>({from:table=>{calls.push(["from",table]);return query}})},
 }).default;
 return {html:renderToStaticMarkup(await View({user_id:"attacker"})),calls};
}
test("latest two query, yen display, rounded percentage and internal link",async()=>{
 const {html,calls}=await render(rows(1234567,1000000));
 assert.deepEqual(calls,[["from","asset_history"],["select","total_assets"],["order","recorded_at",{ascending:false}],["order","id",{ascending:false}],["limit",2]]);
 for(const text of ["+234,567 円","+23.5%",'href="/history"',"資産推移を見る"])assert.ok(html.includes(text));
 assert.ok(!html.includes("attacker"));
});
test("empty, one, zero previous and safe errors keep the history link",async()=>{
 for(const data of [[],rows(1)])assert.ok((await render(data)).html.includes("2件以上"));
 assert.ok((await render(rows(100,0))).html.includes("算出不可（前回0円）"));
 const {html}=await render(null,{message:"private token"});assert.ok(html.includes("取得できませんでした"));assert.ok(!html.includes("private token"));assert.ok(html.includes('href="/history"'));
});
