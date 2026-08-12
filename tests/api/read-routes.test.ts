import { describe, expect, it } from "vitest";
import { handleReadRequest } from "@portal/api/read-routes";

describe("read-only API routes", () => {
  it("returns validated summary, hypotheses and explorer responses for GET", async () => {
    const summary = await handleReadRequest(new Request("http://portal.test/api/summary?from=2026-08-12&to=2026-08-12&source=vk_ads"));
    expect(summary.status).toBe(200);
    expect(await summary.json()).toMatchObject({
      kind: "summary",
      filters: { source: "vk_ads" },
      summary: { source: "vk_ads", spend: 12500, qualityBadge: "valid" },
    });

    const hypotheses = await handleReadRequest(new Request("http://portal.test/api/hypotheses?from=2026-08-12&to=2026-08-19"));
    expect(hypotheses.status).toBe(200);
    expect(await hypotheses.json()).toMatchObject({
      kind: "hypotheses",
      items: [expect.objectContaining({ id: "hypothesis-family-hook-fixture", status: "planned", startsOn: "2026-08-12", endsOn: "2026-08-19" })],
    });

    const explorer = await handleReadRequest(new Request("http://portal.test/api/explorer?from=2026-08-12&to=2026-08-12"));
    expect(explorer.status).toBe(200);
    expect(await explorer.json()).toMatchObject({
      kind: "explorer",
      tree: [expect.objectContaining({ campaignId: "campaign-summer-fixture" })],
    });
  });

  it("returns safe 400 for invalid filters and 405 for mutation methods", async () => {
    const bad = await handleReadRequest(new Request("http://portal.test/api/summary?from=2026-08-13&to=2026-08-12"));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "INVALID_DATE_RANGE" });

    const mutation = await handleReadRequest(new Request("http://portal.test/api/summary", { method: "POST" }));
    expect(mutation.status).toBe(405);
    expect(await mutation.json()).toEqual({ error: "READ_ONLY_ROUTE" });
  });
});

