#!/usr/bin/env node
/**
 * Unified Render start — Prisma migrate, NestJS API, Next.js web, reverse proxy on PORT.
 *
 * Routes:
 *   /api/*       → NestJS (INTERNAL_API_PORT)
 *   /socket.io/* → NestJS (WebSocket / Socket.IO)
 *   /*           → Next.js (INTERNAL_WEB_PORT)
 */
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import httpProxy from "http-proxy";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_PORT = Number(process.env.PORT || 10000);
const API_PORT = Number(process.env.INTERNAL_API_PORT || 4001);
const WEB_PORT = Number(process.env.INTERNAL_WEB_PORT || 3001);

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function spawnDetached(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  child.on("error", (error) => {
    console.error(`[render] Failed to start ${command}:`, error.message);
    process.exit(1);
  });
  return child;
}

async function migrateDeploy() {
  try {
    await run("npm", ["run", "db:deploy"]);
  } catch {
    console.warn("[render] migrate deploy failed — attempting P3009 recovery...");
    await run("npm", ["run", "db:resolve-failed-init"]);
    await run("npm", ["run", "db:deploy"]);
  }
}

function isApiPath(url = "") {
  return url.startsWith("/api/") || url.startsWith("/socket.io");
}

function waitForServer(port, label, healthPath = "/", attempts = 60) {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const tick = () => {
      tries += 1;
      const req = http.get(`http://127.0.0.1:${port}${healthPath}`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 500) {
          retry();
          return;
        }
        resolve(undefined);
      });
      const retry = () => {
        if (tries >= attempts) {
          reject(new Error(`${label} did not become ready on port ${port}`));
          return;
        }
        setTimeout(tick, 1000);
      };
      req.on("error", retry);
    };
    tick();
  });
}

async function startProxy() {
  const proxy = httpProxy.createProxyServer({
    ws: true,
    xfwd: true,
  });

  proxy.on("error", (error, req, res) => {
    console.error("[render] Proxy error:", error.message, req?.url);
    if (res && !res.headersSent && typeof res.writeHead === "function") {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Bad Gateway");
    }
  });

  const server = http.createServer((req, res) => {
    const target = isApiPath(req.url) ? `http://127.0.0.1:${API_PORT}` : `http://127.0.0.1:${WEB_PORT}`;
    proxy.web(req, res, { target });
  });

  server.on("upgrade", (req, socket, head) => {
    const target = isApiPath(req.url)
      ? `http://127.0.0.1:${API_PORT}`
      : `http://127.0.0.1:${WEB_PORT}`;
    proxy.ws(req, socket, head, { target });
  });

  await new Promise((resolve) => {
    server.listen(PUBLIC_PORT, "0.0.0.0", () => {
      console.log(`[render] Unified proxy listening on 0.0.0.0:${PUBLIC_PORT}`);
      console.log(`[render]   Web  → 127.0.0.1:${WEB_PORT}`);
      console.log(`[render]   API  → 127.0.0.1:${API_PORT}`);
      resolve(undefined);
    });
  });
}

async function main() {
  console.log("[render] Running Prisma migrate deploy...");
  await migrateDeploy();

  console.log("[render] Starting NestJS API...");
  spawnDetached("npm", ["run", "start:prod", "--workspace=@mango/api"], {
    PORT: String(API_PORT),
    INTERNAL_API_PORT: String(API_PORT),
  });

  console.log("[render] Starting Next.js web...");
  spawnDetached("npm", ["run", "start", "--workspace=@mango/web"], {
    PORT: String(WEB_PORT),
  });

  console.log("[render] Waiting for internal services...");
  await Promise.all([
    waitForServer(API_PORT, "API", "/api/v1/health"),
    waitForServer(WEB_PORT, "Web", "/"),
  ]);

  await startProxy();
}

main().catch((error) => {
  console.error("[render] Unified startup failed:", error.message);
  process.exit(1);
});
