import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const outputDir = join(process.cwd(), ".browser-preview");
await mkdir(outputDir, { recursive: true });
const executablePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await chromium.launch({ headless: true, executablePath });
const sizes = { mobile: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1440, height: 900 }, wide: { width: 1920, height: 1080 } };
let failures = 0;
try {
  for (const [slug, expectedName] of [["island-fresh-demo", "Island Fresh Demo"], ["harbour-goods-demo", "Harbour Goods Demo"]]) {
    for (const [sizeName, viewport] of Object.entries(sizes)) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      const response = await page.goto(`http://${slug}.localhost:3000/`, { waitUntil: "domcontentloaded" });
      await page.locator("h1").waitFor();
      const imageCount = await page.locator("img").count();
      for (let index = 0; index < imageCount; index += 1) await page.locator("img").nth(index).scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.images].every(image => image.complete), undefined, { timeout: 15000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      const result = await page.evaluate(() => {
        const links = [...document.querySelectorAll(".hero-actions a")].map(element => element.getBoundingClientRect());
        return {
          title: document.querySelector("h1")?.textContent,
          brandName: document.querySelector(".wordmark")?.textContent,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          brokenImages: [...document.images].filter(image => image.complete && image.naturalWidth === 0).length,
          overlappingActions: links.length > 1 && links[0].right > links[1].left && links[0].top < links[1].bottom && links[0].bottom > links[1].top,
          themePrimary: getComputedStyle(document.querySelector(".template-page")).getPropertyValue("--theme-primary") || getComputedStyle(document.querySelector(".template-page").parentElement).getPropertyValue("--theme-primary")
        };
      });
      await page.screenshot({ path: join(outputDir, `${slug}-${sizeName}.png`), fullPage: sizeName === "desktop" });
      const passed = response?.status() === 200 && !result.overflow && !result.brokenImages && !result.overlappingActions && Boolean(result.title) && result.brandName?.includes(expectedName);
      if (!passed) failures += 1;
      console.log(`${passed ? "PASS" : "FAIL"} ${slug} ${sizeName}: ${JSON.stringify(result)}`);
      await page.close();
    }
  }
  const page = await browser.newPage();
  const unknown = await page.goto("http://unknown.localhost:3000/", { waitUntil: "domcontentloaded" });
  console.log(`${unknown?.status() === 404 ? "PASS" : "FAIL"} unknown hostname: ${unknown?.status()}`);
  if (unknown?.status() !== 404) failures += 1;
  await page.close();
  const colors = new Set();
  for (const themeKey of ["tropical-fresh", "organic-earth", "luxury-artisan", "caribbean-bold", "modern-minimal"]) {
    const preview = await browser.newPage({ viewport: sizes.desktop });
    const response = await preview.goto(`http://localhost:3000/preview/${themeKey}`, { waitUntil: "domcontentloaded" });
    await preview.locator("h1").waitFor();
    const color = await preview.evaluate(() => getComputedStyle(document.querySelector(".template-page")).getPropertyValue("--theme-primary"));
    colors.add(color);
    await preview.screenshot({ path: join(outputDir, `theme-${themeKey}.png`) });
    const passed = response?.status() === 200 && Boolean(color);
    if (!passed) failures += 1;
    console.log(`${passed ? "PASS" : "FAIL"} preview ${themeKey}: ${color}`);
    await preview.close();
  }
  if (colors.size !== 5) { console.error("FAIL preview themes do not have five distinct primary colors"); failures += 1; }
} finally {
  await browser.close();
}
if (failures) process.exitCode = 1;
