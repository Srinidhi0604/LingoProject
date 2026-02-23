/* eslint-disable no-console */

async function main() {
  const samples = [
    // Ideal
    "ಈ ತಿಂಗಳಲ್ಲಿ ಒಂದು ಹೊಸ ಈವೆಂಟ್ ಸೇರಿಸಿ",
    // Common mangled output we saw
    "ಈ ತಗಳಲಲ ಒದ ಹಸ ಈವಟ ಸರಸ",
    // Mixed English
    "calendar event add",
    // Kannada calendar keyword only + add-ish
    "ಕ್ಯಾಲೆಂಡರ್ ಈವೆಂಟ್ ಸೇರಿಸಿ",
  ];

  const results = [];

  for (const transcript of samples) {
    const r = await fetch("http://localhost:3006/api/voice/debug-intent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript, detectedLanguage: "kn" }),
    });
    const j = await r.json();
    results.push({ input: transcript, normalizedTranscript: j.transcript, intentType: j.intent?.type });
  }

  const allOk = results.every((x) => x.intentType === "ui.calendarKnAddEvent");
  if (!allOk) {
    console.error("KANNADA INTENT VERIFICATION FAILED");
    console.error(JSON.stringify(results, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
