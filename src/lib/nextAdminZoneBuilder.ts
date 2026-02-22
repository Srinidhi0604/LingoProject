import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

async function readText(filePath: string): Promise<string> {
  return await fs.readFile(filePath, "utf-8");
}

async function writeText(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}

async function copyFileSafe(src: string, dest: string): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function copyDirRecursive(srcDir: string, destDir: string): Promise<void> {
  if (!existsSync(srcDir)) return;
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(src, dest);
    } else if (entry.isFile()) {
      await copyFileSafe(src, dest);
    }
  }
}

function looksLikeNextAdmin(workspacePath: string): boolean {
  const marker1 = path.join(workspacePath, "src", "components", "Layouts", "sidebar", "index.tsx");
  const marker2 = path.join(workspacePath, "src", "app", "layout.tsx");
  const marker3 = path.join(workspacePath, "src", "components", "Layouts", "header", "index.tsx");
  return existsSync(marker1) && existsSync(marker2) && existsSync(marker3);
}

const FILES: Record<string, string> = {
  "src/voxera/builder/types.ts": `export type ZoneId =\n  | \"sidebar\"\n  | \"header\"\n  | \"content\"\n  | \"metrics\"\n  | \"charts\"\n  | \"calendar\"\n  | \"forms\";\n\nexport type ZoneLayout = {\n  x: number;\n  y: number;\n  width: number;\n  height: number;\n};\n\nexport type ZoneSchemaNode = {\n  id: ZoneId;\n  type: \"Zone\";\n  title: string;\n  layout: ZoneLayout;\n};\n\nexport type ZoneSchema = {\n  version: 1;\n  routeKey: string;\n  nodes: ZoneSchemaNode[];\n};\n\nexport type ZoneSelection = {\n  zoneId: ZoneId;\n};\n\nexport type VoxeraBuilderToParentMessage =\n  | { type: \"voxera:ready\"; routeKey: string; schema: ZoneSchema }\n  | { type: \"voxera:zoneSelected\"; routeKey: string; selection: ZoneSelection | null }\n  | { type: \"voxera:schemaChanged\"; routeKey: string; schema: ZoneSchema };\n\nexport type VoxeraParentToBuilderMessage =\n  | { type: \"voxera:setSchema\"; routeKey: string; schema: ZoneSchema }\n  | { type: \"voxera:setSelection\"; routeKey: string; selection: ZoneSelection | null }\n  | { type: \"voxera:setZoneLayout\"; routeKey: string; zoneId: ZoneId; layout: ZoneLayout };\n`,

  "src/voxera/builder/storage.ts": `import type { ZoneSchema } from \"./types\";\n\nfunction storageKey(routeKey: string): string {\n  return \`voxera.zoneSchema.\${routeKey}\`;\n}\n\nexport function loadSchema(routeKey: string): ZoneSchema | null {\n  if (typeof window === \"undefined\") return null;\n  try {\n    const raw = window.localStorage.getItem(storageKey(routeKey));\n    if (!raw) return null;\n    const parsed = JSON.parse(raw) as ZoneSchema;\n    if (parsed?.version !== 1 || parsed.routeKey !== routeKey || !Array.isArray(parsed.nodes)) {\n      return null;\n    }\n    return parsed;\n  } catch {\n    return null;\n  }\n}\n\nexport function saveSchema(schema: ZoneSchema): void {\n  if (typeof window === \"undefined\") return;\n  try {\n    window.localStorage.setItem(storageKey(schema.routeKey), JSON.stringify(schema));\n  } catch {\n    // ignore\n  }\n}\n`,

  "src/voxera/builder/throttle.ts": `export function rafThrottle<T extends (...args: any[]) => void>(fn: T): T {\n  let scheduled = false;\n  let lastArgs: unknown[] | null = null;\n\n  const wrapped = ((...args: unknown[]) => {\n    lastArgs = args;\n    if (scheduled) return;\n    scheduled = true;\n\n    requestAnimationFrame(() => {\n      scheduled = false;\n      const callArgs = lastArgs;\n      lastArgs = null;\n      if (!callArgs) return;\n      (fn as (...a: unknown[]) => void)(...callArgs);\n    });\n  }) as T;\n\n  return wrapped;\n}\n`,

  "src/voxera/builder/builder.css": `.voxera-zone {\n  outline: 1px solid rgba(99, 102, 241, 0.25);\n  background: rgba(255, 255, 255, 0.001);\n}\n\n.voxera-zone-selected {\n  outline: 2px solid rgba(99, 102, 241, 0.9);\n  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);\n}\n\n.voxera-zone-handle {\n  cursor: grab;\n}\n\n.voxera-zone-handle:active {\n  cursor: grabbing;\n}\n\n.voxera-canvas {\n  background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 0);\n  background-size: 18px 18px;\n  background-position: -1px -1px;\n}\n`,

  "src/voxera/builder/VisualCanvas.tsx": `\"use client\";\n\nexport function VisualCanvas({ children }: { children: React.ReactNode }) {\n  return (\n    <div\n      className=\"voxera-canvas\"\n      style={{\n        position: \"relative\",\n        width: \"100%\",\n        height: \"100vh\",\n        overflow: \"hidden\",\n        background: \"transparent\",\n      }}\n    >\n      {children}\n    </div>\n  );\n}\n`,

  "src/voxera/builder/ZoneNode.tsx": `\"use client\";\n\nimport { Rnd } from \"react-rnd\";\nimport { rafThrottle } from \"./throttle\";\nimport type { ZoneLayout, ZoneSchemaNode } from \"./types\";\n\ntype Props = {\n  node: ZoneSchemaNode;\n  selected: boolean;\n  onSelect: (id: ZoneSchemaNode[\"id\"]) => void;\n  onLayoutChange: (id: ZoneSchemaNode[\"id\"], layout: ZoneLayout) => void;\n  children: React.ReactNode;\n};\n\nexport function ZoneNode({ node, selected, onSelect, onLayoutChange, children }: Props) {\n  const { layout } = node;\n\n  const pushLayout = rafThrottle((next: ZoneLayout) => {\n    onLayoutChange(node.id, next);\n  });\n\n  return (\n    <Rnd\n      bounds=\"parent\"\n      position={{ x: layout.x, y: layout.y }}\n      size={{ width: layout.width, height: layout.height }}\n      onMouseDown={() => onSelect(node.id)}\n      enableResizing\n      dragHandleClassName=\"voxera-zone-handle\"\n      onDrag={(e, d) => {\n        e.preventDefault();\n        pushLayout({ ...layout, x: d.x, y: d.y });\n      }}\n      onDragStop={(e, d) => {\n        e.preventDefault();\n        onLayoutChange(node.id, { ...layout, x: d.x, y: d.y });\n      }}\n      onResize={(e, direction, ref, delta, position) => {\n        e.preventDefault();\n        pushLayout({\n          x: position.x,\n          y: position.y,\n          width: ref.offsetWidth,\n          height: ref.offsetHeight,\n        });\n      }}\n      onResizeStop={(e, direction, ref, delta, position) => {\n        e.preventDefault();\n        onLayoutChange(node.id, {\n          x: position.x,\n          y: position.y,\n          width: ref.offsetWidth,\n          height: ref.offsetHeight,\n        });\n      }}\n      style={{\n        zIndex: selected ? 50 : 1,\n        borderRadius: 10,\n        overflow: \"hidden\",\n      }}\n      className={selected ? \"voxera-zone-selected\" : \"voxera-zone\"}\n    >\n      <div className=\"relative h-full w-full\">\n        <div className=\"voxera-zone-handle absolute left-2 top-2 z-10 select-none rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white\">\n          {node.title}\n        </div>\n        <div className=\"h-full w-full\">{children}</div>\n      </div>\n    </Rnd>\n  );\n}\n`,
};

