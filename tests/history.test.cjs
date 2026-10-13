const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), ts = require("typescript"), React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
function setup({user={id:"verified"},data=[],error=null,failAt=null}={}) {
  const calls=[];
  const mocks={
    "./AssetHistoryChart":{default:()=>null},
    "@/lib/asset-history-chart":{toAssetPoints:()=>[]},
    "next/link":{default:({children,...props})=>React.createElement("a",props,children)},
    "next/navigation":{redirect:target=>{throw Error(`REDIRECT:${target}`)}},
    "@/lib/auth/user":{getAuthenticatedUser:async()=>{calls.push("auth");if(failAt==="auth")throw Error("private detail");return user;}},
    "@/lib/supabase/server":{createClient:async(...args)=>{
      calls.push(["client",...args]);if(failAt==="client")throw Error("private detail");
      return {from:table=>{calls.push(["from",table]);return {select:columns=>{calls.push(["select",columns]);return {order:async(...args)=>{
        calls.push(["order",...args]);if(failAt==="query")throw Error("private detail");return {data,error};
      }}}}}};
    }},
  };
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,"../app/history/page.tsx"),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};
  new Function("require","module","exports",code)(name=>{if(name in mocks)return mocks[name];if(name==="react/jsx-runtime")return require(name);throw Error(name)},module,module.exports);
  return {page:module.exports.default,dynamic:module.exports.dynamic,calls};
}
test("unauthenticated redirects before querying; dynamic per request",async()=>{
  const s=setup({user:null});assert.equal(s.dynamic,"force-dynamic");await assert.rejects(s.page(),{message:"REDIRECT:/login"});assert.deepEqual(s.calls,["auth"]);
});
test("minimal SELECT ordered DESC with no owner filter; supplied IDs ignored",async()=>{
  const s=setup({data:[{id:"new",total_assets:1234567,recorded_at:"2026-10-11T00:00:00Z"},{id:"old",total_assets:0,recorded_at:"2026-10-10T00:00:00Z"}]});
  const html=renderToStaticMarkup(await s.page({user_id:"attacker",searchParams:{user_id:"attacker"}}));
  assert.deepEqual(s.calls,["auth",["client"],["from","asset_history"],["select","id, total_assets, recorded_at"],["order","recorded_at",{ascending:false}]]);
  for(const text of ["資産履歴","1,234,567 円","0 円","2026/10/11 09:00:00",'href="/my-plan"','href="/"','dateTime="2026-10-11T00:00:00Z"'])assert.ok(html.includes(text),text);
  assert.ok(html.indexOf("2026/10/11")<html.indexOf("2026/10/10"));assert.ok(!html.includes("attacker"));
});
test("empty history displays empty state",async()=>{
  assert.ok(renderToStaticMarkup(await setup().page()).includes("まだ資産履歴はありません"));
});
test("DB/client failures are generic and not mistaken for empty history",async()=>{
  for(const opts of [{error:{message:"private detail"},data:[{id:"secret"}]},{failAt:"client"},{failAt:"query"}]){
    const html=renderToStaticMarkup(await setup(opts).page());assert.ok(html.includes("資産履歴を取得できませんでした"));assert.ok(!html.includes("private detail"));assert.ok(!html.includes("まだ資産履歴はありません"));
  }
});
test("auth infrastructure failure shows no data and skips DB",async()=>{
  const s=setup({failAt:"auth"});const html=renderToStaticMarkup(await s.page());assert.ok(html.includes("認証を確認できませんでした"));assert.ok(!html.includes("private detail"));assert.deepEqual(s.calls,["auth"]);
});
