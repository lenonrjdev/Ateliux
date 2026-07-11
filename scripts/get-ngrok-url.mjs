#!/usr/bin/env node

import http from "node:http";
import fs from "node:fs";

const ngrokApiUrl = "http://127.0.0.1:4040/api/tunnels";

function readEnvValue(name) {
  if (!fs.existsSync(".env.docker")) return "";

  const content = fs.readFileSync(".env.docker", "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (key !== name) continue;
    return trimmed.slice(separator + 1).trim();
  }

  return "";
}

function normalizeNgrokUrl(value) {
  if (!value) return "";
  return value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
}

function readJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = "";

      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode !== 200) {
          reject(new Error(`ngrok API returned HTTP ${response.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on("error", reject);
    request.setTimeout(5000, () => {
      request.destroy(new Error("Timed out while reading ngrok API"));
    });
  });
}

try {
  const data = await readJson(ngrokApiUrl);
  const tunnels = Array.isArray(data.tunnels) ? data.tunnels : [];
  const tunnel = tunnels.find((item) => item.proto === "https") ?? tunnels[0];

  if (!tunnel?.public_url) {
    console.error("No ngrok tunnel found. Start ngrok before running this command.");
    process.exit(1);
  }

  console.log(tunnel.public_url);
} catch (error) {
  const fallbackUrl = normalizeNgrokUrl(readEnvValue("NGROK_DOMAIN"));
  if (fallbackUrl) {
    console.log(fallbackUrl);
    process.exit(0);
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`Unable to read ngrok URL: ${message}`);
  process.exit(1);
}
