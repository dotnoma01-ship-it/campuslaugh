import { readFileSync } from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";
const built = readFileSync("dist/index.html", "utf8");
const t = '<script type="module" crossorigin>';
const i0 = built.indexOf(t), i1 = built.indexOf("</script>", i0);
const code = built.slice(i0 + t.length, i1);
const html = built.slice(0, i0) + built.slice(i1 + 9);
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push(e.message.slice(0, 220)));
vc.on("error", (...a) => errors.push("console.error " + a.join(" ").slice(0, 220)));
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://localhost/", virtualConsole: vc,
  beforeParse(w){
    w.matchMedia = (q)=>({matches:/dark/.test(q),media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},onchange:null,dispatchEvent:()=>false});
    w.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} takeRecords(){return[]} };
    w.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
    w.scrollTo=()=>{}; w.Element.prototype.scrollTo=()=>{}; w.Element.prototype.scrollIntoView=()=>{};
    w.Element.prototype.animate=function(){const a={onfinish:null,oncancel:null,cancel(){},finish(){},play(){},pause(){},reverse(){},_h:{},addEventListener(t,f){(this._h[t]=this._h[t]||[]).push(f)},removeEventListener(){},finished:new Promise(r=>setTimeout(()=>{r(a);a.onfinish&&a.onfinish();(a._h.finish||[]).forEach(f=>f())},120))};return a;};
    w.Element.prototype.getAnimations=()=>[];
    Object.defineProperty(w.navigator,"clipboard",{value:{writeText:()=>Promise.resolve()},configurable:true});
    Object.defineProperty(w.navigator,"vibrate",{value:()=>true,configurable:true});
  }});
dom.window.eval(code);
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
await wait(2600);
const doc=dom.window.document, W=dom.window;
const body=()=>doc.body.textContent||"";
const click=(label)=>{const el=[...doc.querySelectorAll("button")].find(b=>(b.textContent??"").trim()===label||(b.getAttribute("aria-label")===label)||(b.textContent??"").includes(label)); if(!el) return false; el.dispatchEvent(new W.MouseEvent("click",{bubbles:true,cancelable:true})); return true;};
const setVal=(el,v)=>{const proto=el.tagName==="TEXTAREA"?W.HTMLTextAreaElement.prototype:W.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,"value").set.call(el,v); el.dispatchEvent(new W.Event("input",{bubbles:true}));};

/* 1. theme switching */
click("Settings"); await wait(1500);
click("Appearance"); await wait(700);
console.log("appearance section:", body().includes("Accent"));
const lightBtn=[...doc.querySelectorAll('button[aria-label="Light theme"]')][0];
lightBtn?.dispatchEvent(new W.MouseEvent("click",{bubbles:true,cancelable:true}));
await wait(600);
console.log("light mode applied:", !doc.documentElement.classList.contains("dark"), "| theme-color:", doc.querySelector('meta[name="theme-color"]')?.content);

/* 2. notifications test */
click("Notifications"); await wait(1200);
click("Notification preferences") || click("Preferences"); await wait(1400);
console.log("settings->notifications tab:", body().includes("Demo activity stream"));
console.log("test notif row:", click("Test a notification"));
await wait(700);
console.log("action sheet shown:", body().includes("Send a test notification"));
click("Campus announcement"); await wait(900);
console.log("banner fired:", body().includes("UNILAG · Comedy Night"), "| toast:", body().includes("Test notification fired"));

/* 3. publish a post */
click("Home"); await wait(1600);
click("Create post"); await wait(1200);
const ta=[...doc.querySelectorAll('textarea[aria-label="Post text"]')][0];
console.log("composer open:", !!ta);
setVal(ta, "Testing the composer from jsdom #CampusLaugh");
await wait(400);
const anonBtn=[...doc.querySelectorAll("button")].find(b=>(b.textContent??"").trim()==="Anon");
anonBtn?.dispatchEvent(new W.MouseEvent("click",{bubbles:true,cancelable:true}));
await wait(400);
console.log("anon toggled:", body().includes("Posting anonymously"), "| badge:", body().includes("Anonymous"));
const demo=[...doc.querySelectorAll('button[aria-label="Add demo media"]')][0];
demo?.dispatchEvent(new W.MouseEvent("click",{bubbles:true,cancelable:true}));
await wait(400);
console.log("demo media panel:", body().includes("Demo media"));
const sample=doc.querySelector('button[aria-label]'); 
[...doc.querySelectorAll("img[alt='Students grouping on campus']")][0]?.parentElement?.dispatchEvent(new W.MouseEvent("click",{bubbles:true,cancelable:true}));
await wait(400);
console.log("media attached:", !!doc.querySelector('button[aria-label="Remove media"]'));
click("Publish"); await wait(2200);
console.log("published toast:", body().includes("Post published"), "| in feed:", body().includes("Testing the composer from jsdom"));

/* 4. comment */
const cBtn=[...doc.querySelectorAll('button[aria-label^="Comments"]')][0];
cBtn?.dispatchEvent(new W.MouseEvent("click",{bubbles:true,cancelable:true}));
await wait(900);
const cInput=[...doc.querySelectorAll('input[aria-label="Write a comment"]')][0];
console.log("comments sheet:", !!cInput);
if(cInput){ setVal(cInput,"First comment from the smoke test"); await wait(300); click("Send comment"); await wait(800);
  console.log("comment added:", body().includes("First comment from the smoke test")); }
click("Close sheet"); await wait(600);

/* 5. bookmark */
const bm=[...doc.querySelectorAll('button[aria-label="Bookmark post"]')][0];
bm?.dispatchEvent(new W.MouseEvent("click",{bubbles:true,cancelable:true}));
await wait(600);
console.log("bookmark toast:", body().includes("Saved to bookmarks"));
click("Bookmarks"); await wait(1600);
console.log("bookmarks page:", body().includes("Bookmarks"), "| saved post listed:", body().includes("saved posts"));

/* 6. explore search */
click("Explore"); await wait(1600);
const search=[...doc.querySelectorAll('input[aria-label="Search CampusLaugh"]')][0];
console.log("search input:", !!search);
if(search){ setVal(search,"hostel"); await wait(500);
  console.log("suggestions/results:", body().includes("results for")); }

console.log("ERRORS:", errors.length);
errors.slice(0,10).forEach(e=>console.log("  !",e));
process.exit(0);
