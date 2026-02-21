import { Component } from "@/types/intent";

export interface ExportFile {
  path: string;
  content: string;
  type: "text" | "json";
}

export interface ExportManifest {
  name: string;
  version: string;
  generatedAt: string;
  componentCount: number;
  files: ExportFile[];
}

export function sortProps(props: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(props).sort();
  for (const key of keys) {
    sorted[key] = props[key];
  }
  return sorted;
}

export function escapeJsxText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function propsToJsxString(props: Record<string, unknown>): string {
  const sortedProps = sortProps(props);
  const entries = Object.entries(sortedProps);
  if (entries.length === 0) return "";

  return entries
    .filter(([key]) => key !== "children" && key !== "text")
    .map(([key, value]) => {
      if (key === "className" && typeof value === "string") {
        return ` className="${value}"`;
      }
      if (typeof value === "string") {
        return ` ${key}="${escapeJsxText(value)}"`;
      }
      if (typeof value === "number") {
        return ` ${key}={${value}}`;
      }
      if (typeof value === "boolean") {
        return value ? ` ${key}` : "";
      }
      return "";
    })
    .join("");
}

export function componentToJsx(component: Component, indentLevel: number = 2): string {
  const indent = " ".repeat(indentLevel);
  const { type, props, children } = component;

  const sortedProps = sortProps(props || {});
  const propsString = propsToJsxString(sortedProps);
  const textContent = typeof sortedProps.text === "string" ? sortedProps.text : "";
  const hasChildren = children && children.length > 0;

  const selfClosingTypes = ["input", "checkbox", "radio", "image"];

  if (type === "image") {
    return `${indent}<img${propsString} alt="${sortedProps.alt || ""}" />`;
  }

  if (selfClosingTypes.includes(type)) {
    return `${indent}<${type}${propsString} />`;
  }

  if (type === "heading") {
    const level = (sortedProps.level as number) || 1;
    const tag = `h${level}`;
    if (hasChildren) {
      const childrenJsx = children.map((c) => componentToJsx(c, indentLevel + 2)).join("\n");
      return `${indent}<${tag}${propsString}>\n${childrenJsx}\n${indent}</${tag}>`;
    }
    return `${indent}<${tag}${propsString}>${escapeJsxText(textContent)}</${tag}>`;
  }

  if (type === "text" || type === "span") {
    if (hasChildren) {
      const childrenJsx = children.map((c) => componentToJsx(c, indentLevel + 2)).join("\n");
      return `${indent}<span${propsString}>\n${childrenJsx}\n${indent}</span>`;
    }
    return `${indent}<span${propsString}>${escapeJsxText(textContent)}</span>`;
  }

  if (type === "paragraph") {
    if (hasChildren) {
      const childrenJsx = children.map((c) => componentToJsx(c, indentLevel + 2)).join("\n");
      return `${indent}<p${propsString}>\n${childrenJsx}\n${indent}</p>`;
    }
    return `${indent}<p${propsString}>${escapeJsxText(textContent)}</p>`;
  }

  if (type === "link") {
    if (hasChildren) {
      const childrenJsx = children.map((c) => componentToJsx(c, indentLevel + 2)).join("\n");
      return `${indent}<a${propsString}>\n${childrenJsx}\n${indent}</a>`;
    }
    return `${indent}<a${propsString}>${escapeJsxText(textContent)}</a>`;
  }

  if (type === "list") {
    const childrenJsx = children.map((c) => componentToJsx(c, indentLevel + 2)).join("\n");
    return `${indent}<ul${propsString}>\n${childrenJsx}\n${indent}</ul>`;
  }

  if (type === "listItem") {
    if (hasChildren) {
      const childrenJsx = children.map((c) => componentToJsx(c, indentLevel + 2)).join("\n");
      return `${indent}<li${propsString}>\n${childrenJsx}\n${indent}</li>`;
    }
    return `${indent}<li${propsString}>${escapeJsxText(textContent)}</li>`;
  }

  const tag = type === "container" || type === "card" ? "div" : type;

  if (hasChildren) {
    const childrenJsx = children.map((c) => componentToJsx(c, indentLevel + 2)).join("\n");
    return `${indent}<${tag}${propsString}>\n${childrenJsx}\n${indent}</${tag}>`;
  }

  if (textContent) {
    return `${indent}<${tag}${propsString}>${escapeJsxText(textContent)}</${tag}>`;
  }

  return `${indent}<${tag}${propsString} />`;
}

function sortComponentsById(components: Component[]): Component[] {
  return [...components].sort((a, b) => a.id.localeCompare(b.id));
}

export function generatePageCode(components: Component[]): string {
  const sortedComponents = sortComponentsById(components);
  const componentsJsx = sortedComponents
    .map((c) => componentToJsx(c, 4))
    .join("\n");

  return `export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
${componentsJsx || '      <p>No components</p>'}
    </main>
  );
}
`;
}

export function generateLayoutCode(): string {
  return `import type { Metadata } from "next";
import { LingoProvider } from "@lingo.dev/compiler/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Exported Application",
  description: "Generated by Voice-Native Runtime",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LingoProvider>
      <html lang="en">
        <body className="antialiased">{children}</body>
      </html>
    </LingoProvider>
  );
}
`;
}

export function generateGlobalsCss(): string {
  return `@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: system-ui, -apple-system, sans-serif;
}
`;
}

