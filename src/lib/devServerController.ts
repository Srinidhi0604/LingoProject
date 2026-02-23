import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs/promises";
import { existsSync, readFileSync } from "fs";
import net from "net";

export interface DevServerConfig {
  workspacePath: string;
  port?: number;
  command?: string;
}

export interface DevServerStatus {
  running: boolean;
  port: number | null;
  url: string | null;
  pid: number | null;
  error: string | null;
  logs: string[];
}

class DevServerManager {
  private processes: Map<string, { process: ChildProcess; port: number }> = new Map();
  private statusMap: Map<string, DevServerStatus> = new Map();
  private logListeners: Map<string, Set<(log: string) => void>> = new Map();
  // The IDE itself typically runs on 3000; start imported-project dev servers at 3001.
  private portCounter = 3001;
  private preferredPort = 3001;

  private async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private getPidFilePath(workspacePath: string): string {
    return path.join(workspacePath, ".voxera", "devserver.json");
  }

  private async readPidFile(workspacePath: string): Promise<{ pid: number; port: number } | null> {
    const pidFile = this.getPidFilePath(workspacePath);
    if (!existsSync(pidFile)) return null;

    try {
      const raw = await fs.readFile(pidFile, "utf-8");
      const data = JSON.parse(raw) as { pid?: unknown; port?: unknown };
      const pid = typeof data.pid === "number" ? data.pid : null;
      const port = typeof data.port === "number" ? data.port : null;
      if (!pid || !port) return null;
      return { pid, port };
    } catch {
      return null;
    }
  }

  private async writePidFile(workspacePath: string, pid: number, port: number): Promise<void> {
    const pidFile = this.getPidFilePath(workspacePath);
    await fs.mkdir(path.dirname(pidFile), { recursive: true });
    await fs.writeFile(pidFile, JSON.stringify({ pid, port, updatedAt: Date.now() }, null, 2) + "\n", "utf-8");
  }

  private async removePidFile(workspacePath: string): Promise<void> {
    const pidFile = this.getPidFilePath(workspacePath);
    try {
      await fs.unlink(pidFile);
    } catch {
      // ignore
    }
  }

