#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const docsReportsDir = path.join(rootDir, "docs", "reports");

const mode = process.argv[2] || "all";
const validModes = new Set([
  "backend",
  "admin",
  "frontend",
  "e2e",
  "all",
  "pre-staging",
  "pre-production",
]);

if (!validModes.has(mode)) {
  console.error(`Unknown validation mode: ${mode}`);
  console.error(`Valid modes: ${Array.from(validModes).join(", ")}`);
  process.exit(1);
}

const isWindows = process.platform === "win32";
const npmBin = isWindows ? "npm.cmd" : "npm";
const npxBin = isWindows ? "npx.cmd" : "npx";
const nodeBin = isWindows ? "node.exe" : process.execPath;

const records = [];
const warnings = [];
let failed = false;

function relativeCwd(cwd) {
  return path.relative(rootDir, cwd) || ".";
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const separator = trimmed.indexOf("=");
  if (separator === -1) return null;
  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return key ? [key, value] : null;
}

function readEnvFile(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (parsed) {
      const [key, value] = parsed;
      env[key] = value;
    }
  }
  return env;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== "");
}

function isLocalhostValue(value) {
  return /(^|[/:@])(?:localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal)(?=$|[/:,?&])/i.test(value);
}

function isWildcardCors(value) {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .some((origin) => origin === "*");
}

function addWarning(message) {
  warnings.push(message);
  console.warn(`warning: ${message}`);
}

function failSafety(message) {
  throw new Error(`Environment safety check failed: ${message}`);
}

function validateEnvSafety(target) {
  const backendEnv = readEnvFile("backend/.env");
  const frontendEnv = readEnvFile("frontend/.env");
  const adminEnv = readEnvFile("admin/.env");
  const e2eEnv = readEnvFile(".env.e2e");

  const getBackend = (key) => firstDefined(process.env[key], backendEnv[key]);
  const getFrontend = (key) => firstDefined(process.env[key], frontendEnv[key]);
  const getAdmin = (key) => firstDefined(process.env[key], adminEnv[key]);
  const getE2E = (key) => firstDefined(process.env[key], e2eEnv[key]);

  const nodeEnv = String(getBackend("NODE_ENV") || process.env.NODE_ENV || "").toLowerCase();
  const strict =
    process.env.VALIDATION_STRICT_ENV === "true" ||
    nodeEnv === "production" ||
    nodeEnv === "staging";

  const corsOrigins = getBackend("CORS_ORIGINS");
  if (corsOrigins && isWildcardCors(corsOrigins)) {
    failSafety("CORS_ORIGINS cannot be '*' when cookies are used.");
  }

  const e2eTarget = String(getE2E("E2E_TARGET_ENV") || "local").toLowerCase();
  if ((e2eTarget === "production" || process.env.E2E_IS_PRODUCTION === "true") && getE2E("E2E_ALLOW_PRODUCTION") !== "true") {
    failSafety("E2E production target requires E2E_ALLOW_PRODUCTION=true.");
  }

  if (!strict) {
    addWarning(
      `${target} env safety is running in rehearsal mode because NODE_ENV is not staging/production and VALIDATION_STRICT_ENV is not true.`,
    );
    return;
  }

  if (target === "production" && nodeEnv !== "production") {
    failSafety("NODE_ENV must be production for strict pre-production validation.");
  }

  if (target === "staging" && !["staging", "production"].includes(nodeEnv)) {
    failSafety("NODE_ENV must be staging or production for strict pre-staging validation.");
  }

  if (getBackend("COOKIE_SECURE") !== "true") {
    failSafety("COOKIE_SECURE must be true in staging/production.");
  }

  if (String(getBackend("COOKIE_DOMAIN") || "").toLowerCase() === "localhost") {
    failSafety("COOKIE_DOMAIN cannot be localhost in staging/production.");
  }

  const databaseUrl = getBackend("DATABASE_URL");
  if (databaseUrl && isLocalhostValue(databaseUrl)) {
    failSafety("DATABASE_URL cannot point to localhost in staging/production.");
  }

  if (corsOrigins && isLocalhostValue(corsOrigins)) {
    failSafety("CORS_ORIGINS cannot point to localhost in staging/production.");
  }

  if (target === "production" && getBackend("ALLOW_DEMO_SEED") !== "false") {
    failSafety("ALLOW_DEMO_SEED must be false in production.");
  }

  if (getFrontend("NEXT_PUBLIC_ENABLE_DEV_FALLBACK") !== "false") {
    failSafety("frontend NEXT_PUBLIC_ENABLE_DEV_FALLBACK must be false in staging/production.");
  }

  if (getAdmin("NEXT_PUBLIC_ENABLE_DEV_FALLBACK") !== "false") {
    failSafety("admin NEXT_PUBLIC_ENABLE_DEV_FALLBACK must be false in staging/production.");
  }
}

function commandText(step) {
  return [step.command, ...step.args].join(" ");
}

function runStep(step) {
  const startedAt = Date.now();
  console.log(`\n==> ${step.name}`);
  console.log(`cwd: ${relativeCwd(step.cwd)}`);
  console.log(`cmd: ${commandText(step)}`);

  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd,
    env: { ...process.env, ...(step.env || {}) },
    stdio: "inherit",
    shell: isWindows,
  });

  const durationMs = Date.now() - startedAt;
  const record = {
    name: step.name,
    command: commandText(step),
    cwd: relativeCwd(step.cwd),
    status: result.status === 0 ? "passed" : "failed",
    durationMs,
  };
  records.push(record);

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    failed = true;
    if (step.name === "Production clean check") {
      addWarning(
        "Production clean check blocked the validation. Use a new clean database or run db:clean-demo:dry-run before any explicitly confirmed cleanup.",
      );
    }
    throw new Error(`${step.name} failed with exit code ${result.status}.`);
  }
}

