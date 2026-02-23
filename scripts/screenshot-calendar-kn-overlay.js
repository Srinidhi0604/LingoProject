/* eslint-disable no-console */

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

async function main() {
  const url = process.env.PREVIEW_URL || "http://localhost:3001/calendar-kn-shot?voxeraBuilder=1&voxeraLocale=kn";
  const outDir = path.join(process.cwd(), "screenshots");
  const outPath = path.join(outDir, "calendar-kn-shot.png");

  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Capture console errors for debugging.
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  await page.goto(url, { waitUntil: "domcontentloaded" });

  // Wait for the screenshot image to be requested/rendered.
  await page
    .waitForFunction(() => {
      const img = document.querySelector("img.kn-image");
      return Boolean(img && (img.getAttribute("src") || "").includes("calendar-kn-shot.png"));
    }, null, { timeout: 8000 })
    .catch(() => null);

  await page.waitForTimeout(800);

  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();

  console.log(
    JSON.stringify(
      {
        ok: true,
        url,
        screenshot: outPath,
        consoleErrors: consoleErrors.slice(-10),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
