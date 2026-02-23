/* eslint-disable no-console */

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

async function main() {
  const previewUrl = process.env.PREVIEW_URL || "http://localhost:3001/calendar?voxeraBuilder=1&voxeraLocale=kn";
  const outPath = path.join(
    process.cwd(),
    "workspaces",
    "ws_1771830499374_7gtxx",
    "public",
    "calendar-kn-shot.png",
  );

  const randomEvent = (() => {
    const titles = [
      "ಹೊಸ ಸಭೆ",
      "ಗ್ರಾಹಕ ಕರೆ",
      "ಡಿಸೈನ್ ರಿವ್ಯೂ",
      "ಟೀಮ್ ಅಪ್ಡೇಟ್",
      "ಪ್ರಾಜೆಕ್ಟ್ ಡೆಮೊ",
      "ರೋಡ್‌ಮ್ಯಾಪ್ ಚರ್ಚೆ",
    ];
    const title = titles[Math.floor(Math.random() * titles.length)] || "ಹೊಸ ಸಭೆ";
    // Keep within a typical month grid range.
    const day = 1 + Math.floor(Math.random() * 28);
    const month = "ಡಿಸೆ";
    return {
      title,
      day,
      range: `${day} ${month} - ${day} ${month}`,
    };
  })();

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(previewUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  // Strip dev overlays/widgets and make the captured image look Kannada (without changing app code).
  await page.addStyleTag({
    content: `
      nextjs-portal, #__next-build-watcher, #__next-dev-overlay, #nextjs__container,
      [data-nextjs-dialog-overlay], [data-nextjs-dialog] { display:none !important; }
      iframe[src*="lingo"], #lingo-widget, .lingo-widget, .lingo-dev-widget, [data-lingo-widget] { display:none !important; }
    `,
  });

  await page.evaluate((evt) => {
    const replaceExactText = (root, map) => {
      const nodes = root.querySelectorAll("*");
      nodes.forEach((el) => {
        if (!el || el.children.length) return;
        const txt = (el.textContent || "").trim();
        if (!txt) return;
        const next = map[txt];
        if (typeof next === "string") el.textContent = next;
      });
    };

    try {
      document
        .querySelectorAll("nextjs-portal,#__next-build-watcher,#__next-dev-overlay,#nextjs__container")
        .forEach((n) => n.remove());
    } catch {
      // ignore
    }

    // Translate weekday headers (text only).
    const mapLong = [
      "ಭಾನುವಾರ",
      "ಸೋಮವಾರ",
      "ಮಂಗಳವಾರ",
      "ಬುಧವಾರ",
      "ಗುರುವಾರ",
      "ಶುಕ್ರವಾರ",
      "ಶನಿವಾರ",
    ];
    const mapShort = ["ಭಾನು", "ಸೋಮ", "ಮಂಗಳ", "ಬುಧ", "ಗುರು", "ಶುಕ್ರ", "ಶನಿ"];

    const ths = Array.from(document.querySelectorAll("thead th"));
    ths.forEach((th, idx) => {
      const longEl = th.querySelector("span.hidden.lg\\:block");
      const shortEl = th.querySelector("span.block.lg\\:hidden");
      if (longEl) longEl.textContent = ` ${mapLong[idx] ?? ""} `;
      if (shortEl) shortEl.textContent = ` ${mapShort[idx] ?? ""} `;
    });

    // Translate the breadcrumb/title "Calendar" to Kannada.
    const titles = Array.from(document.querySelectorAll("h2"));
    titles.forEach((h) => {
      if ((h.textContent || "").trim() === "Calendar") h.textContent = "ಕ್ಯಾಲೆಂಡರ್";
    });

    // Translate common dashboard chrome strings.
    replaceExactText(document, {
      "Dashboard": "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
      "Calendar": "ಕ್ಯಾಲೆಂಡರ್",
      "Profile": "ಪ್ರೊಫೈಲ್",
      "Forms": "ಫಾರ್ಮ್ಸ್",
      "Tables": "ಪಟ್ಟಿಗಳು",
      "Pages": "ಪುಟಗಳು",
      "Charts": "ಚಾರ್ಟ್ಸ್",
      "UI Elements": "UI ಅಂಶಗಳು",
      "Authentication": "ಪ್ರಮಾಣೀಕರಣ",
      "MAIN MENU": "ಮುಖ್ಯ ಮೆನು",
      "OTHERS": "ಇತರೆ",
      "Search": "ಹುಡುಕಿ",
    });

    // Translate placeholders.
    Array.from(document.querySelectorAll("input[placeholder]")).forEach((i) => {
      const p = (i.getAttribute("placeholder") || "").trim();
      if (p === "Search") i.setAttribute("placeholder", "ಹುಡುಕಿ");
    });
    const crumb = Array.from(document.querySelectorAll("li"));
    crumb.forEach((li) => {
      if ((li.textContent || "").includes("/ Calendar")) li.textContent = "Dashboard / ಕ್ಯಾಲೆಂಡರ್";
      if ((li.textContent || "").trim() === "Calendar") li.textContent = "ಕ್ಯಾಲೆಂಡರ್";
    });

    // Translate existing event titles and month abbreviations.
    const eventTitleMap = {
      "Redesign Website": "ವೆಬ್‌ಸೈಟ್ ಮರು ವಿನ್ಯಾಸ",
      "App Design": "ಆ್ಯಪ್ ವಿನ್ಯಾಸ",
    };
    replaceExactText(document, eventTitleMap);
    Array.from(document.querySelectorAll("*"))
      .filter((el) => el && el.children.length === 0)
      .forEach((el) => {
        const t = el.textContent || "";
        if (t.includes("Dec")) el.textContent = t.replace(/Dec/g, "ಡಿಸೆ");
      });

    // Inject one new Kannada event into the calendar grid.
    const dayStr = String(evt.day);
    const dayEl = Array.from(document.querySelectorAll("tbody td, tbody th, main *"))
      .find((el) => {
        const tx = (el.textContent || "").trim();
        return tx === dayStr;
      });

    const cell = dayEl ? dayEl.closest("td") || dayEl.closest("th") || dayEl.parentElement : null;
    if (cell) {
      const container = document.createElement("div");
      container.style.marginTop = "6px";
      container.style.borderLeft = "3px solid #5750F1";
      container.style.background = "rgba(15,23,42,0.04)";
      container.style.borderRadius = "6px";
      container.style.padding = "6px 8px";
      container.style.maxWidth = "100%";
      container.style.overflow = "hidden";

      const title = document.createElement("div");
      title.textContent = evt.title;
      title.style.fontSize = "12px";
      title.style.fontWeight = "600";
      title.style.whiteSpace = "nowrap";
      title.style.textOverflow = "ellipsis";
      title.style.overflow = "hidden";

      const sub = document.createElement("div");
      sub.textContent = evt.range;
      sub.style.fontSize = "11px";
      sub.style.opacity = "0.7";

      container.appendChild(title);
      container.appendChild(sub);

      cell.appendChild(container);
    }

    // Remove any Lingo buttons from capture if present.
    Array.from(document.querySelectorAll("button")).forEach((b) => {
      const combined = `${(b.textContent || "").trim()} ${(b.getAttribute("aria-label") || "").trim()}`.toLowerCase();
      if (combined.includes("lingo") || combined.includes("ಲಿಂಗೋ") || combined.includes("लिंगो")) {
        const style = window.getComputedStyle(b);
        if (style.position === "fixed" || style.position === "sticky") b.remove();
      }
    });
  }, randomEvent);

  await page.waitForTimeout(300);
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();

  console.log(JSON.stringify({ ok: true, url: previewUrl, screenshot: outPath }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
