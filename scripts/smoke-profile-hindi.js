/* eslint-disable no-console */

const { chromium } = require("playwright");

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const url = process.env.PREVIEW_URL || "http://localhost:3001/profile?voxeraBuilder=1";

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const translationFailures = [];
  const serverUrlHits = [];
  const wsErrors = [];

  page.on("console", (msg) => {
    const text = msg.text() || "";
    if (text.includes("WebSocket") || text.includes("[Lingo.dev]")) {
      wsErrors.push(text);
    }
  });

  page.on("response", (resp) => {
    const u = resp.url();
    if (u.includes("/__SERVER_URL__/translations")) {
      serverUrlHits.push({ url: u, status: resp.status() });
    }
    if (!u.includes("/translations/") && !u.includes("/__SERVER_URL__/translations/")) return;
    if (resp.status() >= 400) {
      translationFailures.push({ url: u, status: resp.status() });
    }
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });

  const loadedUrl = page.url();
  if (!loadedUrl.toLowerCase().includes("/profile")) {
    console.error(`SMOKE TEST FAILED\nExpected to be on /profile but landed on: ${loadedUrl}`);
    await browser.close();
    process.exitCode = 1;
    return;
  }

  // Wait until the preview overlay bridge has mounted and is listening.
  await page
    .waitForFunction(
      () => document.documentElement.dataset.voxeraOverlayBridge === "1",
      null,
      { timeout: 15000 },
    )
    .catch(() => null);

  // Simulate what the IDE sends to the preview iframe.
  await page.evaluate(() => {
    const send = (value) =>
      window.dispatchEvent(new MessageEvent("message", { data: { type: "voxera:overlay", action: "setLanguage", value }, origin: window.location.origin }));
    window.dispatchEvent(new MessageEvent("message", { data: { type: "voxera:demo", action: "showLingoButton" }, origin: window.location.origin }));
    send("hi");
    send("kn");
    send("es");
    send("hi");
  });

  // Give the runtime a moment to fetch translations and re-render.
  await page
    .waitForFunction(
      () => Array.from(document.querySelectorAll("button")).some((b) => (b.textContent || "").includes("लिंगो")),
      null,
      { timeout: 8000 },
    )
    .catch(() => null);
  await sleep(500);

  const lang = await page.evaluate(() => document.documentElement.lang);

  const buttonText = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("button"));
    const match = candidates.find((b) => {
      const text = (b.textContent || "").trim();
      const aria = (b.getAttribute("aria-label") || "").trim();
      return (text && (text.includes("लिंगो") || text.includes("Lingo"))) || (aria && (aria.includes("लिंगो") || aria.includes("Lingo")));
    });
    return match ? ((match.textContent || "").trim() || (match.getAttribute("aria-label") || "").trim()) : "";
  });

  // Fail fast if the expected effects didn't occur.
  const errors = [];
  if (!buttonText || !buttonText.includes("लिंगो")) {
    errors.push(`Expected Hindi Lingo Dev button text to appear on /profile, but got: '${buttonText || "<none>"}'`);
  }
  if (serverUrlHits.length) {
    errors.push("Preview made requests to /__SERVER_URL__/translations (should be zero): " + serverUrlHits.map((h) => `${h.status} ${h.url}`).join(" | "));
  }
  if (wsErrors.length) {
    errors.push("Console contained WebSocket/Lingo remote errors (should be none): " + wsErrors.slice(-5).join(" | "));
  }
  if (translationFailures.length) {
    errors.push(
      "Translation requests failed: " +
        translationFailures.map((f) => `${f.status} ${f.url}`).join(" | "),
    );
  }

  if (errors.length) {
    console.error("SMOKE TEST FAILED\n" + errors.join("\n"));
    await browser.close();
    process.exitCode = 1;
    return;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        url: loadedUrl,
        lang,
        buttonText,
      },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
