/* eslint-disable no-console */

const { chromium } = require("playwright");

async function main() {
  const baseUrl = process.env.PREVIEW_URL || "http://localhost:3001";

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  // Step 1: Hindi profile overlay
  await page.goto(`${baseUrl}/profile-hi-shot?voxeraLocale=hi&voxeraShowLingo=1`, { waitUntil: "domcontentloaded" });
  // Wait for the single real button to render.
  await page.getByRole("button", { name: "लिंगो देव" }).waitFor({ timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(300);

  // Verify single visible "लिंगो देव" button exists.
  const hindiButtonCount = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    return buttons.filter((b) => (b.textContent || "").trim() === "लिंगो देव").length;
  });

  // Step 2: Kannada calendar overlay (same tab)
  await page.goto(`${baseUrl}/calendar-kn-shot?voxeraLocale=kn`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);

  const hasKannadaImage = await page.evaluate(() => {
    const img = document.querySelector("img.kn-image");
    return Boolean(img && (img.getAttribute("src") || "").includes("calendar-kn-shot.png"));
  });

  await browser.close();

  const ok = hindiButtonCount === 1 && hasKannadaImage && consoleErrors.length === 0;
  console.log(
    JSON.stringify(
      {
        ok,
        hindiButtonCount,
        hasKannadaImage,
        consoleErrors,
      },
      null,
      2,
    ),
  );

  if (!ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
