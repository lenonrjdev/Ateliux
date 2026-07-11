#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import { spawnSync } from "node:child_process";

const composeArgs = ["compose", "--env-file", ".env.docker", "-f", "docker-compose.local-homolog.yml"];
const isWindows = process.platform === "win32";
const dockerBin = isWindows ? "docker.exe" : "docker";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Usage: npm run docker:homolog:start");
  console.log("");
  console.log("Starts PostgreSQL, Redis, backend and ngrok using Docker only.");
  console.log("Then runs migrations, admin bootstrap and production clean check inside the backend container.");
  process.exit(0);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readHealth() {
  return new Promise((resolve) => {
    const request = http.get("http://localhost:3054/api/health", (response) => {
      let body = "";

      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode !== 200) {
          resolve(false);
          return;
        }

        try {
          const json = JSON.parse(body);
          resolve(json.status === "ok" && json.database === "ok" && json.redis === "ok");
        } catch {
          resolve(false);
        }
      });
    });

    request.on("error", () => resolve(false));
    request.setTimeout(3000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForHealth() {
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    if (await readHealth()) return;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  console.error("Backend health did not become ready at http://localhost:3054/api/health.");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (!fs.existsSync(".env.docker")) {
  console.error("Missing .env.docker. Copy .env.docker.example to .env.docker and fill local values.");
  process.exit(1);
}

console.log("Starting Ateliux Docker homologation environment...");
run(dockerBin, [...composeArgs, "up", "-d", "--build"]);

console.log("Waiting for backend health...");
await waitForHealth();

console.log("Running migrations inside the backend container...");
run(dockerBin, [...composeArgs, "exec", "backend", "npx", "prisma", "migrate", "deploy"]);

console.log("Checking migration status inside the backend container...");
run(dockerBin, [...composeArgs, "exec", "backend", "npx", "prisma", "migrate", "status"]);

console.log("Running admin bootstrap inside the backend container...");
run(dockerBin, [...composeArgs, "exec", "backend", "npm", "run", "prisma:bootstrap-admin"]);

console.log("Checking clean production safety inside the backend container...");
run(dockerBin, [...composeArgs, "exec", "backend", "npm", "run", "production:check-clean"]);

console.log("Starting ngrok profile...");
run(dockerBin, [...composeArgs, "--profile", "ngrok", "up", "-d", "ngrok"]);
await sleep(3000);

console.log("");
console.log("Backend local: http://localhost:3054/api");
console.log("Health: http://localhost:3054/api/health");
console.log("Ngrok:");
run(process.execPath, ["scripts/get-ngrok-url.mjs"]);
console.log("Vercel API: use the ngrok URL above with /api");
