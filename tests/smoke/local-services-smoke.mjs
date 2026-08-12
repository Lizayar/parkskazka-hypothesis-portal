import { spawn } from "node:child_process";

const cwd = process.cwd();
const api = spawn(process.execPath, ["apps/api/src/server.mjs"], { cwd, stdio: "ignore" });
const web = spawn(process.execPath, ["apps/web/src/server.mjs"], { cwd, stdio: "ignore" });

try {
  await new Promise((resolve) => setTimeout(resolve, 800));
  const [apiResponse, webResponse] = await Promise.all([
    fetch("http://127.0.0.1:3001"),
    fetch("http://127.0.0.1:3000"),
  ]);
  if (apiResponse.status !== 200 || webResponse.status !== 200) {
    throw new Error(`LOCAL_SMOKE_FAILED api=${apiResponse.status} web=${webResponse.status}`);
  }
  console.log(`local smoke passed api=${apiResponse.status} web=${webResponse.status}`);
} finally {
  api.kill();
  web.kill();
}

