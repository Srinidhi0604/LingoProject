import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

type ProjectLayoutRoots = {
  root: string;
  appDir: string;
  componentsDir: string;
  layoutFile: string;
  usesSrc: boolean;
};

function detectAppRouterRoots(workspacePath: string): ProjectLayoutRoots | null {
  const srcLayout = path.join(workspacePath, "src", "app", "layout.tsx");
  if (existsSync(srcLayout)) {
    return {
      root: workspacePath,
      appDir: path.join(workspacePath, "src", "app"),
      componentsDir: path.join(workspacePath, "src", "components"),
      layoutFile: srcLayout,
      usesSrc: true,
    };
  }

  const appLayout = path.join(workspacePath, "app", "layout.tsx");
  if (existsSync(appLayout)) {
    return {
      root: workspacePath,
      appDir: path.join(workspacePath, "app"),
      componentsDir: path.join(workspacePath, "components"),
      layoutFile: appLayout,
      usesSrc: false,
    };
  }

  return null;
}

async function readText(filePath: string): Promise<string> {
  return await fs.readFile(filePath, "utf-8");
}

async function writeText(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}

async function writeJsonMerge(filePath: string, additions: Record<string, string>): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  let current: Record<string, unknown> = {};
  if (existsSync(filePath)) {
    try {
      current = JSON.parse(await fs.readFile(filePath, "utf-8")) as Record<string, unknown>;
    } catch {
      current = {};
    }
  }
  const next: Record<string, string> = {
    ...(current as Record<string, string>),
    ...additions,
  };
  await fs.writeFile(filePath, JSON.stringify(next, null, 2) + "\n", "utf-8");
}

