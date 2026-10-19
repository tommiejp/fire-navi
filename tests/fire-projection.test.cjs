const {test}=require("node:test");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),ts=require("typescript"),React=require("react");
function load(file,mocks={}){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function("require","module","exports",code)(n=>n==="react/jsx-runtime"?require(n):mocks[n],m,m.exports);return m.exports}

const forecast=load("lib/fire-forecast.ts");
const helpers=load("lib/fire-projection.ts",{"./fire-forecast":forecast});
const calc=helpers.calculateFireProjection;
const base={total_assets:100,annual_expenses:10000,monthly_contribution:10,expected_return:0};
test("current and yearly points, zero interest and target",()=>{
 const result=calc(base);
 assert.equal(result.target,250000);
 assert.deepEqual(result.points.slice(0,3),[{year:0,assets:100},{year:1,assets:220},{year:2,assets:340}]);
 assert.equal(result.points.length,31);
 assert.equal(result.points.at(-1).year,30);
});
test("monthly formula agrees with forecast; achievement year ends at December",()=>{
 const settings={total_assets:1000,annual_expenses:48,monthly_contribution:100,expected_return:12};
 const result=calc(settings);
 assert.equal(forecast.calculateFireForecast(settings).months,2);
 assert.equal(result.points.at(-1).year,1);
 let expected=1000;
 for(let i=0;i<12;i++)expected=expected*1.01+100;
 assert.equal(result.points[1].assets,expected);
});
test("no contributions, no growth, already achieved and 30-year cap",()=>{
 const growth=calc({...base,monthly_contribution:0,expected_return:12});
 assert.ok(Math.abs(growth.points[1].assets-100*1.01**12)<1e-9);
 assert.ok(calc({...base,monthly_contribution:0}).points.every(p=>p.assets===100));
 assert.deepEqual(calc({...base,total_assets:250000}).points,[{year:0,assets:250000}]);
 // Exact attainment in year 30, then attainment after year 30.
 for(const annual_expenses of [144,145]){
  const result=calc({...base,total_assets:0,annual_expenses});
  assert.equal(result.points.at(-1).year,30);
 }
});
test("invalid settings and overflow stop safely without mutating input",()=>{
 for(const patch of [{total_assets:-1},{total_assets:Infinity},{monthly_contribution:NaN},{annual_expenses:0},{expected_return:21},{total_assets:Number.MAX_SAFE_INTEGER+1},{annual_expenses:Number.MAX_SAFE_INTEGER},{monthly_contribution:"1e3"}])
  assert.equal(calc({...base,...patch}),null);
 assert.equal(calc(null),null);
 const settings=Object.freeze({...base,monthly_contribution:Number.MAX_SAFE_INTEGER});
 const result=calc(settings);
 assert.equal(result.truncated,true);
 assert.deepEqual(result.points,[{year:0,assets:100}]);
});
const charts=Object.fromEntries(["CartesianGrid","Line","LineChart","ResponsiveContainer","Tooltip","XAxis","YAxis","ReferenceLine"].map(n=>[n,n]));
const Chart=load("app/my-plan/ProjectionChart.tsx",{recharts:charts}).default;
function nodes(n){return !n||typeof n!=="object"?[]:[n,...React.Children.toArray(n.props?.children).flatMap(nodes)]}
test("chart: yen tooltip, target line, single point and no user ID",()=>{
 assert.equal(Chart({points:[],target:1}),null);
 const data=calc({...base,total_assets:250000});
 const tree=nodes(Chart(data));
 assert.deepEqual(tree.find(n=>n.type==="XAxis").props.domain,[-1,1]);
 assert.equal(tree.find(n=>n.type==="ReferenceLine").props.y,250000);
 assert.equal(tree.find(n=>n.type==="ReferenceLine").props.ifOverflow,"extendDomain");
 assert.deepEqual(tree.find(n=>n.type==="Tooltip").props.formatter(1234567),["1,234,567 円","予測資産"]);
 assert.equal(tree.find(n=>n.type==="Line").props.dot.r,3);
 assert.deepEqual(Object.keys(data.points[0]),["year","assets"]);
});
test("server wrapper hides unregistered and invalid settings",()=>{
 const View=load("app/my-plan/FireProjection.tsx",{"@/lib/fire-projection":helpers,"./ProjectionChart":{default:Chart}}).default;
 assert.equal(View({settings:null}),null);
 assert.equal(View({settings:{...base,annual_expenses:0}}),null);
 const data=nodes(View({settings:base})).find(n=>n.type===Chart).props;
 assert.equal(data.target,250000);
 assert.equal(data.points.length,31);
});
