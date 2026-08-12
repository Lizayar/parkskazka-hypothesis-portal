import { spawn } from "node:child_process";

const cwd = process.cwd();
const api = spawn(process.execPath, ["apps/api/src/server.mjs"], { cwd, stdio: "ignore" });
const web = spawn(process.execPath, ["apps/web/src/server.mjs"], { cwd, stdio: "ignore" });

try {
  await new Promise((resolve) => setTimeout(resolve, 800));
  const [apiResponse, summaryResponse, mutationResponse, webResponse] = await Promise.all([
    fetch("http://127.0.0.1:3001/health"),
    fetch("http://127.0.0.1:3001/api/summary?from=2026-08-12&to=2026-08-12"),
    fetch("http://127.0.0.1:3001/api/summary", { method: "POST" }),
    fetch("http://127.0.0.1:3000"),
  ]);
  if (apiResponse.status !== 200 || summaryResponse.status !== 200 || mutationResponse.status !== 405 || webResponse.status !== 200) {
    throw new Error(`LOCAL_SMOKE_FAILED api=${apiResponse.status} summary=${summaryResponse.status} mutation=${mutationResponse.status} web=${webResponse.status}`);
  }
  console.log(`local smoke passed api=${apiResponse.status} summary=${summaryResponse.status} mutation=${mutationResponse.status} web=${webResponse.status}`);
} finally {
  api.kill();
  web.kill();
}

