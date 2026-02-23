/* eslint-disable no-console */

const { chromium } = require("playwright");

async function main() {
  const baseUrl = process.env.PREVIEW_URL || "http://localhost:3001";

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${baseUrl}/calendar-kn-shot?voxeraBuilder=1&voxeraLocale=kn`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const hindiButtonCount = await page.getByRole("button", { name: "लिंगो देव" }).count();
  const lingoBtnCount = await page.evaluate(() => document.querySelectorAll('button[data-voxera-lingo-dev="1"]').length);

  await browser.close();

  const ok = errors.length === 0 && hindiButtonCount === 0 && lingoBtnCount === 1;
  console.log(JSON.stringify({ ok, hindiButtonCount, lingoBtnCount, errors }, null, 2));
  if (!ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
