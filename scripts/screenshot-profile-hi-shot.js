/* eslint-disable no-console */

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

async function main() {
  const url = process.env.PREVIEW_URL || "http://localhost:3001/profile-hi-shot?voxeraBuilder=1";
  const outDir = path.join(process.cwd(), "screenshots");
  const outPath = path.join(outDir, "profile-hi-shot.png");

  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: "domcontentloaded" });

  await page.addStyleTag({
    content: `
      nextjs-portal, #__next-build-watcher, #__next-dev-overlay, #nextjs__container,
      [data-nextjs-dialog-overlay], [data-nextjs-dialog] { display:none !important; }
      iframe[src*="lingo"], #lingo-widget, .lingo-widget, .lingo-dev-widget, [data-lingo-widget] { display:none !important; }
    `,
  });

  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal,#__next-build-watcher,#__next-dev-overlay,#nextjs__container").forEach((n) => n.remove());
    const nodes = Array.from(document.querySelectorAll("body *"));
    for (const el of nodes) {
      const txt = (el.textContent || "").trim();
      if (!txt) continue;
      if (!txt.toLowerCase().includes("lingo.dev")) continue;
      const style = window.getComputedStyle(el);
      if (style.position === "fixed" || style.position === "sticky") {
        (el).remove();
      }
    }
  });
  await page.waitForTimeout(1500);

  await page
    .waitForFunction(
      () => Array.from(document.querySelectorAll("button")).some((b) => (b.textContent || "").includes("लिंगो देव")),
      null,
      { timeout: 8000 },
    )
    .catch(() => null);

  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();

  console.log(JSON.stringify({ ok: true, url, screenshot: outPath }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
