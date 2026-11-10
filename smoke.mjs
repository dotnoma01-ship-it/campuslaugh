/* Frontend smoke test: boots the built bundle in jsdom and reports errors. */
import { readFileSync } from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";

const built = readFileSync("dist/index.html", "utf8");

/* jsdom cannot execute type="module" scripts, and a classic script left in
   <head> would run before #root exists — so relocate the single inlined bundle. */
const openTag = '<script type="module" crossorigin>';
const i0 = built.indexOf(openTag);
const i1 = built.indexOf("</script>", i0);
const code = built.slice(i0 + openTag.length, i1);
const html = built.slice(0, i0) + built.slice(i1 + "</script>".length);

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push(`jsdomError: ${e.message}`));
vc.on("error", (...a) => errors.push(`console.error: ${a.join(" ")}`));

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "https://localhost/",
  virtualConsole: vc,
  beforeParse(window) {
    window.matchMedia = (q) => ({
      matches: /prefers-color-scheme: dark/.test(q),
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      onchange: null,
      dispatchEvent: () => false,
    });
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    };
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.scrollTo = () => {};
    window.Element.prototype.scrollTo = () => {};
    window.Element.prototype.scrollIntoView = () => {};
    window.Element.prototype.requestFullscreen = () => Promise.resolve();
    window.Element.prototype.animate = function () {
      return { cancel() {}, finish() {}, play() {}, pause() {}, addEventListener() {}, removeEventListener() {}, finished: Promise.resolve() };
    };
    window.Element.prototype.getAnimations = () => [];
    Object.defineProperty(window.navigator, "vibrate", { value: () => true, configurable: true });
    Object.defineProperty(window.navigator, "clipboard", { value: { writeText: () => Promise.resolve() }, configurable: true });
    window.localStorage.clear();
  },
});

try {
  dom.window.eval(code);
} catch (e) {
  errors.push(`eval: ${e.message}`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(3500);

const doc = dom.window.document;
const txt = () => doc.body.textContent ?? "";
const has = (s) => txt().includes(s);

console.log("root children:", doc.querySelector("#root")?.children.length ?? 0);
console.log("buttons:", doc.querySelectorAll("button").length);
console.log("boot:", has("CampusLaugh"), "| tabs:", has("For You") && has("Following") && has("My Campus"));
console.log("ambient/island host present:", !!doc.body.querySelector("[aria-label], .glass-bar"));
console.log("theme class:", JSON.stringify(doc.documentElement.className));

const click = (label) => {
  const el = [...doc.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").trim().includes(label) || b.getAttribute("aria-label") === label,
  );
  if (!el) return false;
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
  return true;
};

const steps = [
  ["Explore", () => has("Trending across campuses")],
  ["Notifications", () => has("Mark all read")],
  ["Chats", () => has("Messages")],
  ["Profile", () => has("Followers")],
  ["Settings", () => has("Appearance")],
  ["Home", () => has("For You")],
];

for (const [label, check] of steps) {
  const ok = click(label);
  await wait(1400);
  console.log(`nav ${label}: clicked=${ok} rendered=${check()}`);
}

/* exercise a like + a comment sheet + the composer */
const likeBtn = [...doc.querySelectorAll('button[aria-label="Like post"]')][0];
if (likeBtn) {
  likeBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await wait(500);
  console.log("like toggled:", likeBtn.getAttribute("aria-pressed"));
}
const commentBtn = [...doc.querySelectorAll('button[aria-label^="Comments"]')][0];
if (commentBtn) {
  commentBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await wait(900);
  console.log("comments sheet:", has("Comments"));
  click("Close sheet");
  await wait(500);
}
const createBtn = [...doc.querySelectorAll('button[aria-label="Create post"]')][0];
if (createBtn) {
  createBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await wait(1400);
  console.log("composer open:", has("New post"), "| counter ring present:", !!doc.querySelector("svg circle"));
  click("Close");
  await wait(600);
}

/* open a chat thread */
click("Chats");
await wait(1200);
const firstRow = [...doc.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes("Zainab Yusuf"));
if (firstRow) {
  firstRow.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await wait(1500);
  console.log("thread open:", has("typing") || has("End-to-end demo") || txt().includes("Online"));
  const input = [...doc.querySelectorAll('textarea[aria-label="Message"]')][0];
  if (input) {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(input, "Hello from the smoke test 🍋");
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await wait(400);
    const send = [...doc.querySelectorAll('button[aria-label="Send message"]')][0];
    send?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await wait(900);
    console.log("message sent:", has("Hello from the smoke test"));
  } else {
    console.log("composer input not found");
  }
} else {
  console.log("conversation row not found");
}

console.log("FINAL ERRORS:", errors.length);
errors.slice(0, 20).forEach((e) => console.log("  !", e.slice(0, 400)));
dom.window.close();
process.exit(0);
