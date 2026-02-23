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

  await page.goto(`${baseUrl}/profile-hi-shot?voxeraBuilder=1&voxeraLocale=hi&voxeraShowLingo=1`, {
    waitUntil: "domcontentloaded",
  });

  // Exactly one floating Hindi button
  await page.getByRole("button", { name: "लिंगो देव" }).waitFor({ timeout: 8000 });
  const countHindiButtons = await page.getByRole("button", { name: "लिंगो देव" }).count();

  // Clicking opens a real /lingo-dev page
  await page.getByRole("button", { name: "लिंगो देव" }).first().click();
  await page.waitForURL((u) => u.pathname.endsWith("/lingo-dev"), { timeout: 8000 });

  const lingoDevOk = await page.evaluate(() => {
    const h1 = document.querySelector("h1") || document.querySelector(".text-2xl");
    return Boolean(h1 && (h1.textContent || "").trim().length);
  });

  await browser.close();

  const ok = errors.length === 0 && countHindiButtons === 1 && lingoDevOk;
  console.log(JSON.stringify({ ok, countHindiButtons, lingoDevOk, errors }, null, 2));
  if (!ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