// NOTE: defaults.ts, SchemaRenderer.tsx, layout/page patches are applied below using
// concrete file overwrites from the workspace's own copies. This keeps the hackathon
// layer deterministic for NextAdmin.

export async function applyNextAdminZoneBuilder(workspacePath: string): Promise<void> {
  if (!looksLikeNextAdmin(workspacePath)) return;

  // Prefer copying the full, validated overlay from an existing reference workspace.
  // This keeps the hackathon layer deterministic without embedding huge templates.
  try {
    const workspacesRoot = path.join(process.cwd(), "workspaces");
    if (existsSync(workspacesRoot)) {
      const candidates = await fs.readdir(workspacesRoot, { withFileTypes: true });
      const reference = candidates
        .filter((e) => e.isDirectory())
        .map((e) => path.join(workspacesRoot, e.name))
        .find((p) => existsSync(path.join(p, "src", "voxera", "builder", "VoxeraLayoutShell.tsx")));

      if (reference) {
        await copyDirRecursive(
          path.join(reference, "src", "voxera", "builder"),
          path.join(workspacePath, "src", "voxera", "builder"),
        );

        const overwriteFiles = [
          ["src/app/layout.tsx"],
          ["src/app/(home)/page.tsx"],
          ["src/app/calendar/page.tsx"],
          ["src/app/forms/form-elements/page.tsx"],
          ["src/app/forms/form-layout/page.tsx"],
          ["src/app/charts/basic-chart/page.tsx"],
        ];

        for (const [rel] of overwriteFiles) {
          const src = path.join(reference, ...rel.split("/"));
          const dest = path.join(workspacePath, ...rel.split("/"));
          if (existsSync(src)) {
            await copyFileSafe(src, dest);
          }
        }

        // Ensure react-rnd dependency.
        const pkgPath = path.join(workspacePath, "package.json");
        try {
          const raw = await readText(pkgPath);
          const pkg = JSON.parse(raw) as any;
          pkg.dependencies = pkg.dependencies || {};
          if (!pkg.dependencies["react-rnd"]) {
            pkg.dependencies["react-rnd"] = "^10.5.2";
            await writeText(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
          }
        } catch {
          // ignore
        }

        return;
      }
    }
  } catch {
    // ignore and fall back
  }

  // Fallback: minimal embedded runtime (layout/page patches not included).
  for (const [rel, content] of Object.entries(FILES)) {
    const full = path.join(workspacePath, ...toPosix(rel).split("/"));
    if (!existsSync(full)) await writeText(full, content);
  }

  // 2) Ensure react-rnd dependency.
  const pkgPath = path.join(workspacePath, "package.json");
  try {
    const raw = await readText(pkgPath);
    const pkg = JSON.parse(raw) as any;
    pkg.dependencies = pkg.dependencies || {};
    if (!pkg.dependencies["react-rnd"]) {
      pkg.dependencies["react-rnd"] = "^10.5.2";
      await writeText(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    }
  } catch {
    // ignore
  }

  // 3) No further patches in fallback mode.
}
