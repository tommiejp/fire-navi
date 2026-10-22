const {test}=require("node:test");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),ts=require("typescript"),React=require("react");
function load(file,mocks={}){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function("require","module","exports",code)(n=>n==="react/jsx-runtime"?require(n):mocks[n],m,m.exports);return m.exports}

const forecast=load("lib/fire-forecast.ts");
const projection=load("lib/fire-projection.ts",{"./fire-forecast":forecast});
const helpers=load("lib/fire-scenarios.ts",{"./fire-forecast":forecast,"./fire-projection":projection});
const {evaluateScenario:calc,initialScenario,compareForecasts,scenarioNames}=helpers;
const settings={total_assets:10000000,annual_expenses:2400000,monthly_contribution:100000,expected_return:5};
const initial=initialScenario(settings);
test("three identical initial scenarios, increased saving and reduced expenses",()=>{
 assert.equal(scenarioNames.length,3);
 const base=calc(settings.total_assets,initial);
 assert.equal(compareForecasts(base.forecast,calc(settings.total_assets,{...initial}).forecast),"現状プランと同じ");
 const faster=calc(settings.total_assets,{...initial,monthly_contribution:"200000"});
 assert.ok(faster.forecast.months<base.forecast.months);
 assert.ok(compareForecasts(base.forecast,faster.forecast).endsWith("早い"));
 assert.ok(compareForecasts(faster.forecast,base.forecast).endsWith("遅い"));
 assert.equal(calc(settings.total_assets,{...initial,annual_expenses:"1200000"}).target,30000000);
 assert.ok(calc(settings.total_assets,{...initial,expected_return:"7"}).forecast.months<base.forecast.months);
});
test("already achieved, unreachable and actual 30 year value after attainment",()=>{
 const achieved=calc(60000000,{...initial,expected_return:"0"});
 assert.equal(helpers.forecastText(achieved.forecast),"達成済み");
 assert.equal(achieved.assetsAt30,96000000);
 const unreachable=calc(0,{...initial,expected_return:"0",monthly_contribution:"0"});
 assert.equal(unreachable.assetsAt30,0);
 assert.equal(compareForecasts(achieved.forecast,unreachable.forecast),"比較不能");
 assert.ok(helpers.forecastText(unreachable.forecast).includes("算出不能"));
 assert.equal(helpers.duration(147),"12年3か月");
 assert.equal(helpers.duration(8),"8か月");
 assert.equal(helpers.duration(12),"1年");
});
test("invalid input isolated; overflow yields unavailable assets",()=>{
 for(const field of ["annual_expenses","monthly_contribution","expected_return"])
  for(const value of ["","-1","1e3","NaN","Infinity","abc"])
   assert.equal(calc(100,{...initial,[field]:value}),null);
 for(const field of ["annual_expenses","monthly_contribution"])
  for(const value of ["1.2","9007199254740992"])assert.equal(calc(100,{...initial,[field]:value}),null);
 assert.equal(calc(100,{...initial,annual_expenses:"0"}),null);
 assert.equal(calc(100,{...initial,expected_return:"20.1"}),null);
 assert.equal(calc(100,{...initial,monthly_contribution:String(Number.MAX_SAFE_INTEGER)}).assetsAt30,null);
 assert.ok(calc(100,initial));
});
function nodes(n){return !n||typeof n!=="object"?[]:[n,...React.Children.toArray(n.props?.children).flatMap(nodes)]}
test("responsive comparison, labels, read-only base, edits only one scenario",()=>{
 let state;
 const ChartStub=()=>null;
 const View=load("app/my-plan/ScenarioComparison.tsx",{
  "./ScenarioChart":{default:ChartStub},
  "@/lib/fire-scenarios":helpers,
  react:{useState:init=>{state??=init();return [state,fn=>{state=fn(state)}]}}
 }).default;
 let tree=nodes(View({settings}));
 assert.ok(tree.some(n=>n.props.className?.includes("grid-cols-1")&&n.props.className.includes("lg:grid-cols-3")));
 const inputs=tree.filter(n=>n.type==="input");
 assert.equal(tree.find(n=>n.type===ChartStub).props.results.filter(Boolean).length,3);
 assert.equal(inputs.length,9);assert.equal(inputs.filter(n=>n.props.readOnly).length,3);
 assert.deepEqual(state,[initial,initial,initial]);
 inputs[3].props.onChange({target:{value:""}});
 assert.equal(state[1].annual_expenses,"");
 assert.deepEqual(state[0],initial);assert.deepEqual(state[2],initial);
 tree=nodes(View({settings}));
 assert.equal(tree.filter(n=>n.type==="p"&&n.props.children==="入力内容を確認してください").length,1);
 assert.equal(tree.filter(n=>n.type==="dl").length,2);
 const results=tree.find(n=>n.type===ChartStub).props.results;
 assert.equal(results[1],null);
 assert.ok(results[0].projection);assert.ok(results[2].projection);
 assert.equal(tree.filter(n=>n.type==="label").length,9);
});

