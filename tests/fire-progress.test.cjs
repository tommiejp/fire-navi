const {test}=require("node:test");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),ts=require("typescript"),React=require("react");
const {renderToStaticMarkup}=require("react-dom/server");
function load(file,mocks={}) {
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function("require","module","exports",code)(n=>{if(n in mocks)return mocks[n];if(n==="react/jsx-runtime")return require(n);throw Error(n)},module,module.exports);
 return module.exports;
}
const helpers=load("lib/fire-progress.ts");
const {calculateFireProgress:calc}=helpers;
const View=load("app/my-plan/FireProgress.tsx",{"@/lib/fire-progress":helpers}).default;
const settings={total_assets:15000000,annual_expenses:2400000};
test("target, percentage and remaining follow 4% rule",()=>{
 assert.deepEqual(calc(settings),{target:60000000,percentage:25,remaining:45000000,barPercentage:25});
 assert.deepEqual(calc({total_assets:"15000000",annual_expenses:"2400000"}),calc(settings));
});
test("zero assets and exact/exceeded target",()=>{
 assert.deepEqual(calc({...settings,total_assets:0}),{target:60000000,percentage:0,remaining:60000000,barPercentage:0});
 for(const [assets,percentage]of [[60000000,100],[90000000,150]])assert.deepEqual(calc({...settings,total_assets:assets}),{target:60000000,percentage,remaining:0,barPercentage:100});
});
test("unregistered and invalid settings have no progress UI",()=>{
 for(const value of [null,{...settings,annual_expenses:0},{...settings,total_assets:-1},{...settings,total_assets:"1e6"}]){
 assert.equal(calc(value),null);assert.equal(renderToStaticMarkup(React.createElement(View,{settings:value})),"");
 }
});
test("yen formatting and actual percentage with capped accessible bar",()=>{
 const html=renderToStaticMarkup(React.createElement(View,{settings:{...settings,total_assets:90000000}}));
 for(const text of ["60,000,000","0 円","150%",'max="100"','value="100"','aria-labelledby="fire-progress-label"'])assert.ok(html.includes(text),text);
});
