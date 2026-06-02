// Functional verification of the AccessibilityWidget against the running demo.
// Uses the globally-installed Playwright + Chromium (not a project dependency).
// Requires Playwright + Chromium:  npm i -D playwright && npx playwright install chromium
import pkg from "playwright";
const { chromium } = pkg;

const BASE = "http://localhost:3210/";
const results = [];
const ok = (name, cond, extra = "") =>
  results.push({ name, pass: !!cond, extra });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
await page.goto(BASE, { waitUntil: "networkidle" });

const trigger = page.locator(".a11y-trigger");
await trigger.waitFor({ state: "visible" });

// 1. Trigger ARIA before open
ok("trigger is a <button>", (await trigger.evaluate((e) => e.tagName)) === "BUTTON");
ok("trigger has aria-label", !!(await trigger.getAttribute("aria-label")));
ok("aria-expanded=false initially", (await trigger.getAttribute("aria-expanded")) === "false");
const controlsId = await trigger.getAttribute("aria-controls");
ok("trigger has aria-controls", !!controlsId);

// 2. Open → focus moves into dialog
await trigger.click();
const dialog = page.locator('[role="dialog"]');
await dialog.waitFor({ state: "visible" });
ok("aria-expanded=true after open", (await trigger.getAttribute("aria-expanded")) === "true");
ok("dialog aria-modal", (await dialog.getAttribute("aria-modal")) === "true");
ok("dialog has accessible name (aria-labelledby)", !!(await dialog.getAttribute("aria-labelledby")));
ok("dialog id matches aria-controls", (await dialog.getAttribute("id")) === controlsId);
const focusInDialog = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  return d && d.contains(document.activeElement);
});
ok("focus moved into dialog on open", focusInDialog);

// 3. Font size control → CSS var + computed root font-size
// Steppers in DOM order: 0 = decrease, 1 = reset, 2 = increase.
const decBtn = page.locator(".a11y-step").nth(0);
const incBtn = page.locator(".a11y-step").nth(2);
const rootFontBefore = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
await incBtn.click();
await incBtn.click();
const scaleVar = await page.evaluate(() => document.documentElement.style.getPropertyValue("--a11y-font-scale"));
const rootFontAfter = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
ok("--a11y-font-scale set after A+ x2", scaleVar === "1.2", `var=${scaleVar}`);
ok("root font-size grew", parseFloat(rootFontAfter) > parseFloat(rootFontBefore), `${rootFontBefore} -> ${rootFontAfter}`);
const statusText = await page.locator(".a11y-font-status").innerText();
ok("font status shows 120%", /120%/.test(statusText), statusText);

// Decrease + clamp check: click decrease until it disables, confirm floor is 80%
for (let i = 0; i < 12 && (await decBtn.isEnabled()); i++) await decBtn.click();
const clampedStatus = await page.locator(".a11y-font-status").innerText();
ok("font clamps at 80% minimum", /80%/.test(clampedStatus), clampedStatus);
ok("decrease button disables at floor", !(await decBtn.isEnabled()));

// reset font via the ↺ button
await page.locator(".a11y-step-reset").click();
ok("font reset removes var", (await page.evaluate(() => document.documentElement.style.getPropertyValue("--a11y-font-scale"))) === "");

// 4. Toggles → classes on <html> + aria-pressed
const toggleChecks = [
  ["High contrast", "a11y-high-contrast"],
  ["Readable font", "a11y-readable-font"],
  ["Highlight links", "a11y-highlight-links"],
  ["Stop animations", "a11y-stop-animations"],
];
// switch widget to English first so labels match
// (do it via the demo's own language button)
await page.keyboard.press("Escape");
await page.locator(".demo-btn").click(); // he -> en
await trigger.click();
await dialog.waitFor({ state: "visible" });
for (const [label, cls] of toggleChecks) {
  const btn = page.locator(".a11y-toggle", { hasText: label });
  await btn.click();
  const hasClass = await page.evaluate((c) => document.documentElement.classList.contains(c), cls);
  const pressed = (await btn.getAttribute("aria-pressed")) === "true";
  ok(`toggle "${label}" adds .${cls}`, hasClass);
  ok(`toggle "${label}" reflects aria-pressed`, pressed);
}

