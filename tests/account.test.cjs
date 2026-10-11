const {test}=require("node:test");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),ts=require("typescript"),React=require("react");
const {renderToStaticMarkup}=require("react-dom/server");
function load(file,mocks){
 const module={exports:{}};
 const source=fs.readFileSync(path.join(__dirname,"..",file),"utf8");
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function("require","module","exports",code)(name=>{if(name in mocks)return mocks[name];if(name==="react/jsx-runtime")return require(name);throw Error(name)},module,module.exports);
 return module.exports;
}
const navigation={redirect:p=>{throw Error(`REDIRECT:${p}`)}};
function page(user,error){return load("app/account/page.tsx",{
 "next/navigation":navigation,
 "next/link":{default:({children,...props})=>React.createElement("a",props,children)},
 "@/lib/auth/user":{getAuthenticatedUser:async()=>{if(error)throw error;return user}},
 "./LogoutForm":{default:()=>React.createElement("button",null,"ログアウト")},
})}
test("account is dynamic and redirects unauthenticated visitors",async()=>{
 const p=page(null);assert.equal(p.dynamic,"force-dynamic");await assert.rejects(p.default(),{message:"REDIRECT:/login"});
});
test("authenticated account shows email, logout and internal navigation",async()=>{
 const html=renderToStaticMarkup(await page({id:"verified",email:"member@example.com"}).default({user_id:"attacker"}));
 for(const text of ["アカウント","member@example.com","ログアウト",'href="/my-plan"','href="/history"','href="/"'])assert.ok(html.includes(text));
 assert.ok(!html.includes("attacker"));
});
test("auth failure renders a generic error without protected details",async()=>{
 const html=renderToStaticMarkup(await page(null,Error("private token")).default());
 assert.ok(html.includes("認証を確認できませんでした"));assert.ok(!html.includes("private token"));assert.ok(!html.includes("ログアウト"));
});
function action(failure){
 const calls=[];
 return {calls,...load("app/account/actions.ts",{
 "next/navigation":navigation,
 "@/lib/supabase/server":{createClient:async options=>{
 calls.push(options);if(failure==="client")throw Error("private token");
 return {auth:{signOut:async options=>{calls.push(options);if(failure==="throw")throw Error("private token");return {error:failure?{message:"private token"}:null};}}};
 }},
 })};
}
test("logout signs out with writable cookies and redirects outside catch",async()=>{
 const a=action();await assert.rejects(a.logout(),{message:"REDIRECT:/"});
 assert.deepEqual(a.calls,[{writableCookies:true},{scope:"local"}]);
 const source=fs.readFileSync(path.join(__dirname,"../app/account/actions.ts"),"utf8");assert.ok(source.startsWith('"use server";'));
 assert.ok(!/export (async )?function GET/.test(source));
});
test("logout auth and client errors are generalized",async()=>{
 for(const error of ["returned","throw","client"])assert.deepEqual(await action(error).logout(),{status:"SERVER_ERROR"});
});
test("logout form uses action, pending disables button and raw error is not rendered",()=>{
 const action=()=>{};
 const Form=load("app/account/LogoutForm.tsx",{
 react:{useActionState:()=>[{status:"SERVER_ERROR",message:"private token"},action,true]},
 "./actions":{logout:action},
 }).default;
 const tree=Form();assert.equal(tree.props.action,action);assert.equal(tree.props["aria-busy"],true);
 const children=React.Children.toArray(tree.props.children);
 assert.equal(children[0].props.disabled,true);
 assert.ok(JSON.stringify(children).includes("ログアウトできませんでした"));assert.ok(!JSON.stringify(children).includes("private token"));
});
