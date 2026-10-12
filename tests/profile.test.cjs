const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),ts=require("typescript"),React=require("react");
function load(file,mocks,browser={}) {
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function("require","module","exports","FormData",code)(n=>{if(n in mocks)return mocks[n];if(n==="react/jsx-runtime"||n==="react")return require(n);throw Error(n)},module,module.exports,browser.FormData||FormData);
 return module.exports;
}

function setup({user={id:"verified"},error=null,missing=false}={}){
 const calls=[];
 const api=load("app/account/actions.ts",{
 "@/lib/rate-limit":{checkRateLimit:async()=>"ALLOWED"},
 "next/navigation":{redirect:()=>{}},"next/cache":{revalidatePath:p=>calls.push(p)},
 "@/lib/auth/user":{getAuthenticatedUser:async()=>user},
 "@/lib/supabase/server":{createClient:async options=>{assert.deepEqual(options,{writableCookies:true});return {from:table=>{calls.push(table);return {update:payload=>{calls.push(payload);return {eq:(...args)=>{calls.push(args);return {select:columns=>{calls.push(columns);return {maybeSingle:async()=>({data:missing?null:{display_name:"ok"},error})}}}}}}}}}}},
 });
 return {calls,save:async name=>{const form=new FormData();if(name!==null)form.set("display_name",name);form.set("user_id","attacker");form.set("created_at","injected");return api.updateProfile(form)}};
}
test("unauthenticated update rejected",async()=>{const s=setup({user:null});assert.deepEqual(await s.save("name"),{status:"UNAUTHORIZED"});assert.equal(s.calls.length,0)});
test("update trims and changes only display_name for verified ID",async()=>{
 const s=setup();assert.deepEqual(await s.save("  名前  "),{status:"SUCCESS"});assert.deepEqual(s.calls,["profiles",{display_name:"名前"},["user_id","verified"],"display_name","/account"]);
});
test("50 code points and empty name accepted; 51 and nonstring rejected",async()=>{
 for(const value of ["a".repeat(50),"😀".repeat(50),"", "   "])assert.equal((await setup().save(value)).status,"SUCCESS");
 for(const value of ["a".repeat(51),"😀".repeat(51),null,new Blob(["name"])]){const s=setup();assert.equal((await s.save(value)).status,"VALIDATION_ERROR");assert.equal(s.calls.length,0)}
});
test("DB error and missing row never report success",async()=>{
 for(const options of [{error:{message:"private detail"}},{missing:true}])assert.deepEqual(await setup(options).save("name"),{status:"SERVER_ERROR"});
});
function nodes(n){return !n||typeof n!=="object"?[]:[n,...React.Children.toArray(n.props?.children).flatMap(nodes)]}
test("profile form initial value, no email/owner input, duplicate prevention",async()=>{
 let resolve,calls=0;const states=[];
 const Form=load("app/account/ProfileForm.tsx",{
 react:{useState:v=>[v,x=>states.push(x)],useRef:v=>({current:v})},
 "./actions":{updateProfile:async()=>{calls++;return new Promise(r=>resolve=r)}}
 },{FormData:class{}}).default;
 const tree=nodes(Form({initialName:"名前"}));assert.deepEqual(tree.filter(n=>n.type==="input").map(n=>[n.props.name,n.props.defaultValue]),[["display_name","名前"]]);
 const submit=tree.find(n=>n.type==="form").props.onSubmit,event={preventDefault(){},currentTarget:{}};
 const first=submit(event);await submit(event);assert.equal(calls,1);resolve({status:"SUCCESS"});await first;assert.ok(states.includes("SUCCESS"));assert.ok(states.includes(false));
});
test("account reads only profile columns via RLS, ignores props, and keeps logout on missing/error",async()=>{
 const {renderToStaticMarkup}=require("react-dom/server");
 for(const result of [{data:{display_name:"本人の名前",created_at:"2026-01-01"},error:null},{data:null,error:null},{data:null,error:{message:"private detail"}}]){
 const calls=[];
 const Page=load("app/account/page.tsx",{
 "next/navigation":{redirect:()=>{throw Error("unexpected")}},
 "next/link":{default:({children,...props})=>React.createElement("a",props,children)},
 "@/lib/auth/user":{getAuthenticatedUser:async()=>({id:"verified",email:"a@example.com"})},
 "@/lib/supabase/server":{createClient:async()=>({from:table=>{calls.push(table);return {select:columns=>{calls.push(columns);return {maybeSingle:async()=>result}}}}})},
 "./ProfileForm":{default:({initialName})=>React.createElement("span",null,initialName)},
 "./LogoutForm":{default:()=>React.createElement("button",null,"ログアウト")},
 }).default;
 const html=renderToStaticMarkup(await Page({user_id:"attacker",searchParams:{user_id:"attacker"}}));
 assert.deepEqual(calls,["profiles","display_name, created_at"]);assert.ok(html.includes("ログアウト"));assert.ok(!html.includes("attacker"));assert.ok(!html.includes("private detail"));
 assert.ok(html.includes(result.error?"プロフィールを取得できませんでした":result.data?"本人の名前":"プロフィールはまだありません"));
 }
});
