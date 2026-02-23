/* eslint-disable no-console */

const { chromium } = require("playwright");

async function main() {
  const url = process.env.PREVIEW_URL || "http://localhost:3001/profile-hi-shot?voxeraBuilder=1&voxeraLocale=hi&voxeraShowLingo=1";

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  const hits = await page.evaluate(() => {
    const needles = ["Lingo.dev", "Lingo Dev", "लिंगो देव", "ಲಿಂಗೋ"]; // quick scan
    const results = [];

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node) {
      const el = node;
      const text = (el.textContent || "").trim();
      if (text && needles.some((n) => text.includes(n))) {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 4).join(".");
        const href = el.getAttribute && el.getAttribute("href");
        results.push({ tag, id, cls, text: text.slice(0, 80), href });
      }
      node = walker.nextNode();
    }
    return results.slice(0, 30);
  });

  await browser.close();
  console.log(JSON.stringify({ url, count: hits.length, hits }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
