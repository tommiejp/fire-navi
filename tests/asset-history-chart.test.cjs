const {test}=require("node:test");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),ts=require("typescript"),React=require("react");
function load(file,mocks={}){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function("require","module","exports",code)(n=>n==="react/jsx-runtime"?require(n):mocks[n],m,m.exports);return m.exports}
const helpers=load("lib/asset-history-chart.ts");
const {toAssetPoints:convert,formatAssetYen}=helpers;
const charts=Object.fromEntries(["CartesianGrid","Line","LineChart","ResponsiveContainer","Tooltip","XAxis","YAxis"].map(n=>[n,n]));
const Chart=load("app/history/AssetHistoryChart.tsx",{"recharts":charts,"@/lib/asset-history-chart":helpers}).default;
function nodes(n){return !n||typeof n!=="object"?[]:[n,...React.Children.toArray(n.props?.children).flatMap(nodes)]}
test("empty data produces no chart",()=>{assert.deepEqual(convert([]),[]);assert.equal(Chart({points:[]}),null)});
test("one zero-asset point has a visible dot and nondegenerate time domain",()=>{
 const points=convert([{recorded_at:"2026-10-13T00:00:00Z",total_assets:0}]);const tree=nodes(Chart({points}));
 const axis=tree.find(n=>n.type==="XAxis");assert.ok(axis.props.domain[0]<points[0].timestamp);assert.ok(axis.props.domain[1]>points[0].timestamp);
 assert.equal(tree.find(n=>n.type==="Line").props.dot.r,3);
});
test("multiple points sorted oldest first, latest 50, no mutation or owner fields",()=>{
 const rows=Array.from({length:60},(_,i)=>({recorded_at:new Date(Date.UTC(2026,0,i+1)).toISOString(),total_assets:String(i),user_id:"attacker"})).reverse();
 const before=JSON.stringify(rows);const points=convert(rows);assert.equal(points.length,50);assert.equal(points[0].assets,10);assert.equal(points[49].assets,59);assert.equal(JSON.stringify(rows),before);
 assert.deepEqual(Object.keys(points[0]),["timestamp","assets"]);assert.ok(!JSON.stringify(points).includes("attacker"));
 const tree=nodes(Chart({points}));assert.equal(tree.find(n=>n.type==="Line").props.type,"linear");assert.equal(tree.find(n=>n.type==="LineChart").props.data,points);
});
test("yen tooltip and invalid values",()=>{
 assert.equal(formatAssetYen(1234567),"1,234,567 円");
 const tree=nodes(Chart({points:[{timestamp:0,assets:1234567}]}));assert.deepEqual(tree.find(n=>n.type==="Tooltip").props.formatter(1234567),["1,234,567 円","総資産"]);
 assert.deepEqual(convert([{recorded_at:"bad",total_assets:1},{recorded_at:"2026-01-01",total_assets:"1e4"},{recorded_at:"2026-01-01",total_assets:9007199254740992}]),[]);
});