export function generatePackageJson(): string {
  const pkg = {
    name: "exported-app",
    version: "1.0.0",
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint",
      "lingo:run": "lingo.dev run",
      "lingo:frozen": "lingo.dev run --frozen",
      "localize": "npm run lingo:run && npm run build",
    },
    dependencies: {
      next: "15.1.6",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
      "@lingo.dev/compiler": "^0.3.8",
    },
    devDependencies: {
      "@types/node": "^20",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      typescript: "^5",
      tailwindcss: "^4",
      postcss: "^8",
      eslint: "^9",
      "eslint-config-next": "15.1.6",
      "lingo.dev": "^0.131.0",
    },
  };

  return JSON.stringify(pkg, null, 2) + "\n";
}

export function generateNextConfig(): string {
  return `import type { NextConfig } from "next";
import { withLingo } from "@lingo.dev/compiler/next";

const nextConfig: NextConfig = {};

export default async function (): Promise<NextConfig> {
  return await withLingo(nextConfig, {
    sourceLocale: "en",
    targetLocales: ["kn", "hi"],
    models: "lingo.dev",
  });
}
`;
}

export function generateLingoConfig(): string {
  return `import { defineConfig } from "@lingo.dev/compiler";

export default defineConfig({
  defaultLocale: "en",
  locales: ["en", "kn", "hi"],
});
`;
}

export function generateI18nConfig(): string {
  const config = {
    version: 1,
    defaultLocale: "en",
    locales: ["en", "kn", "hi"],
    bucket: {
      adapter: "vercel-blob",
    },
    source: {
      adapter: "next-js",
      include: ["app/**/*.{tsx,ts,jsx,js}"],
      exclude: ["app/api/**", "node_modules/**"],
    },
    storage: {
      adapter: "vercel-blob",
    },
    rules: [
      {
        patterns: ["**/*.tsx"],
        extract: "jsx-text",
      },
    ],
  };

  return JSON.stringify(config, null, 2) + "\n";
}

export function generateI18nLock(): string {
  return JSON.stringify({ version: 1, entries: {} }, null, 2) + "\n";
}

export function generateTsConfig(): string {
  const tsconfig = {
    compilerOptions: {
      target: "ES2017",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: {
        "@/*": ["./*"],
      },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  };

  return JSON.stringify(tsconfig, null, 2) + "\n";
}

export function generatePostcssConfig(): string {
  return `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
  },
};

export default config;
`;
}

export function generateEnvExample(): string {
  return `# Lingo.dev API Key (required for translations)
LINGODOTDEV_API_KEY=your_api_key_here

# Build mode: "translate" or "cache-only"
# Use "translate" for development to generate new translations
# Use "cache-only" for production builds (no API calls)
LINGO_BUILD_MODE=translate
`;
}

export function generateReadme(): string {
  return `# Exported Application

This project was generated by Voice-Native Runtime.

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Set up environment variables:
   - Copy \`.env.example\` to \`.env.local\`
   - Add your Lingo.dev API key

3. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

4. Open [http://localhost:3000](http://localhost:3000)

## Localization

This project uses Lingo.dev for localization with both compiler and CLI support.

### Compiler Localization (UI Components)

The Lingo.dev compiler automatically handles localization of JSX text in your React components. No runtime translation is needed.

Configuration: \`lingo.config.ts\`
Integration: \`next.config.ts\`

### CLI Localization (Static Content)

For static content (markdown, JSON, etc.), use the Lingo.dev CLI:

\`\`\`bash
# Generate translations
npm run lingo:run

# Frozen mode (CI/CD - fails if new translations needed)
npm run lingo:frozen

# Full localize and build
npm run localize
\`\`\`

Configuration: \`i18n.json\`
State tracking: \`i18n.lock\`

### Supported Locales

- English (en) - default
- Kannada (kn)
- Hindi (hi)

## Build

\`\`\`bash
npm run build
\`\`\`

## Project Structure

\`\`\`
├── app/
│   ├── page.tsx        # Main page component
│   ├── layout.tsx      # Root layout with LingoProvider
│   └── globals.css     # Global styles
├── lingo.config.ts     # Compiler configuration
├── i18n.json           # CLI configuration
├── next.config.ts      # Next.js + Lingo integration
└── package.json        # Dependencies and scripts
\`\`\`

## License

Private project.
`;
}

export function generateGitignore(): string {
  return `# dependencies
/node_modules
/.pnp
.pnp.*
.yarn/*

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# env files
.env
.env.local
.env.*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

# lingo.dev
.lingo/
i18n.lock
`;
}

export function generateNextEnv(): string {
  return `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`;
}

export function generateEslintConfig(): string {
  return `import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
`;
}

export function exportProject(components: Component[]): ExportManifest {
  const sortedComponents = sortComponentsById(components);

  const files: ExportFile[] = [
    { path: "app/page.tsx", content: generatePageCode(sortedComponents), type: "text" },
    { path: "app/layout.tsx", content: generateLayoutCode(), type: "text" },
    { path: "app/globals.css", content: generateGlobalsCss(), type: "text" },
    { path: "package.json", content: generatePackageJson(), type: "json" },
    { path: "next.config.ts", content: generateNextConfig(), type: "text" },
    { path: "lingo.config.ts", content: generateLingoConfig(), type: "text" },
    { path: "i18n.json", content: generateI18nConfig(), type: "json" },
    { path: "i18n.lock", content: generateI18nLock(), type: "json" },
    { path: "tsconfig.json", content: generateTsConfig(), type: "json" },
    { path: "postcss.config.mjs", content: generatePostcssConfig(), type: "text" },
    { path: ".env.example", content: generateEnvExample(), type: "text" },
    { path: ".gitignore", content: generateGitignore(), type: "text" },
    { path: "next-env.d.ts", content: generateNextEnv(), type: "text" },
    { path: "eslint.config.mjs", content: generateEslintConfig(), type: "text" },
    { path: "README.md", content: generateReadme(), type: "text" },
  ];

  return {
    name: "exported-app",
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    componentCount: sortedComponents.length,
    files,
  };
}
