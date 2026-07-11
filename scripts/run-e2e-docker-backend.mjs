#!/usr/bin/env node

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const npmBin = isWindows ? "npm.cmd" : "npm";
const rootDir = process.cwd();

const children = [];
let exitCode = 1;

function cleanNextDevCaches() {
  for (const appDir of ["admin", "frontend"]) {
    try {
      fs.rmSync(path.join(rootDir, appDir, ".next", "dev"), { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[e2e] Could not clean ${appDir}/.next/dev: ${message}`);
    }
  }
}

function stopPorts(ports) {
  if (!isWindows) return;
  const portList = ports.join(",");
  spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `for ($i = 0; $i -lt 5; $i++) { Get-NetTCPConnection -LocalPort ${portList} -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 0 } | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 500 }`,
    ],
    { stdio: "ignore", windowsHide: true },
  );
}

function start(command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    shell: isWindows,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${cwd}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${cwd}] ${chunk}`));
  children.push(child);
  return child;
}

function stopChildren() {
  for (const child of children) {
    if (child.killed) continue;
    if (isWindows) {
      spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
}

function request(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode && res.statusCode < 500));
    });
    req.on("error", () => resolve(false));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitFor(url, seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (await request(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

try {
  process.env.E2E_START_SERVERS = "false";
  process.env.E2E_START_BACKEND_SERVER = "false";

  stopPorts([3000, 3002]);
  cleanNextDevCaches();

  start(npmBin, ["run", "dev", "--", "-p", "3002"], "admin");
  start(npmBin, ["run", "dev", "--", "-p", "3000"], "frontend");

  await waitFor("http://localhost:3002", 120);
  await waitFor("http://localhost:3000", 120);

  await request("http://localhost:3002/clientes");
  await request("http://localhost:3000/cliente/projeto");

  const result = spawnSync(npmBin, ["run", "e2e"], {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
    shell: isWindows,
  });

  exitCode = result.status ?? 1;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  exitCode = 1;
} finally {
  stopChildren();
  stopPorts([3000, 3002]);
}

process.exit(exitCode);
