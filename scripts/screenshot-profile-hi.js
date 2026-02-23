/* eslint-disable no-console */

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

async function main() {
  const url = process.env.PREVIEW_URL || "http://localhost:3001/profile-hi?voxeraBuilder=1";
  const outDir = path.join(process.cwd(), "screenshots");
  const outPath = path.join(outDir, "profile-hi.png");

  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // Hide dev overlays/widgets so the screenshot doesn't look like a dev build.
  await page.addStyleTag({
    content: `
      nextjs-portal, #__next-build-watcher, #__next-dev-overlay, #nextjs__container,
      [data-nextjs-dialog-overlay], [data-nextjs-dialog] { display:none !important; }
      iframe[src*="lingo"], #lingo-widget, .lingo-widget, .lingo-dev-widget, [data-lingo-widget] { display:none !important; }
    `,
  });

  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal,#__next-build-watcher,#__next-dev-overlay,#nextjs__container").forEach((n) => n.remove());

    // Remove any Lingo widget/button artifacts from the screenshot.
    // We want the screenshot to be pure UI; the real floating button is rendered separately.
    const nodes = Array.from(document.querySelectorAll("body *"));
    for (const el of nodes) {
      const txt = (el.textContent || "").trim();
      const aria = (el.getAttribute?.("aria-label") || "").trim();
      const combined = `${txt} ${aria}`.toLowerCase();
      const cls = (el.getAttribute?.("class") || "").toLowerCase();
      const id = (el.getAttribute?.("id") || "").toLowerCase();

      const looksLikeLingo =
        combined.includes("lingo") ||
        combined.includes("लिंगो") ||
        combined.includes("ಲಿಂಗೋ") ||
        combined.includes("lingo.dev") ||
        cls.includes("lingo") ||
        id.includes("lingo");

      if (!looksLikeLingo) continue;

      // Prefer removing the smallest reasonable container.
      const removable = el.closest("button,a,div") || el;
      try {
        removable.remove();
      } catch {
        // ignore
      }
    }
  });

  // Wait a moment for images/fonts.
  await page.waitForTimeout(1500);

  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();

  console.log(JSON.stringify({ ok: true, url, screenshot: outPath }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
