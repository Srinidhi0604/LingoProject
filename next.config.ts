import type { NextConfig } from "next";
import { withLingo } from "@lingo.dev/compiler/next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
};

export default async function createNextConfig(): Promise<NextConfig> {
  return await withLingo(nextConfig, {
    sourceRoot: "./src/app",
    sourceLocale: "en",
    targetLocales: ["kn", "hi", "es"],
    models: "lingo.dev",
    dev: {
      usePseudotranslator: false,
    },
    widget: false,
  });
}

