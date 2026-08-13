import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("deploy/api-runtime.manifest.json", "utf8"));
const requiredPaths = ["/api/summary", "/api/hypotheses", "/api/explorer"];

if (manifest.service !== "api" || manifest.entry !== "apps/api/src/server.mjs") {
  throw new Error("DEPLOYMENT_MANIFEST_INVALID");
}
if (manifest.healthPath !== "/health" || manifest.readOnly !== true || manifest.mutationStatus !== 405) {
  throw new Error("DEPLOYMENT_READ_ONLY_GATE_FAILED");
}
if (JSON.stringify(manifest).includes("secretValues") || JSON.stringify(manifest).includes("postgres://")) {
  throw new Error("DEPLOYMENT_SECRET_BOUNDARY_FAILED");
}
if (!requiredPaths.every((path) => manifest.readPaths?.includes(path))) {
  throw new Error("DEPLOYMENT_READ_PATHS_INCOMPLETE");
}

execFileSync(process.execPath, ["tests/tooling/api-runtime-check.mjs"], { stdio: "inherit" });
console.log("deployment acceptance passed service=api read_only=true");

