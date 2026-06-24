import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const platformRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl =
  "postgresql://mango:mango@127.0.0.1:5433/mango_messaging?schema=public";

const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  API_PORT: "4000",
  API_URL: "http://localhost:4000",
  WEB_URL: "http://localhost:3010",
  ADMIN_URL: "http://localhost:3001",
  CORS_ORIGINS: "http://localhost:3010,http://localhost:3001",
  NODE_ENV: "development",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "change-me-access-secret-min-32-chars",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "change-me-refresh-secret-min-32-chars",
  PLATFORM_ADMIN_EMAIL: process.env.PLATFORM_ADMIN_EMAIL ?? "admin@mango.app",
  PLATFORM_ADMIN_PASSWORD: process.env.PLATFORM_ADMIN_PASSWORD ?? "changeme-in-production",
};

function run(command, args, cwd = platformRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: env,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function startDatabase() {
  const databaseDir = path.join(platformRoot, ".local-postgres");
  const alreadyRunning = await isPortOpen(5433);

  if (alreadyRunning) {
    console.log("[torio] PostgreSQL already running on 127.0.0.1:5433");
    return { pg: null, ownsProcess: false };
  }

  const pg = new EmbeddedPostgres({
    databaseDir,
    user: "mango",
    password: "mango",
    port: 5433,
    persistent: true,
  });

  console.log("[torio] Starting embedded PostgreSQL on 127.0.0.1:5433...");
  if (!fs.existsSync(path.join(databaseDir, "PG_VERSION"))) {
    await pg.initialise();
  }
  await pg.start();

  try {
    await pg.createDatabase("mango_messaging");
    console.log("[torio] Created database mango_messaging");
  } catch {
    console.log("[torio] Database mango_messaging already exists");
  }

  return { pg, ownsProcess: true };
}

async function main() {
  const { pg, ownsProcess } = await startDatabase();
  const children = [];

  const shutdown = async (signal) => {
    console.log(`\n[torio] Shutting down (${signal ?? "exit"})...`);
    for (const child of children) {
      if (child && !child.killed) child.kill("SIGTERM");
    }
    if (pg && ownsProcess) await pg.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  console.log("[torio] Syncing schema and seed...");
  await run("npm", ["run", "db:generate"]);
  await run("npm", ["run", "db:push"]);
  await run("npm", ["run", "db:seed"]);

  const apiPortBusy = await isPortOpen(4000);
  const webPortBusy = await isPortOpen(3010);

  if (apiPortBusy) {
    console.log("[torio] API already running on http://localhost:4000 — skipping API start");
  } else {
    console.log("[torio] Starting API at http://localhost:4000");
    const api = spawn("npm", ["run", "dev:api"], { cwd: platformRoot, stdio: "inherit", env });
    children.push(api);
  }

  if (webPortBusy) {
    console.warn(
      "[torio] Port 3010 is already in use. Stop the old dev server first, or run:\n" +
        "  rm -rf apps/web/.next && npm run dev:local",
    );
    process.exit(1);
  }

  console.log("[torio] Starting web app at http://localhost:3010");
  const web = spawn("npm", ["run", "dev"], {
    cwd: path.join(platformRoot, "apps/web"),
    stdio: "inherit",
    env: { ...env, PORT: "3010", NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1" },
  });
  children.push(web);

  console.log("\n[torio] Standalone SaaS ready:");
  console.log("  Web:  http://localhost:3010");
  console.log("  API:  http://localhost:4000/api/v1/health");
  console.log("  Docs: http://localhost:4000/docs");
  console.log("\n  This is NOT a Shopify app — no App Bridge, Polaris, or Shopify OAuth.\n");
}

main().catch((error) => {
  console.error("[torio] Failed to start:", error);
  process.exit(1);
});
