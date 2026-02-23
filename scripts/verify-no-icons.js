/* eslint-disable no-console */

const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(
    "http://localhost:3001/profile-hi-shot?voxeraBuilder=1&voxeraLocale=hi&voxeraShowLingo=1",
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForTimeout(1500);

  const result = await page.evaluate(() => {
    const hasNextPortal = document.querySelector("nextjs-portal") !== null;

    const iframeHasLingo = Array.from(document.querySelectorAll("iframe")).some((f) =>
      (f.getAttribute("src") || "").toLowerCase().includes("lingo"),
    );

    const widgetMarker =
      document.querySelector("#lingo-widget") ||
      document.querySelector(".lingo-widget") ||
      document.querySelector(".lingo-dev-widget") ||
      document.querySelector("[data-lingo-widget]");

    return {
      hasNextPortal,
      hasLingoWidget: Boolean(widgetMarker) || iframeHasLingo,
    };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