function patchLayoutTsx(content: string): string {
  if (content.includes("VoxeraOverlayBridge")) return content;

  let next = content;
  if (!next.includes("@lingo.dev/compiler/react")) {
    next = next.replace(
      /(^import[^;]+;\s*)+/m,
      (m) => `${m}import { LingoProvider } from "@lingo.dev/compiler/react";\n`,
    );
  }

  if (!next.includes("VoxeraOverlayBridge")) {
    next = next.replace(
      /(^import[^;]+;\s*)+/m,
      (m) => `${m}import VoxeraOverlayBridge from "../components/VoxeraOverlayBridge";\n`,
    );
  }

  // Ensure overlay css is imported (best-effort).
  if (!next.includes("voxera-overlay.css")) {
    next = next.replace(/import\s+\"\.\/globals\.css\";\s*/g, (m) => `${m}import "./voxera-overlay.css";\n`);
  }

  // Wrap body children with LingoProvider + overlay bridge. Very common layout shapes.
  next = next.replace(
    /<body([^>]*)>([\s\S]*?)<\/body>/m,
    (_m, attrs, inner) => {
      // Avoid double-wrapping if user already did.
      if (inner.includes("<LingoProvider")) {
        return `<body${attrs}>${inner}</body>`;
      }
      return `<body${attrs}>\n        <LingoProvider showWidget={false}>\n          <VoxeraOverlayBridge />\n          ${inner.trim()}\n        </LingoProvider>\n      </body>`;
    },
  );

  return next;
}

export async function applyImportedOverlay(workspacePath: string): Promise<void> {
  const roots = detectAppRouterRoots(workspacePath);
  if (!roots) return;

  // 1) Add overlay css
  await writeText(
    path.join(roots.appDir, "voxera-overlay.css"),
    `:root{--voxera-transition:all 200ms ease-in-out;}\n\nhtml,body{height:100%;}\n\nbody{transition:var(--voxera-transition);}\n\nbody.voxera-minimal{background:#fafafa;color:#111827;}\n\nbody.voxera-minimal main{padding:16px !important;}\n\n.voxera-fade-in{animation:voxeraFadeIn 200ms ease-in-out;}\n\n@keyframes voxeraFadeIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}\n`,
  );

  // 2) Add overlay bridge + button
  await writeText(
    path.join(roots.componentsDir, "LingoDevButton.tsx"),
    `"use client";\n\nimport { useEffect, useMemo, useState } from "react";\nimport { useRouter, useSearchParams } from "next/navigation";\nimport { Rnd } from "react-rnd";\nimport { useTranslation } from "@lingo.dev/compiler/react";\n\nexport default function LingoDevButton({ visible }: { visible: boolean }) {\n  const router = useRouter();\n  const params = useSearchParams();\n  const { t } = useTranslation(["lingo_dev_label"]);\n\n  const builderMode = params?.get("voxeraBuilder") === "1";\n\n  const defaultPos = useMemo(() => {\n    if (typeof window === "undefined") return { x: 0, y: 0 };\n    return { x: Math.max(16, window.innerWidth - 220), y: Math.max(16, window.innerHeight - 96) };\n  }, []);\n\n  const [pos, setPos] = useState(defaultPos);\n  useEffect(() => setPos(defaultPos), [defaultPos]);\n\n  if (!visible) return null;\n\n  const labelRaw = t("lingo_dev_label", "Lingo Dev");\n  const label = typeof labelRaw === "string" ? labelRaw : "Lingo Dev";\n\n  const btn = (\n    <button\n      type=\"button\"\n      onClick={() => router.push("/lingo-dev") }\n      className=\"voxera-fade-in inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium border border-current/20 bg-white/80 backdrop-blur transition hover:bg-white\"\n      aria-label=\"Lingo Dev\"\n    >\n      {label}\n    </button>\n  );\n\n  if (!builderMode) {\n    return <div className=\"fixed bottom-6 right-6 z-[70]\">{btn}</div>;\n  }\n\n  return (\n    <Rnd\n      bounds=\"window\"\n      default={{ x: pos.x, y: pos.y, width: "auto", height: "auto" }}\n      enableResizing={false}\n      onDragStop={(e, d) => { e.preventDefault(); setPos({ x: d.x, y: d.y }); }}\n      style={{ zIndex: 70 }}\n    >\n      {btn}\n    </Rnd>\n  );\n}\n`,
  );

  await writeText(
    path.join(roots.componentsDir, "VoxeraOverlayBridge.tsx"),
    `"use client";\n\nimport { useEffect, useState } from "react";\nimport { useLingoContext } from "@lingo.dev/compiler/react";\nimport LingoDevButton from "./LingoDevButton";\n\ntype OverlayMsg =\n  | { type: "voxera:overlay"; action: "setLayoutMode"; value: "minimal" | "default" }\n  | { type: "voxera:overlay"; action: "activatePreset"; value: "minimal_investor" | "default" }\n  | { type: "voxera:overlay"; action: "setLanguage"; value: "hi" | "en" }\n  | { type: "voxera:demo"; action: "showLingoButton" | "hideLingoButton" }\n  | { type: "voxera:demo"; action: "navigate"; value: string };\n\nexport default function VoxeraOverlayBridge() {\n  const { setLocale } = useLingoContext();\n  const [show, setShow] = useState(false);\n\n  useEffect(() => {\n    const onMsg = (event: MessageEvent) => {\n      const data = event.data as OverlayMsg;\n      if (!data || typeof data !== "object") return;\n\n      if ((data as any).type === "voxera:overlay") {\n        if (data.action === "setLayoutMode") {\n          document.body.classList.toggle("voxera-minimal", data.value === "minimal");\n        }\n        if (data.action === "activatePreset") {\n          const isMinimalInvestor = data.value === "minimal_investor";\n          if (isMinimalInvestor) {\n            document.body.dataset.voxeraPreset = "minimal_investor";\n            document.body.classList.add("voxera-minimal");\n          } else {\n            delete document.body.dataset.voxeraPreset;\n            document.body.classList.remove("voxera-minimal");\n          }\n          window.dispatchEvent(new Event("voxera:preset-change"));\n        }\n        if (data.action === "setLanguage") {\n          setLocale(data.value);\n        }\n        return;\n      }\n\n      if ((data as any).type === "voxera:demo") {\n        if (data.action === "showLingoButton") setShow(true);\n        if (data.action === "hideLingoButton") setShow(false);\n        if (data.action === "navigate") {\n          const next = typeof (data as any).value === "string" ? (data as any).value : "";\n          if (next) {\n            try {\n              const search = window.location.search || "";\n              window.location.assign(next + search);\n            } catch {\n              // ignore\n            }\n          }\n        }\n      }\n    };\n\n    window.addEventListener("message", onMsg);\n    return () => window.removeEventListener("message", onMsg);\n  }, [setLocale]);\n\n  return <LingoDevButton visible={show} />;\n}\n`,
  );

  // 3) Add /lingo-dev page
  const lingoDevDir = path.join(roots.appDir, "lingo-dev");
  const lingoDevPage = path.join(lingoDevDir, "page.tsx");
  if (!existsSync(lingoDevPage)) {
    await writeText(
      lingoDevPage,
      `"use client";\n\nimport { useTranslation } from "@lingo.dev/compiler/react";\n\nexport default function LingoDevDocs() {\n  const { t } = useTranslation([\n    "lingo_docs_title",\n    "lingo_docs_runtime",\n    "lingo_docs_cli",\n    "lingo_docs_cicd",\n    "lingo_docs_mcp",\n    "lingo_docs_compiler",\n  ]);\n\n  return (\n    <main className=\"min-h-screen p-6\">\n      <div className=\"max-w-2xl mx-auto\">\n        <h1 className=\"text-2xl font-semibold\">{t("lingo_docs_title", "Lingo Docs")}</h1>\n        <ul className=\"mt-6 list-disc pl-5 space-y-2\">\n          <li>{t("lingo_docs_runtime", "Runtime SDK")}</li>\n          <li>{t("lingo_docs_cli", "CLI (extract & sync)")}</li>\n          <li>{t("lingo_docs_cicd", "CI/CD validation")}</li>\n          <li>{t("lingo_docs_mcp", "MCP explanation")}</li>\n          <li>{t("lingo_docs_compiler", "Compiler optimization")}</li>\n        </ul>\n      </div>\n    </main>\n  );\n}\n`,
    );
  }

  // 4) Add translation JSONs (so LingoProvider can load without hitting a server)
  const enTranslations = {
    lingo_dev_label: "Lingo Dev",
    lingo_docs_title: "Lingo Docs",
    lingo_docs_runtime: "Runtime SDK",
    lingo_docs_cli: "CLI (extract & sync)",
    lingo_docs_cicd: "CI/CD validation",
    lingo_docs_mcp: "MCP explanation",
    lingo_docs_compiler: "Compiler optimization",
  };

  const hiTranslations = {
    lingo_dev_label: "लिंगो देव",
    lingo_docs_title: "लिंगो दस्तावेज़",
    lingo_docs_runtime: "रनटाइम SDK",
    lingo_docs_cli: "CLI (extract & sync)",
    lingo_docs_cicd: "CI/CD validation",
    lingo_docs_mcp: "MCP explanation",
    lingo_docs_compiler: "Compiler optimization",
  };

  const knTranslations = {
    lingo_dev_label: "ಲಿಂಗೋ ಡೆವ್",
    lingo_docs_title: "ಲಿಂಗೋ ದಾಖಲೆಗಳು",
    lingo_docs_runtime: "ರನ್‌ಟೈಮ್ SDK",
    lingo_docs_cli: "CLI (extract & sync)",
    lingo_docs_cicd: "CI/CD validation",
    lingo_docs_mcp: "MCP explanation",
    lingo_docs_compiler: "Compiler optimization",
    calendar_kn_new_event: "ಹೊಸ ಸಭೆ ಸೇರಿಸಲಾಗಿದೆ",
    calendar_title: "ಕ್ಯಾಲೆಂಡರ್",
  };

  const esTranslations = {
    lingo_dev_label: "Lingo Dev",
    lingo_docs_title: "Documentación de Lingo",
    lingo_docs_runtime: "SDK de runtime",
    lingo_docs_cli: "CLI (extract & sync)",
    lingo_docs_cicd: "Validación CI/CD",
    lingo_docs_mcp: "Explicación MCP",
    lingo_docs_compiler: "Optimización del compilador",
  };

  await writeJsonMerge(path.join(workspacePath, "public", "translations", "en.json"), enTranslations);
  await writeJsonMerge(path.join(workspacePath, "public", "translations", "hi.json"), hiTranslations);
  await writeJsonMerge(path.join(workspacePath, "public", "translations", "kn.json"), knTranslations);
  await writeJsonMerge(path.join(workspacePath, "public", "translations", "es.json"), esTranslations);

  // Some runtimes incorrectly fetch from /__SERVER_URL__/translations/*.json; mirror there too.
  await writeJsonMerge(path.join(workspacePath, "public", "__SERVER_URL__", "translations", "en.json"), enTranslations);
  await writeJsonMerge(path.join(workspacePath, "public", "__SERVER_URL__", "translations", "hi.json"), hiTranslations);
  await writeJsonMerge(path.join(workspacePath, "public", "__SERVER_URL__", "translations", "kn.json"), knTranslations);
  await writeJsonMerge(path.join(workspacePath, "public", "__SERVER_URL__", "translations", "es.json"), esTranslations);

  // Some runtimes omit the extension entirely.
  await writeText(
    path.join(workspacePath, "public", "__SERVER_URL__", "translations", "en"),
    JSON.stringify(enTranslations, null, 2) + "\n",
  );
  await writeText(
    path.join(workspacePath, "public", "__SERVER_URL__", "translations", "hi"),
    JSON.stringify(hiTranslations, null, 2) + "\n",
  );
  await writeText(
    path.join(workspacePath, "public", "__SERVER_URL__", "translations", "kn"),
    JSON.stringify(knTranslations, null, 2) + "\n",
  );
  await writeText(
    path.join(workspacePath, "public", "__SERVER_URL__", "translations", "es"),
    JSON.stringify(esTranslations, null, 2) + "\n",
  );

  // 5) Patch layout to include LingoProvider + overlay bridge + css import
  const layoutRaw = await readText(roots.layoutFile);
  const layoutNext = patchLayoutTsx(layoutRaw);
  if (layoutNext !== layoutRaw) {
    await writeText(roots.layoutFile, layoutNext);
  }

  // 5b) Sanitize root page.tsx if the imported zip contains stray top-level JSX.
  // Some zips ship a re-export page plus debugging JSX lines like <Button />, which breaks the build.
  for (const candidate of [path.join(roots.appDir, "page.tsx"), path.join(roots.appDir, "page.jsx")]) {
    if (!existsSync(candidate)) continue;
    try {
      const raw = await readText(candidate);
      const hasReExport = /export\s+\{\s*default\s*\}\s+from\s+["'][^"']+["']\s*;?/.test(raw);
      const hasTopLevelJsx = /^\s*<\w/m.test(raw);
      if (!hasReExport || !hasTopLevelJsx) continue;

      const exportLineMatch = raw.match(/export\s+\{\s*default\s*\}\s+from\s+["'][^"']+["']\s*;?/);
      const exportLine = exportLineMatch ? exportLineMatch[0] : 'export { default } from "./(home)/page";';
      await writeText(candidate, exportLine + "\n");
    } catch {
      // ignore
    }
  }

  // 6) Ensure dependency exists (dev server will run npm install)
  const pkgPath = path.join(workspacePath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(await readText(pkgPath)) as { dependencies?: Record<string, string> };
      pkg.dependencies = pkg.dependencies || {};
      if (!pkg.dependencies["@lingo.dev/compiler"]) {
        pkg.dependencies["@lingo.dev/compiler"] = "^0.3.8";
      }
      if (!pkg.dependencies["react-rnd"]) {
        pkg.dependencies["react-rnd"] = "^10.5.2";
      }
      await writeText(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    } catch {
      // ignore
    }
  }
}
