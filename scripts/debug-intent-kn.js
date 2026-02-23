/* eslint-disable no-console */

async function post(transcript) {
  const r = await fetch("http://localhost:3006/api/voice/debug-intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcript, detectedLanguage: "kn" }),
  });
  const j = await r.json();
  return {
    input: transcript,
    outTranscript: j.transcript,
    language: j.language,
    intentType: j.intent?.type,
    detectedLanguage: j.intent?.metadata?.detectedLanguage,
  };
}

async function main() {
  const samples = [
    "ಕ್ಯಾಲೆಂಡರ್ ಪುಟವನ್ನು ಕನ್ನಡದಲ್ಲಿ ತೋರಿಸು",
    "ಕಯಲಡರ ಪಟವನನ ಕನನಡದಲಲ ತರಸ",
  ];

  const results = [];
  for (const s of samples) results.push(await post(s));

  console.log(JSON.stringify({ ok: results.every((x) => x.intentType === "KANNADA_CALENDAR_DEMO"), results }, null, 2));
  if (!results.every((x) => x.intentType === "KANNADA_CALENDAR_DEMO")) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
