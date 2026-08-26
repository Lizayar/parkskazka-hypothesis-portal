import { spawn, type ChildProcess } from "node:child_process";
import { describe, expect, it } from "vitest";

async function waitForApi(): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:3011/health");
      if (response.status === 200) return;
    } catch {
      // The child process may need another polling interval.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("API_HTTP_SERVER_NOT_READY");
}

describe("API HTTP route wiring", () => {
  it("serves read routes and rejects mutation methods", async () => {
    const child: ChildProcess = spawn(process.execPath, ["apps/api/src/server.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, API_PORT: "3011" },
      stdio: "ignore",
    });

    try {
      await waitForApi();
      const query = "from=2026-08-12&to=2026-08-12";
      const [health, summary, hypotheses, explorer, mutation] = await Promise.all([
        fetch("http://127.0.0.1:3011/health"),
        fetch(`http://127.0.0.1:3011/api/summary?${query}`),
        fetch(`http://127.0.0.1:3011/api/hypotheses?${query}`),
        fetch(`http://127.0.0.1:3011/api/explorer?${query}`),
        fetch("http://127.0.0.1:3011/api/summary", { method: "POST" }),
      ]);

      expect(health.status).toBe(200);
      expect(await health.json()).toMatchObject({ service: "api", status: "ready" });
      expect(summary.status).toBe(200);
      expect(await summary.json()).toMatchObject({ kind: "summary", summary: { source: "vk_ads" } });
      expect(hypotheses.status).toBe(200);
      expect(await hypotheses.json()).toMatchObject({ kind: "hypotheses" });
      expect(explorer.status).toBe(200);
      expect(await explorer.json()).toMatchObject({ kind: "explorer" });
      expect(mutation.status).toBe(405);
      expect(await mutation.json()).toEqual({ error: "READ_ONLY_ROUTE" });
    } finally {
      child.kill();
    }
  }, 10_000);
});