// 5. Persistence
const stored = await page.evaluate(() => localStorage.getItem("a11y-widget:v1"));
ok("localStorage key written", !!stored && /highContrast/.test(stored), stored || "");

// high-contrast must NOT break the fixed trigger: it should stay in viewport
const triggerFixed = await page.evaluate(() => {
  const r = document.querySelector(".a11y-trigger").getBoundingClientRect();
  return r.bottom <= window.innerHeight + 1 && r.top >= -1;
});
ok("trigger stays pinned in viewport under high-contrast", triggerFixed);

// screenshot with panel open (English, several toggles on)
await page.screenshot({ path: "scripts/widget-en-open.png" });

// 6. Esc closes + returns focus to trigger
await page.keyboard.press("Escape");
await dialog.waitFor({ state: "hidden" });
ok("aria-expanded=false after Esc", (await trigger.getAttribute("aria-expanded")) === "false");
const focusReturned = await page.evaluate(() => document.activeElement === document.querySelector(".a11y-trigger"));
ok("focus returned to trigger after Esc", focusReturned);

// 7. Focus trap: open, Tab many times, focus must stay inside dialog
await trigger.click();
await dialog.waitFor({ state: "visible" });
let stayedInside = true;
for (let i = 0; i < 14; i++) {
  await page.keyboard.press("Tab");
  const inside = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return d && d.contains(document.activeElement);
  });
  if (!inside) { stayedInside = false; break; }
}
ok("focus stays trapped across 14 Tabs", stayedInside);
// Shift+Tab wrap
let stayedInsideBack = true;
for (let i = 0; i < 14; i++) {
  await page.keyboard.press("Shift+Tab");
  const inside = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return d && d.contains(document.activeElement);
  });
  if (!inside) { stayedInsideBack = false; break; }
}
ok("focus stays trapped across 14 Shift+Tabs", stayedInsideBack);

// 8. Reset all clears everything
await page.locator(".a11y-reset").click();
const afterReset = await page.evaluate(() => ({
  classes: document.documentElement.className,
  ls: localStorage.getItem("a11y-widget:v1"),
  varv: document.documentElement.style.getPropertyValue("--a11y-font-scale"),
}));
ok("reset removes all a11y- classes", !/a11y-(high-contrast|readable-font|highlight-links|stop-animations)/.test(afterReset.classes), afterReset.classes);
ok("reset clears localStorage key", afterReset.ls === null, String(afterReset.ls));

// 9. RTL/LTR widget dir mirrors with lang prop
const dirEn = await page.evaluate(() => document.querySelector(".a11y-widget-root").getAttribute("dir"));
ok("widget dir=ltr in English", dirEn === "ltr", dirEn);
await page.keyboard.press("Escape");
await page.locator(".demo-btn").click(); // en -> he
const dirHe = await page.evaluate(() => document.querySelector(".a11y-widget-root").getAttribute("dir"));
ok("widget dir=rtl in Hebrew", dirHe === "rtl", dirHe);

// 10. Persistence across reload
await page.locator(".a11y-trigger").click();
await page.locator(".a11y-toggle").first().click(); // turn one on (he: high contrast)
await page.waitForTimeout(50);
await page.reload({ waitUntil: "networkidle" });
const restored = await page.evaluate(() => document.documentElement.className);
ok("preference restored after reload", /a11y-high-contrast/.test(restored), restored);
// clean up storage for a tidy screenshot baseline
await page.evaluate(() => localStorage.clear());

await browser.close();

// Report
let passed = 0;
for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.extra ? "  [" + r.extra + "]" : ""}`);
  if (r.pass) passed++;
}
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
