/* eslint-disable no-console */

const { chromium } = require("playwright");

async function main() {
  const url = process.env.PREVIEW_URL || "http://localhost:3001/calendar-kn-shot?voxeraBuilder=1&voxeraLocale=kn";

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const info = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('button[data-voxera-lingo-dev="1"]'));
    const btns = nodes.map((b) => {
      const r = b.getBoundingClientRect();
      return { text: (b.textContent || "").trim(), left: r.left, top: r.top };
    });
    return { lingoBtnCount: btns.length, lingoBtns: btns };
  });

  await browser.close();

  const posOk = info.lingoBtns[0] ? info.lingoBtns[0].left < 240 && info.lingoBtns[0].top > 500 : false;
  const ok = errors.length === 0 && info.lingoBtnCount === 1 && posOk;

  console.log(JSON.stringify({ ok, url, errors, info }, null, 2));
  if (!ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