test("derived target safe-integer boundary rejects even safe annual expenses",()=>{
 // Integer annual expenses yield targets in steps of 25 yen.
 const largestSafeExpense = Math.floor(Number.MAX_SAFE_INTEGER / 25);
 const inputs = {...initial, monthly_contribution:"0", expected_return:"0"};
 for(const expense of [largestSafeExpense-1, largestSafeExpense]){
  const result=calc(0,{...inputs,annual_expenses:String(expense)});
  assert.ok(result);
  assert.equal(result.target,expense/0.04);
  assert.ok(Number.isFinite(result.target));
  assert.ok(result.target<=Number.MAX_SAFE_INTEGER);
  assert.equal(result.forecast.status,"notReachable");
  assert.equal(result.assetsAt30,0);
 }
 for(const expense of [largestSafeExpense+1,Number.MAX_SAFE_INTEGER]){
  assert.ok(Number.isSafeInteger(expense));
  assert.ok(expense/0.04>Number.MAX_SAFE_INTEGER);
  assert.equal(calc(0,{...inputs,annual_expenses:String(expense)}),null);
 }
});

const chartMocks=Object.fromEntries(["CartesianGrid","Line","LineChart","ResponsiveContainer","Tooltip","XAxis","YAxis"].map(name=>[name,name]));
const Chart=load("app/my-plan/ScenarioChart.tsx",{recharts:chartMocks,"@/lib/fire-scenarios":helpers}).default;
test("three series share current assets, equal inputs, and 30-year endpoint",()=>{
 const results=scenarioNames.map(()=>calc(settings.total_assets,initial));
 const tree=nodes(Chart({results}));
 assert.equal(tree.filter(n=>n.type==="Line").length,3);
 const data=tree.find(n=>n.type==="LineChart").props.data;
 assert.equal(data.length,31);
 assert.deepEqual(data[0],{year:0,plan0:10000000,plan1:10000000,plan2:10000000});
 assert.equal(data[30].year,30);
 for(const point of data){assert.equal(point.plan0,point.plan1);assert.equal(point.plan1,point.plan2)}
 assert.equal(data[30].plan0,results[0].assetsAt30);
 assert.equal(tree.filter(n=>n.type==="li").length,3);
});
test("contributions and return alter series; spending alters target only",()=>{
 const base=calc(settings.total_assets,initial);
 const saving=calc(settings.total_assets,{...initial,monthly_contribution:"200000"});
 const spending=calc(settings.total_assets,{...initial,annual_expenses:"1200000"});
 const interest=calc(settings.total_assets,{...initial,expected_return:"7"});
 assert.ok(saving.projection.points[30].assets>base.projection.points[30].assets);
 assert.ok(interest.projection.points[30].assets>base.projection.points[30].assets);
 assert.deepEqual(spending.projection.points,base.projection.points);
 assert.notEqual(spending.target,base.target);
});
test("only invalid series omitted; unsafe future remains a gap; yen formatting",()=>{
 const base=calc(settings.total_assets,initial);
 for(const patch of [{expected_return:"NaN"},{expected_return:"Infinity"},{monthly_contribution:"9007199254740992"},{annual_expenses:String(Number.MAX_SAFE_INTEGER)}]){
  const tree=nodes(Chart({results:[base,calc(settings.total_assets,{...initial,...patch}),base]}));
  assert.deepEqual(tree.filter(n=>n.type==="Line").map(n=>n.props.dataKey),["plan0","plan2"]);
 }
 const unsafe=calc(settings.total_assets,{...initial,monthly_contribution:String(Number.MAX_SAFE_INTEGER)});
 const tree=nodes(Chart({results:[base,unsafe,base]}));
 const data=tree.find(n=>n.type==="LineChart").props.data;
 assert.equal(data[0].plan1,settings.total_assets);
 assert.equal(data[1].plan1,null);
 assert.ok(Number.isFinite(data[30].plan0));
 assert.ok(tree.filter(n=>n.type==="Line").every(n=>n.props.connectNulls===false));
 assert.deepEqual(tree.find(n=>n.type==="Tooltip").props.formatter(1234567,"現状プラン"),["1,234,567 円","現状プラン"]);
 assert.equal(Chart({results:[null,null,null]}),null);
});
