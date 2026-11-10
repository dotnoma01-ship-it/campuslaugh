import { readFileSync } from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";
const built = readFileSync("dist/index.html", "utf8");
const t = '<script type="module" crossorigin>';
const i0 = built.indexOf(t); const i1 = built.indexOf("</script>", i0);
const code = built.slice(i0 + t.length, i1);
const html = built.slice(0, i0) + built.slice(i1 + 9);
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => console.log("ERR:", e.message.slice(0,200)));
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://localhost/", virtualConsole: vc,
  beforeParse(w){
    w.matchMedia = (q)=>({matches:/dark/.test(q),media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},onchange:null,dispatchEvent:()=>false});
    w.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} takeRecords(){return[]} };
    w.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
    w.scrollTo = ()=>{}; w.Element.prototype.scrollTo = ()=>{};
    w.Element.prototype.scrollIntoView = ()=>{};
    w.Element.prototype.animate = function(){
      const a={onfinish:null,oncancel:null,cancel(){},finish(){},play(){},pause(){},reverse(){},
        _h:{},addEventListener(t,f){(this._h[t]=this._h[t]||[]).push(f)},removeEventListener(){},
        finished:new Promise(r=>setTimeout(()=>{r(a); a.onfinish&&a.onfinish(); (a._h.finish||[]).forEach(f=>f())},120))};
      return a;};
    w.Element.prototype.getAnimations = ()=>[];
  }});
dom.window.eval(code);
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
await wait(2500);
const doc=dom.window.document;
const click=(label)=>{const el=[...doc.querySelectorAll("button")].find(b=>(b.textContent??"").trim()===label || (b.textContent??"").includes(label) || b.getAttribute("aria-label")===label); if(!el){console.log("  (no button for",label,")");return null;} el.dispatchEvent(new dom.window.MouseEvent("click",{bubbles:true,cancelable:true})); return (el.textContent||el.getAttribute("aria-label")).slice(0,30);};
const checks = {
  Explore: ["Trending across campuses","Students you should know","Campus gallery"],
  Notifications: ["Mark all read","Preferences"],
  Chats: ["Messages","Meme Council"],
  Profile: ["Followers","Edit profile","Laughs given"],
  Settings: ["Appearance","Notifications","Reset demo data"],
  Home: ["For You","My Campus","Live from 40 campuses"],
};
for (const [label, needles] of Object.entries(checks)) {
  click(label);
  await wait(1800);
  const body = doc.body.textContent || "";
  console.log(label.padEnd(14), dom.window.location.hash.padEnd(18), needles.map(n => `${body.includes(n) ? "OK" : "MISS"}:${n}`).join("  "));
}
/* chat thread + send a message */
click("Chats"); await wait(1600);
const row = [...doc.querySelectorAll("button")].find(b => (b.textContent||"").includes("Zainab Yusuf"));
console.log("row found:", !!row);
row?.dispatchEvent(new dom.window.MouseEvent("click",{bubbles:true,cancelable:true}));
await wait(1800);
const body = doc.body.textContent||"";
console.log("thread:", dom.window.location.hash, "| header:", body.includes("End-to-end demo"), "| bubbles:", body.includes("v2 wins"));
const ta = doc.querySelector('textarea[aria-label="Message"]');
console.log("composer textarea:", !!ta);
if (ta) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set;
  setter.call(ta, "Smoke test message 🍋");
  ta.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await wait(500);
  const send = [...doc.querySelectorAll('button[aria-label="Send message"]')][0];
  console.log("send button:", !!send);
  send?.dispatchEvent(new dom.window.MouseEvent("click",{bubbles:true,cancelable:true}));
  await wait(1200);
  console.log("message in thread:", (doc.body.textContent||"").includes("Smoke test message"));
}
process.exit(0);
