const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),ts=require("typescript"),React=require("react");
const {renderToStaticMarkup}=require("react-dom/server");
const source=fs.readFileSync(require("node:path").join(__dirname,"../app/my-plan/loading.tsx"),"utf8");
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const m={exports:{}};
new Function("require","module","exports",code)(name=>{
 if(name==="react/jsx-runtime")return require(name);
 if(name==="next/link")return {default:({children,...props})=>React.createElement("a",props,children)};
 throw Error("Unexpected import: "+name);
},m,m.exports);
const html=()=>renderToStaticMarkup(React.createElement(m.exports.default));
test("loading announces status once and retains an escape link",()=>{
 const markup=html();
 assert.equal((markup.match(/role="status"/g)||[]).length,1);
 assert.ok(markup.includes("マイプランを読み込んでいます"));
 assert.ok(markup.includes('href="/"'));
 assert.ok(!markup.includes("<input"));
 assert.ok(!markup.includes("ログイン済み"));
});
test("generic skeleton matches sections, wraps within container and respects reduced motion",()=>{
 const markup=html();
 let position=-1;
 for(const title of ["FIREの現在地","FIRE設定","将来予測","シナリオ比較","資産記録"]){
  assert.ok(markup.indexOf(title)>position);position=markup.indexOf(title);
 }
 for(const text of ['aria-hidden="true"',"max-w-2xl","px-4","min-w-0","w-full","sm:p-6","motion-safe:animate-pulse"])
  assert.ok(markup.includes(text));
 assert.ok(!source.includes("supabase"));
 assert.ok(!source.includes("use client"));
});
