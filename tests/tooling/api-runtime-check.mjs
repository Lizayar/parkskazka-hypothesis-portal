import { readFileSync } from "node:fs";

const entry = readFileSync("apps/api/src/server.mjs", "utf8");
const forbidden = ["@portal/", "DATABASE_URL", "AUTH_GITHUB_SECRET", "SESSION_ENCRYPTION_KEY"];
const violation = forbidden.find((token) => entry.includes(token));

if (violation) {
  throw new Error(`API_RUNTIME_BOUNDARY_FAILED:${violation}`);
}

console.log("api runtime boundary passed strategy=js-bridge");

