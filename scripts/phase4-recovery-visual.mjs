import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const output = join(process.cwd(), ".browser-preview");
await mkdir(output, { recursive: true });
let failures = 0;
const check = (label, okay, detail = "") => { console.log(`${okay ? "PASS" : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`); if (!okay) failures++; };
async function login(page, slug) { const url = `http://${slug}.localhost:3001`; await page.goto(`${url}/login`); await page.getByLabel("Email").fill(`${slug}@example.test`); await page.getByLabel("Password").fill(process.env.ADASH_DEMO_PASSWORD ?? "DemoOnly-2026!ChangeMe"); await page.getByRole("button", { name: "Sign in" }).click(); await page.waitForURL(`${url}/dashboard`); return url; }
try {
  for (const slug of ["island-fresh-demo", "harbour-goods-demo"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "allow" });
    const page = await context.newPage();
    const publicUrl = `http://${slug}.localhost:3000`;
    await page.goto(publicUrl);
    await page.waitForLoadState("networkidle");
    const section = page.locator(".contact-section");
    check(`${slug} contact section`, await section.count() === 1 && await section.getByRole("heading", { level: 2 }).count() === 1);
    const whatsapp = section.getByRole("link", { name: /WhatsApp us/ });
    check(`${slug} WhatsApp contact`, await whatsapp.count() === 1 && (await whatsapp.getAttribute("href"))?.startsWith("https://wa.me/"));
    check(`${slug} contact no overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await section.screenshot({ path: join(output, `phase4-contact-${slug}-desktop.png`) });
    if (slug === "island-fresh-demo") {
      for (const [label, viewport] of Object.entries({ mobile: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 } })) {
        await page.setViewportSize(viewport);
        check(`${label} contact layout`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1) && await section.getByRole("link", { name: /WhatsApp us/ }).isVisible());
        await section.screenshot({ path: join(output, `phase4-contact-${label}.png`) });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      try {
        let state = await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; return { scope: registration.scope, active: registration.active?.state, controlled: Boolean(navigator.serviceWorker.controller) }; });
        if (!state.controlled) { await page.reload(); state = await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; return { scope: registration.scope, active: registration.active?.state, controlled: Boolean(navigator.serviceWorker.controller) }; }); }
        await page.waitForLoadState("networkidle");
        check("service worker registered", state.active === "activated" && state.scope === `${publicUrl}/` && state.controlled, JSON.stringify(state));
        await context.setOffline(true);
        await page.goto(`${publicUrl}/products/citrus-daybreak`, { waitUntil: "domcontentloaded", timeout: 15000 });
        const offlineText = await page.locator("main").innerText();
        check("offline fallback navigation", offlineText.includes("currently offline") && offlineText.includes("prices and availability"));
      } catch (error) { check("service worker offline navigation", false, String(error).slice(0, 200)); }
      finally { await context.setOffline(false); }
    }
    const admin = await login(page, slug);
    await page.goto(`${admin}/dashboard/content/preview`);
    await page.waitForLoadState("networkidle");
    const images = await page.locator("section.panel img").evaluateAll(nodes => nodes.map(image => ({ src: image.currentSrc, width: image.naturalWidth, complete: image.complete })));
    check(`${slug} preview images render`, images.length > 0 && images.every(image => image.complete && image.width > 0), JSON.stringify(images));
    check(`${slug} preview image tenant isolation`, images.every(image => !image.src.includes(slug === "island-fresh-demo" ? "harbour-goods-demo" : "island-fresh-demo")));
    await page.screenshot({ path: join(output, `phase4-preview-${slug}-retest.png`) });
    await context.close();
  }
} catch (error) { console.error(error); failures++; }
finally { await browser.close(); }
if (failures) process.exitCode = 1;
