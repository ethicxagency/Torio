#!/usr/bin/env node
/**
 * Render API start script — runs migrations then starts the NestJS API.
 * Render sets PORT; DATABASE_URL must be provided by the platform.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function migrateDeploy() {
  try {
    await run("npm", ["run", "db:deploy"]);
  } catch (error) {
    console.warn("[render] migrate deploy failed — attempting P3009 recovery for failed init migration...");
    try {
      await run("npm", ["run", "db:resolve-failed-init"]);
      await run("npm", ["run", "db:deploy"]);
    } catch (retryError) {
      throw retryError;
    }
  }
}

async function main() {
  console.log("[render] Running Prisma migrate deploy...");
  await migrateDeploy();

  console.log("[render] Starting API...");
  await run("npm", ["run", "start:prod", "--workspace=@mango/api"]);
}

main().catch((error) => {
  console.error("[render] Startup failed:", error.message);
  process.exit(1);
});
