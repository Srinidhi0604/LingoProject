import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

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
  private portCounter = 3000;

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

    await new Promise<void>((resolve, reject) => {
      const installProcess: ChildProcess = spawn("npm", ["install"], {
        cwd: workspacePath,
        env,
        shell: true,
        stdio: "pipe" as const,
      });

      installProcess.stdout?.on("data", (data) => addLog(`[OUT] ${data.toString()}`));
      installProcess.stderr?.on("data", (data) => addLog(`[ERR] ${data.toString()}`));
      installProcess.on("error", (err) => reject(err));
      installProcess.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`npm install failed with code ${code}`));
      });
    });

    addLog("[SYS] npm install completed");
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

    const port = config.port || this.findAvailablePort();
    const workspacePath = config.workspacePath;

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
      };

      let resolved = false;
      const startupLogs: string[] = [];

      const addLog = (log: string) => {
        logs.push(log);
        startupLogs.push(log);
        logListeners.forEach(listener => listener(log));
      };

      (async () => {
        try {
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

        // Explicitly pass port to next dev via npm's argv forwarding.
        const devProcess: ChildProcess = spawn("npm", ["run", "dev", "--", "-p", String(port)], {
          cwd: workspacePath,
          env,
          shell: true,
          stdio: "pipe" as const,
        });

        devProcess.stdout?.on("data", (data) => {
          const log = data.toString();
          addLog(`[OUT] ${log}`);

          if (!resolved && (log.includes("Ready") || log.includes("Local:") || log.includes("ready - started server"))) {
            resolved = true;
            this.processes.set(workspaceId, { process: devProcess, port });

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

          const currentStatus = this.statusMap.get(workspaceId);
          if (currentStatus) {
            this.statusMap.set(workspaceId, {
              ...currentStatus,
              running: false,
              pid: null,
              error: code !== 0 ? `Process exited with code ${code}` : null,
            });
          }
        });

        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.processes.set(workspaceId, { process: devProcess, port });

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
        }, 15000);
      })();
    });
  }

  async stopServer(workspaceId: string): Promise<boolean> {
    const entry = this.processes.get(workspaceId);
    if (!entry) return false;

    return new Promise((resolve) => {
      entry.process.on("exit", () => {
        this.processes.delete(workspaceId);
        this.statusMap.delete(workspaceId);
        this.logListeners.delete(workspaceId);
        resolve(true);
      });

      entry.process.kill("SIGTERM");

      setTimeout(() => {
        if (this.processes.has(workspaceId)) {
          entry.process.kill("SIGKILL");
        }
        resolve(true);
      }, 5000);
    });
  }

  async restartServer(workspaceId: string, config: DevServerConfig): Promise<DevServerStatus> {
    await this.stopServer(workspaceId);
    return this.startServer(workspaceId, config);
  }

  getStatus(workspaceId: string): DevServerStatus {
    return this.statusMap.get(workspaceId) || {
      running: false,
      port: null,
      url: null,
      pid: null,
      error: "Server not started",
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

  private findAvailablePort(): number {
    const usedPorts = Array.from(this.processes.values()).map(p => p.port);
    let port = this.portCounter;
    
    while (usedPorts.includes(port)) {
      port++;
      if (port > 4000) {
        port = 3000;
      }
    }
    
    this.portCounter = port + 1;
    return port;
  }

  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.processes.keys()).map(id => this.stopServer(id));
    await Promise.all(stopPromises);
  }
}

export const devServerManager = new DevServerManager();