  private async killProcessTree(pid: number): Promise<void> {
    if (!pid) return;
    if (process.platform === "win32") {
      await new Promise<void>((resolve) => {
        const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { shell: true, stdio: "ignore" });
        killer.on("exit", () => resolve());
        killer.on("error", () => resolve());
      });
      return;
    }

    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // ignore
    }
  }

  private async findListeningPidOnPortWindows(port: number): Promise<number | null> {
    // netstat output: TCP    0.0.0.0:3001  ... LISTENING  12345
    return await new Promise<number | null>((resolve) => {
      const proc = spawn("netstat", ["-ano"], { shell: true, stdio: ["ignore", "pipe", "ignore"] });
      let out = "";
      proc.stdout?.on("data", (d) => {
        out += d.toString();
      });
      proc.on("exit", () => {
        const lines = out.split(/\r?\n/);
        for (const line of lines) {
          if (!line.includes(`:${port}`)) continue;
          if (!/LISTENING/i.test(line)) continue;
          const parts = line.trim().split(/\s+/);
          const pidPart = parts[parts.length - 1];
          const pid = Number(pidPart);
          if (Number.isFinite(pid) && pid > 0) {
            resolve(pid);
            return;
          }
        }
        resolve(null);
      });
      proc.on("error", () => resolve(null));
    });
  }

  private async getCommandLineWindows(pid: number): Promise<string> {
    return await new Promise<string>((resolve) => {
      const ps = spawn(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `try { (Get-CimInstance Win32_Process -Filter \"ProcessId=${pid}\").CommandLine } catch { '' }`,
        ],
        { shell: true, stdio: ["ignore", "pipe", "ignore"] }
      );
      let out = "";
      ps.stdout?.on("data", (d) => {
        out += d.toString();
      });
      ps.on("exit", () => resolve(out.trim()));
      ps.on("error", () => resolve(""));
    });
  }

  private async tryFreePreferredPortByInspection(workspacePath: string, addLog: (log: string) => void): Promise<void> {
    if (process.platform !== "win32") return;

    const pid = await this.findListeningPidOnPortWindows(this.preferredPort);
    if (!pid) return;

    const cmd = await this.getCommandLineWindows(pid);
    const normalizedCmd = cmd.toLowerCase();
    const normalizedWs = workspacePath.toLowerCase().replace(/\//g, "\\");

    // PowerShell/CIM output may wrap long command lines with newlines/spaces.
    const compactCmd = normalizedCmd.replace(/\s+/g, "");
    const compactWs = normalizedWs.replace(/\s+/g, "");

    // Only kill if it clearly points inside a Voxera-managed workspace and is a Next server start.
    // This is intentionally broader than a single workspaceId because port 3001 is shared.
    const looksLikeWorkspaceNext =
      (compactCmd.includes("\\workspaces\\ws_") || compactCmd.includes("/workspaces/ws_")) &&
      (compactCmd.includes("\\node_modules\\next\\") || compactCmd.includes("/node_modules/next/")) &&
      (compactCmd.includes("start-server") || compactCmd.includes("next"));

    if (!looksLikeWorkspaceNext) {
      addLog(`[SYS] Port ${this.preferredPort} is in use by PID ${pid}, but it doesn't look like a stale workspace Next server; leaving it alone.`);
      return;
    }

    addLog(`[SYS] Killing stale workspace Next server PID ${pid} on port ${this.preferredPort}`);
    await this.killProcessTree(pid);
    await this.sleep(500);
  }

  private async ensurePreferredPortAvailable(workspaceId: string, workspacePath: string, addLog: (log: string) => void): Promise<boolean> {
    if (process.platform === "win32") {
      const pid = await this.findListeningPidOnPortWindows(this.preferredPort);
      if (!pid) return true;
    } else {
      if (await this.isPortAvailable(this.preferredPort)) {
        return true;
      }
    }

    // 1) Try freeing via our pid-file first.
    await this.tryFreePreferredPort(workspaceId, workspacePath, addLog);
    await this.sleep(300);
    if (process.platform === "win32") {
      const pid = await this.findListeningPidOnPortWindows(this.preferredPort);
      if (!pid) return true;
    } else {
      if (await this.isPortAvailable(this.preferredPort)) {
        return true;
      }
    }

    // 2) If still blocked, inspect the listening PID and only kill if it is clearly a workspace Next server.
    await this.tryFreePreferredPortByInspection(workspacePath, addLog);
    await this.sleep(300);
    if (process.platform === "win32") {
      const pid = await this.findListeningPidOnPortWindows(this.preferredPort);
      if (!pid) return true;
    } else {
      if (await this.isPortAvailable(this.preferredPort)) {
        return true;
      }
    }

    return false;
  }

  private async tryFreePreferredPort(workspaceId: string, workspacePath: string, addLog: (log: string) => void): Promise<void> {
    const pidInfo = await this.readPidFile(workspacePath);
    if (!pidInfo) return;

    if (pidInfo.port !== this.preferredPort) return;

    // If our pid file says something is running on 3001, but our in-memory map doesn't,
    // it's likely a stale process from a previous IDE run.
    const tracked = this.processes.get(workspaceId);
    if (tracked?.port === this.preferredPort) return;

    addLog(`[SYS] Freeing stale dev server (PID ${pidInfo.pid}) on port ${pidInfo.port}`);
    await this.killProcessTree(pidInfo.pid);
    await this.removePidFile(workspacePath);
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    return await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.unref();

      server.once("error", () => {
        resolve(false);
      });

      server.listen({ port, host: "127.0.0.1" }, () => {
        server.close(() => resolve(true));
      });
    });
  }

  private async isPortListening(port: number): Promise<boolean> {
    return await new Promise<boolean>((resolve) => {
      const socket = net.connect({ port, host: "127.0.0.1" });
      const done = (ok: boolean) => {
        try {
          socket.destroy();
        } catch {
          // ignore
        }
        resolve(ok);
      };

      socket.once("connect", () => done(true));
      socket.once("error", () => done(false));
      setTimeout(() => done(false), 250);
    });
  }

  private async waitForPortListening(port: number, timeoutMs: number): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (await this.isPortListening(port)) return true;
      await this.sleep(250);
    }
    return false;
  }

  private async ensureDependenciesInstalled(
    workspacePath: string,
    env: NodeJS.ProcessEnv,
    addLog: (log: string) => void
  ): Promise<void> {
    const nodeModulesPath = path.join(workspacePath, "node_modules");
    if (existsSync(nodeModulesPath)) {
      return;
    }

    addLog("[SYS] node_modules not found; running npm install...");

    const runInstall = async (args: string[], label: string): Promise<void> => {
      addLog(`[SYS] Running npm ${label}...`);
      await new Promise<void>((resolve, reject) => {
        const installProcess: ChildProcess = spawn(
          "npm",
          args,
          {
            cwd: workspacePath,
            env,
            shell: true,
            stdio: "pipe" as const,
          }
        );

        let stderr = "";
        installProcess.stdout?.on("data", (data) => addLog(`[OUT] ${data.toString()}`));
        installProcess.stderr?.on("data", (data) => {
          const s = data.toString();
          stderr += s;
          addLog(`[ERR] ${s}`);
        });
        installProcess.on("error", (err) => reject(err));
        installProcess.on("exit", (code) => {
          if (code === 0) {
            resolve();
            return;
          }
          const err = new Error(`npm install failed with code ${code}`);
          (err as any).stderr = stderr;
          reject(err);
        });
      });
    };

    try {
      await runInstall(["install", "--no-audit", "--no-fund", "--prefer-offline"], "install");
    } catch (e) {
      const stderr = typeof (e as any)?.stderr === "string" ? (e as any).stderr : "";
      const looksLikeResolveIssue = /ERESOLVE|unable to resolve dependency tree/i.test(stderr);
      if (!looksLikeResolveIssue) throw e;
      addLog("[SYS] npm install hit a dependency resolution issue; retrying with --legacy-peer-deps...");
      await runInstall(
        ["install", "--no-audit", "--no-fund", "--prefer-offline", "--legacy-peer-deps"],
        "install (legacy peer deps)"
      );
    }

    addLog("[SYS] npm install completed");
  }

  private async ensureAppRouterScaffold(workspacePath: string, addLog: (log: string) => void): Promise<void> {
    // If a project contains an App Router directory, Next.js requires a Root Layout
    // with <html> and <body>. Some imported projects may be missing it or have it
    // at repo root, which breaks preview.
    const appDir = path.join(workspacePath, "app");
    const srcAppDir = path.join(workspacePath, "src", "app");

    const appRoot = existsSync(srcAppDir) ? srcAppDir : (existsSync(appDir) ? appDir : null);
    if (!appRoot) return;

    const layoutPath = path.join(appRoot, "layout.tsx");
    const pagePath = path.join(appRoot, "page.tsx");

    const globalsCandidates: string[] = [
      path.join(appRoot, "globals.css"),
      path.join(path.dirname(appRoot), "globals.css"), // e.g. src/globals.css
      path.join(workspacePath, "globals.css"),
    ];
    const globalsPath = globalsCandidates.find((p) => existsSync(p)) || null;

    if (!existsSync(layoutPath)) {
      const importLine = globalsPath
        ? `import "${path
            .relative(path.dirname(layoutPath), globalsPath)
            .replace(/\\/g, "/")
            .replace(/^(?!\.)/, "./")}";\n\n`
        : "";

      const content = `${importLine}export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang=\"en\">
      <body>{children}</body>
    </html>
  );
}
`;

      try {
        await fs.mkdir(path.dirname(layoutPath), { recursive: true });
        await fs.writeFile(layoutPath, content, "utf-8");
        addLog(`[SYS] Created missing Root Layout at ${layoutPath}`);
      } catch (e) {
        addLog(`[WARN] Failed to create Root Layout: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (!existsSync(pagePath)) {
      // If there's a legacy root page.tsx, alias it so preview still shows the imported app.
      const legacyRootPage = path.join(workspacePath, "page.tsx");
      const legacyExists = existsSync(legacyRootPage);
      const relToLegacy = legacyExists
        ? path
            .relative(path.dirname(pagePath), legacyRootPage)
            .replace(/\\/g, "/")
            .replace(/\.tsx$/, "")
            .replace(/^(?!\.)/, "./")
        : null;

      const homeGroupPage = path.join(appRoot, "(home)", "page.tsx");
      const hasHomeGroup = existsSync(homeGroupPage);
      const relToHomeGroup = hasHomeGroup
        ? path
            .relative(path.dirname(pagePath), homeGroupPage)
            .replace(/\\/g, "/")
            .replace(/\.tsx$/, "")
            .replace(/^(?!\.)/, "./")
        : null;

      const content = legacyExists && relToLegacy
        ? `export { default } from "${relToLegacy}";\n`
        : hasHomeGroup && relToHomeGroup
          ? `export { default } from "${relToHomeGroup}";\n`
        : `export default function Page() {\n  return (\n    <main style={{ padding: 24 }}>\n      <h1>Preview</h1>\n    </main>\n  );\n}\n`;

      try {
        await fs.mkdir(path.dirname(pagePath), { recursive: true });
        await fs.writeFile(pagePath, content, "utf-8");
        addLog(`[SYS] Created missing page at ${pagePath}`);
      } catch (e) {
        addLog(`[WARN] Failed to create page: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // If the root page exists but contains stray top-level JSX (common in demo zips), sanitize it.
    // Example broken pattern:
    //   export { default } from "./(home)/page";
    //   <Button />
    // which causes "Parsing ecmascript source code failed".
    try {
      const raw = await fs.readFile(pagePath, "utf-8");
      const hasReExport = /export\s+\{\s*default\s*\}\s+from\s+["'][^"']+["']\s*;?/.test(raw);
      const hasTopLevelJsx = /^\s*<\w/m.test(raw);
      if (hasReExport && hasTopLevelJsx) {
        const exportLineMatch = raw.match(/export\s+\{\s*default\s*\}\s+from\s+["'][^"']+["']\s*;?/);
        const exportLine = exportLineMatch ? exportLineMatch[0] : 'export { default } from "./(home)/page";';
        await fs.writeFile(pagePath, exportLine + "\n", "utf-8");
        addLog(`[SYS] Sanitized invalid root page JSX at ${pagePath}`);
      }
    } catch {
      // ignore
    }
  }

  async startServer(workspaceId: string, config: DevServerConfig): Promise<DevServerStatus> {
    if (this.processes.has(workspaceId)) {
      const existing = this.processes.get(workspaceId)!;
      return {
        running: true,
        port: existing.port,
        url: `http://localhost:${existing.port}`,
        pid: existing.process.pid ?? null,
        error: null,
        logs: [],
      };
    }

    const workspacePath = config.workspacePath;
    let port: number;

    if (typeof config.port === "number") {
      const available = await this.isPortAvailable(config.port);
      if (!available) {
        return {
          running: false,
          port: null,
          url: null,
          pid: null,
          error: `Port ${config.port} is already in use`,
          logs: [],
        };
      }
      port = config.port;
    } else {
      // Prefer a stable port for previews.
      const desiredPort = this.preferredPort;

      // If another workspace dev server we manage is holding the preferred port, stop it.
      const occupant = Array.from(this.processes.entries()).find(
        ([id, entry]) => id !== workspaceId && entry.port === desiredPort
      );
      if (occupant) {
        await this.stopServer(occupant[0]);
      }

      // Try to free 3001 deterministically before falling back.
      const ok = await this.ensurePreferredPortAvailable(workspaceId, workspacePath, (log) => {
        // no-op: we don't have per-request logs yet at this stage
        void log;
      });

      if (ok) {
        port = desiredPort;
      } else {
        // If the user insists on 3001 and it can't be freed, fail loudly instead of silently hopping ports.
        return {
          running: false,
          port: null,
          url: null,
          pid: null,
          error: `Port ${desiredPort} is already in use`,
          logs: [],
        };
      }
    }

    try {
      await fs.access(workspacePath);
    } catch {
      return {
        running: false,
        port: null,
        url: null,
        pid: null,
        error: `Workspace path does not exist: ${workspacePath}`,
        logs: [],
      };
    }

    const packageJsonPath = path.join(workspacePath, "package.json");
    if (!existsSync(packageJsonPath)) {
      return {
        running: false,
        port: null,
        url: null,
        pid: null,
        error: "No package.json found in workspace",
        logs: [],
      };
    }

    const logs: string[] = [];
    const logListeners = new Set<(log: string) => void>();
    this.logListeners.set(workspaceId, logListeners);

    return new Promise((resolve) => {
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        NODE_ENV: "development" as const,
        // Imported workspaces are often nested under a repo with other lockfiles.
        // Turbopack may infer the wrong root on Windows in this setup.
        // Force-disable Turbopack for workspace dev servers for stability.
        NEXT_DISABLE_TURBOPACK: "1",
      };

      // Next.js <= 11 uses webpack 4, which crashes on Node.js >= 17 unless the
      // legacy OpenSSL provider is enabled.
      try {
        const rawNodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
        if (rawNodeMajor >= 17) {
          const pkgRaw = readFileSync(packageJsonPath, "utf-8");
          const pkg = JSON.parse(pkgRaw) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
          };
          const nextRange = pkg.dependencies?.next ?? pkg.devDependencies?.next;
          const majorStr = (nextRange ?? "").replace(/^[^0-9]*/, "").split(".")[0];
          const nextMajor = Number.parseInt(majorStr || "0", 10);
          if (nextMajor > 0 && nextMajor <= 11) {
            const current = env.NODE_OPTIONS ?? "";
            if (!current.includes("--openssl-legacy-provider")) {
              env.NODE_OPTIONS = `${current} --openssl-legacy-provider`.trim();
            }
          }
        }
      } catch {
        // If anything goes wrong, skip this compatibility tweak.
      }

      let resolved = false;
      const startupLogs: string[] = [];
      let startupError: string | null = null;

      const addLog = (log: string) => {
        logs.push(log);
        startupLogs.push(log);
        logListeners.forEach(listener => listener(log));
      };

      // (No async fire-and-forget here) We await port freeing immediately before spawn.

      (async () => {
        try {
          await this.ensureAppRouterScaffold(workspacePath, addLog);
          await this.ensureDependenciesInstalled(workspacePath, env, addLog);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Dependency install failed";
          addLog(`[ERROR] ${msg}`);
          if (!resolved) {
            resolved = true;
            resolve({
              running: false,
              port: null,
              url: null,
              pid: null,
              error: msg,
              logs: startupLogs,
            });
          }
          return;
        }

        if (port === this.preferredPort) {
          const freed = await this.ensurePreferredPortAvailable(workspaceId, workspacePath, addLog);
          if (!freed) {
            startupError = `Port ${this.preferredPort} is already in use`;
            if (!resolved) {
              resolved = true;
              resolve({
                running: false,
                port: null,
                url: null,
                pid: null,
                error: startupError,
                logs: startupLogs,
              });
            }
            return;
          }
        }

        // Start Next dev server with an explicit port.
        // Note: `npm run dev -- -p <port>` is unreliable on some Windows shells and can drop flags,
        // causing Next to interpret `<port>` as a project directory.
        // Also: on Windows, spawning a .cmd directly with shell:false can throw EINVAL.
        let devProcess: ChildProcess;
        try {
          if (process.platform === "win32") {
            devProcess = spawn("cmd.exe", ["/c", "npx", "next", "dev", "--port", String(port)], {
              cwd: workspacePath,
              env,
              shell: false,
              stdio: "pipe" as const,
            });
          } else {
            devProcess = spawn("npx", ["next", "dev", "--port", String(port)], {
              cwd: workspacePath,
              env,
              shell: false,
              stdio: "pipe" as const,
            });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Failed to spawn dev server";
          addLog(`[ERROR] ${msg}`);
          if (!resolved) {
            resolved = true;
            resolve({
              running: false,
              port: null,
              url: null,
              pid: null,
              error: msg,
              logs: startupLogs,
            });
          }
          return;
        }

        // Fallback readiness detection: if the port is listening, consider the server started
        // even if Next.js log output format changes.
        void (async () => {
          const ok = await this.waitForPortListening(port, 60000);
          if (!ok) return;
          if (resolved) return;

          resolved = true;
          this.processes.set(workspaceId, { process: devProcess, port });
          if (devProcess.pid) {
            void this.writePidFile(workspacePath, devProcess.pid, port);
          }

          const status: DevServerStatus = {
            running: true,
            port,
            url: `http://localhost:${port}`,
            pid: devProcess.pid ?? null,
            error: null,
            logs: startupLogs,
          };
          this.statusMap.set(workspaceId, status);
          resolve(status);
        })();

        devProcess.stdout?.on("data", (data) => {
          const log = data.toString();
          addLog(`[OUT] ${log}`);

          if (log.includes("EADDRINUSE") || log.toLowerCase().includes("address already in use")) {
            startupError = `Port ${port} is already in use`;
            if (!resolved) {
              resolved = true;
              this.processes.delete(workspaceId);
              resolve({
                running: false,
                port: null,
                url: null,
                pid: null,
                error: startupError,
                logs: startupLogs,
              });
            }
            try {
              devProcess.kill();
            } catch {
              // ignore
            }
            return;
          }

          if (!resolved && (log.includes("Ready") || log.includes("Local:") || log.includes("ready - started server"))) {
            resolved = true;
            this.processes.set(workspaceId, { process: devProcess, port });

            if (devProcess.pid) {
              void this.writePidFile(workspacePath, devProcess.pid, port);
            }

            const status: DevServerStatus = {
              running: true,
              port,
              url: `http://localhost:${port}`,
              pid: devProcess.pid ?? null,
              error: null,
              logs: startupLogs,
            };

            this.statusMap.set(workspaceId, status);
            resolve(status);
          }
        });

        devProcess.stderr?.on("data", (data) => {
          const log = data.toString();
          addLog(`[ERR] ${log}`);

          if (log.includes("EADDRINUSE") || log.toLowerCase().includes("address already in use")) {
            startupError = `Port ${port} is already in use`;
            if (!resolved) {
              resolved = true;
              resolve({
                running: false,
                port: null,
                url: null,
                pid: null,
                error: startupError,
                logs: startupLogs,
              });
            }
            try {
              devProcess.kill();
            } catch {
              // ignore
            }
          }
        });

        devProcess.on("error", (err) => {
          addLog(`[ERROR] ${err.message}`);
          if (!resolved) {
            resolved = true;
            resolve({
              running: false,
              port: null,
              url: null,
              pid: null,
              error: err.message,
              logs: startupLogs,
            });
          }
        });

        devProcess.on("exit", (code) => {
          addLog(`[EXIT] Process exited with code ${code}`);
          this.processes.delete(workspaceId);
          void this.removePidFile(workspacePath);

          const currentStatus = this.statusMap.get(workspaceId);
          if (currentStatus) {
            this.statusMap.set(workspaceId, {
              ...currentStatus,
              running: false,
              pid: null,
              error: startupError || (code !== 0 ? `Process exited with code ${code}` : null),
            });
          }

          if (!resolved) {
            resolved = true;
            resolve({
              running: false,
              port: null,
              url: null,
              pid: null,
              error: startupError || `Process exited with code ${code}`,
              logs: startupLogs,
            });
          }
        });

        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            startupError = startupError || "Dev server start timed out";
            resolve({
              running: false,
              port: null,
              url: null,
              pid: null,
              error: startupError,
              logs: startupLogs,
            });

            try {
              devProcess.kill();
            } catch {
              // ignore
            }
          }
        }, 60000);
      })();
    });
  }

  async stopServer(workspaceId: string, workspacePath?: string): Promise<boolean> {
    const entry = this.processes.get(workspaceId);
    if (!entry) {
      // Try to stop a stale dev server from a previous run.
      if (workspacePath) {
        const pidInfo = await this.readPidFile(workspacePath);
        if (pidInfo?.pid) {
          await this.killProcessTree(pidInfo.pid);
          await this.removePidFile(workspacePath);
          return true;
        }
      }
      return false;
    }

    return new Promise((resolve) => {
      const cleanup = () => {
        this.processes.delete(workspaceId);
        this.statusMap.delete(workspaceId);
        this.logListeners.delete(workspaceId);
        if (workspacePath) {
          void this.removePidFile(workspacePath);
        }
        resolve(true);
      };

      entry.process.on("exit", cleanup);

      // On Windows, SIGTERM often doesn't kill the underlying process tree when using shell.
      // Use taskkill to ensure the port is actually freed.
      if (process.platform === "win32" && entry.process.pid) {
        const killer = spawn("taskkill", ["/PID", String(entry.process.pid), "/T", "/F"], {
          shell: true,
          stdio: "ignore",
        });
        killer.on("exit", cleanup);
      } else {
        try {
          entry.process.kill("SIGTERM");
        } catch {
          // ignore
        }
      }

      setTimeout(() => {
        if (this.processes.has(workspaceId)) {
          try {
            entry.process.kill("SIGKILL");
          } catch {
            // ignore
          }
        }
        resolve(true);
      }, 5000);
    });
  }

  async restartServer(workspaceId: string, config: DevServerConfig): Promise<DevServerStatus> {
    const existingPort =
      config.port ??
      this.processes.get(workspaceId)?.port ??
      this.statusMap.get(workspaceId)?.port ??
      this.preferredPort;

    await this.stopServer(workspaceId);
    return this.startServer(workspaceId, { ...config, port: existingPort });
  }

  getStatus(workspaceId: string): DevServerStatus {
    return this.statusMap.get(workspaceId) || {
      running: false,
      port: null,
      url: null,
      pid: null,
      error: null,
      logs: [],
    };
  }

  subscribeToLogs(workspaceId: string, listener: (log: string) => void): () => void {
    if (!this.logListeners.has(workspaceId)) {
      this.logListeners.set(workspaceId, new Set());
    }
    
    this.logListeners.get(workspaceId)!.add(listener);
    
    return () => {
      this.logListeners.get(workspaceId)?.delete(listener);
    };
  }

  private async findAvailablePort(startPort: number = this.portCounter): Promise<number> {
    const usedPorts = new Set(Array.from(this.processes.values()).map((p) => p.port));
    let port = Math.max(startPort, 3001);

    // Try a bounded range to avoid looping forever.
    for (let attempts = 0; attempts < 1000; attempts++) {
      if (port === 3000) {
        port++;
        continue;
      }

      if (!usedPorts.has(port) && (await this.isPortAvailable(port))) {
        this.portCounter = port + 1;
        return port;
      }

      port++;
      if (port > 3999) {
        port = 3001;
      }
    }

    // Fallback (should be rare): still avoid 3000.
    return 3001;
  }

  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.processes.keys()).map(id => this.stopServer(id));
    await Promise.all(stopPromises);
  }
}

export const devServerManager = new DevServerManager();
