import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const out = join(process.cwd(), ".browser-preview");
await mkdir(out, { recursive: true });
let failures = 0;
try {
  const page = await browser.newPage();
  const admin = "http://island-fresh-demo.localhost:3001";
  await page.goto(`${admin}/login`);
  await page.getByLabel("Email").fill("island-fresh-demo@example.test");
  await page.getByLabel("Password").fill(process.env.ADASH_DEMO_PASSWORD ?? "DemoOnly-2026!ChangeMe");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${admin}/dashboard`);
  await page.reload();
  const pages = { overview: "/dashboard", products: "/dashboard/products", productForm: "/dashboard/products/new", brand: "/dashboard/brand", business: "/dashboard/business", locations: "/dashboard/locations", content: "/dashboard/content" };
  const sizes = { mobile: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1440, height: 900 } };
  for (const [sizeName, viewport] of Object.entries(sizes)) {
    await page.setViewportSize(viewport);
    for (const [name, path] of Object.entries(pages)) {
      const response = await page.goto(`${admin}${path}`, { waitUntil: "domcontentloaded" });
      const result = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, heading: document.querySelector("h1")?.textContent }));
      const pass = response?.status() === 200 && !result.overflow && Boolean(result.heading);
      if (!pass) failures++;
      console.log(`${pass ? "PASS" : "FAIL"} ${sizeName} ${name}: ${JSON.stringify(result)}`);
      if (["productForm", "brand", "locations"].includes(name)) await page.screenshot({ path: join(out, `phase3-${name}-${sizeName}.png`) });
    }
  }
} finally { await browser.close(); }
if (failures) process.exitCode = 1;
