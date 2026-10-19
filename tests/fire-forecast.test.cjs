const {test}=require("node:test");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),ts=require("typescript"),React=require("react");
const {renderToStaticMarkup}=require("react-dom/server");
function load(file,mocks={}) {
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function("require","module","exports",code)(n=>{if(n in mocks)return mocks[n];if(n==="react/jsx-runtime")return require(n);throw Error(n)},module,module.exports);
 return module.exports;
}

const helpers=load("lib/fire-forecast.ts");
const calc=helpers.calculateFireForecast;
const View=load("app/my-plan/FireForecast.tsx",{"@/lib/fire-forecast":helpers}).default;
const base={total_assets:0,annual_expenses:48,monthly_contribution:1,expected_return:0};
test("already achieved is zero months",()=>{
 for(const total_assets of [1200,1500])assert.deepEqual(calc({...base,total_assets}),{status:"alreadyAchieved",months:0});
});
test("zero return, month-end contributions and year/month conversion",()=>{
 assert.deepEqual(calc({...base,monthly_contribution:150}),{status:"reachable",months:8,years:0,remainingMonths:8,projectedAssets:1200});
 assert.equal(calc({...base,annual_expenses:588,monthly_contribution:100}).months,147);
});
test("return plus contributions, and return without contributions",()=>{
 const result=calc({...base,total_assets:1000,monthly_contribution:100,expected_return:12});
 assert.equal(result.months,2);
 assert.ok(Math.abs(result.projectedAssets-1221.1)<1e-9);
 const growth=calc({...base,total_assets:1000,monthly_contribution:0,expected_return:12});
 assert.equal(growth.months,19);
 assert.ok(1000*1.01**18<1200);
});
test("zero growth and inclusive 100 year boundary",()=>{
 assert.equal(calc({...base,monthly_contribution:0}).status,"notReachable");
 assert.equal(calc(base).months,1200);
 assert.equal(calc({...base,annual_expenses:49}).status,"notReachable");
});
test("invalid input and safe integer boundaries",()=>{
 for(const field of ["total_assets","annual_expenses","monthly_contribution"]){
  for(const value of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,"1e3","","bad",null]){
   assert.equal(calc({...base,[field]:value}).status,"notReachable",field+":"+value);
  }
 }
 for(const expected_return of [-1,21,NaN,Infinity,"NaN","Infinity","",null])
  assert.equal(calc({...base,expected_return}).status,"notReachable");
 assert.equal(calc({...base,annual_expenses:0}).status,"notReachable");
 assert.equal(calc({...base,total_assets:Number.MAX_SAFE_INTEGER}).status,"alreadyAchieved");
 assert.equal(calc({...base,monthly_contribution:Number.MAX_SAFE_INTEGER}).projectedAssets,Number.MAX_SAFE_INTEGER);
 assert.equal(calc({...base,annual_expenses:Number.MAX_SAFE_INTEGER}).status,"notReachable");
 assert.equal(calc({...base,total_assets:1,monthly_contribution:Number.MAX_SAFE_INTEGER}).status,"notReachable");
 assert.equal(calc({...base,total_assets:"0",expected_return:"0.00",monthly_contribution:"150"}).months,8);
});
test("rounding near exact growth boundary does not postpone attainment; one yen short stays short",()=>{
 const r=calc({...base,total_assets:1000,annual_expenses:41,monthly_contribution:24,expected_return:1.2});
 assert.equal(r.months,1); // 1000 * 1.001 + 24 is slightly below 1025 in floating point.
 const target=1000000000000000;
 assert.equal(calc({...base,total_assets:target-1,annual_expenses:target/25,monthly_contribution:0}).status,"notReachable");
});
test("UI: years/months, achieved, unavailable, and no settings",()=>{
 const render=settings=>renderToStaticMarkup(React.createElement(View,{settings}));
 assert.equal(render(null),"");
 for(const [settings,text]of [
  [{...base,monthly_contribution:150},"あと 8か月"],
  [{...base,monthly_contribution:100},"あと 1年"],
  [{...base,annual_expenses:588,monthly_contribution:100},"あと 12年3か月"],
  [{...base,total_assets:1200},"FIRE目標を達成しています"],
  [{...base,monthly_contribution:0},"現在の条件では100年以内の達成見込みを算出できません"]
 ]){
  const html=render(settings);assert.ok(html.includes(text),text);
  assert.ok(html.includes("想定利回りと毎月の積立額が一定の場合のシミュレーションです"));
 }
});