function backendSteps() {
  const cwd = path.join(rootDir, "backend");
  return [
    { name: "Backend prisma generate", command: npmBin, args: ["run", "prisma:generate"], cwd },
    { name: "Backend migrate status", command: npxBin, args: ["prisma", "migrate", "status"], cwd },
    { name: "Backend typecheck", command: npmBin, args: ["run", "typecheck"], cwd },
    { name: "Backend lint", command: npmBin, args: ["run", "lint"], cwd },
    { name: "Backend build", command: npmBin, args: ["run", "build"], cwd },
    { name: "Backend tests", command: npmBin, args: ["run", "test"], cwd },
    { name: "Backend audit", command: npmBin, args: ["audit"], cwd },
  ];
}

function adminSteps() {
  const cwd = path.join(rootDir, "admin");
  return [
    { name: "Admin typecheck", command: npmBin, args: ["run", "typecheck"], cwd },
    { name: "Admin lint", command: npmBin, args: ["run", "lint"], cwd },
    { name: "Admin build", command: npmBin, args: ["run", "build"], cwd },
    { name: "Admin audit", command: npmBin, args: ["audit"], cwd },
  ];
}

function frontendSteps() {
  const cwd = path.join(rootDir, "frontend");
  return [
    { name: "Frontend typecheck", command: npxBin, args: ["tsc", "--noEmit"], cwd },
    { name: "Frontend lint", command: npmBin, args: ["run", "lint"], cwd },
    { name: "Frontend build", command: npmBin, args: ["run", "build"], cwd },
    { name: "Frontend audit", command: npmBin, args: ["audit"], cwd },
  ];
}

function rootAuditStep() {
  return { name: "Root audit", command: npmBin, args: ["audit"], cwd: rootDir };
}

function e2eStep() {
  const useDockerBackend = process.env.E2E_START_BACKEND_SERVER === "false";

  return {
    name: "Playwright E2E",
    command: useDockerBackend ? nodeBin : npmBin,
    args: useDockerBackend ? ["scripts/run-e2e-docker-backend.mjs"] : ["run", "e2e"],
    cwd: rootDir,
    env: {
      E2E_START_SERVERS: useDockerBackend ? "false" : process.env.E2E_START_SERVERS || "true",
      E2E_START_BACKEND_SERVER: process.env.E2E_START_BACKEND_SERVER,
    },
  };
}

function productionCleanStep() {
  return {
    name: "Production clean check",
    command: npmBin,
    args: ["run", "production:check-clean"],
    cwd: path.join(rootDir, "backend"),
  };
}

function buildStepsForMode(selectedMode) {
  switch (selectedMode) {
    case "backend":
      return backendSteps();
    case "admin":
      return adminSteps();
    case "frontend":
      return frontendSteps();
    case "e2e":
      return [e2eStep()];
    case "all":
      return [...backendSteps(), ...adminSteps(), ...frontendSteps(), rootAuditStep(), e2eStep()];
    case "pre-staging":
      validateEnvSafety("staging");
      return [...backendSteps(), ...adminSteps(), ...frontendSteps(), rootAuditStep(), e2eStep()];
    case "pre-production":
      validateEnvSafety("production");
      return [...backendSteps(), ...adminSteps(), ...frontendSteps(), rootAuditStep(), e2eStep(), productionCleanStep()];
    default:
      return [];
  }
}

function gitValue(args) {
  const result = spawnSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function writeReport() {
  fs.mkdirSync(docsReportsDir, { recursive: true });
  const reportPath = path.join(docsReportsDir, `${mode}-validation-latest.md`);
  const passed = !failed && records.every((record) => record.status === "passed");
  const lines = [
    `# Ateliux ${mode} Validation Report`,
    "",
    `- Date: ${new Date().toISOString()}`,
    `- Mode: ${mode}`,
    `- Branch: ${gitValue(["branch", "--show-current"])}`,
    `- Commit: ${gitValue(["rev-parse", "--short", "HEAD"])}`,
    `- Result: ${passed ? "passed" : "failed"}`,
    "",
    "## Steps",
    "",
    "| Step | Status | Duration |",
    "| --- | --- | --- |",
    ...records.map((record) => `| ${record.name} | ${record.status} | ${formatDuration(record.durationMs)} |`),
    "",
    "## Warnings",
    "",
    ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ["- None recorded by the orchestrator."]),
    "",
    "## Known Warnings",
    "",
    "- Prisma warns that package.json#prisma will be removed in Prisma 7.",
    "- Admin and frontend may still report Next.js no-img-element warnings where dynamic images use <img>.",
    "- Next.js may warn about multiple lockfiles because the repository has root, admin and frontend package-lock files.",
    "",
    "## Pending",
    "",
    "- Expand browser E2E coverage to blog, uploads, inbox, finance and notifications.",
    "- Run strict environment validation in the real staging/production provider with VALIDATION_STRICT_ENV=true.",
    "",
    "## Security Notes",
    "",
    "- This report intentionally does not include environment values or secrets.",
    "- E2E production targets require explicit E2E_ALLOW_PRODUCTION=true.",
  ];

  fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`\nValidation report written to ${path.relative(rootDir, reportPath)}`);
}

try {
  const steps = buildStepsForMode(mode);
  for (const step of steps) {
    runStep(step);
  }
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? error.message : error);
} finally {
  writeReport();
}

if (failed) {
  process.exit(1);
}

console.log(`\nValidation ${mode} passed.`);
