import { readFile, readdir, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("published VK audit", () => {
  it("contains the current working hierarchy and honest creative coverage", async () => {
    const audit = JSON.parse(await readFile("site/data/audit.json", "utf8"));
    const excludedCampaignIds = ["1221944", "1898108", "16109752", "16262003", "17138676", "17416462", "17558021", "17558098", "17810751", "17931142"];

    expect(audit.summary).toMatchObject({ campaigns: 13, active_campaigns: 12, groups: 47, active_groups: 26, ads: 75, active_ads: 42, creatives_observed: 73, creatives_not_observed: 2 });
    expect(audit.meta.excluded_campaign_ids).toEqual(excludedCampaignIds);
    expect(new Set(audit.campaigns.map((item: { id: string }) => item.id)).size).toBe(13);
    expect(new Set(audit.groups.map((item: { id: string }) => item.id)).size).toBe(47);
    expect(new Set(audit.ads.map((item: { id: string }) => item.id)).size).toBe(75);
    expect(audit.campaigns.every((item: { id: string }) => !excludedCampaignIds.includes(item.id))).toBe(true);
    expect(audit.groups.every((item: { campaign_id: string }) => !excludedCampaignIds.includes(item.campaign_id))).toBe(true);
    expect(audit.ads.every((item: { campaign_id: string }) => !excludedCampaignIds.includes(item.campaign_id))).toBe(true);
    expect(audit.ads.every((item: { cta: string }) => Boolean(item.cta))).toBe(true);
    expect(audit.ads.every((item: { ticket_cpa: string }) => item.ticket_cpa === "not_observed")).toBe(true);
    expect(audit.ads.filter((item: { creative: string | null }) => item.creative).length).toBe(73);

    const campaignIds = new Set(audit.campaigns.map((item: { id: string }) => item.id));
    const groupIds = new Set(audit.groups.map((item: { id: string }) => item.id));
    expect(audit.groups.every((item: { campaign_id: string }) => campaignIds.has(item.campaign_id))).toBe(true);
    expect(audit.ads.every((item: { campaign_id: string; group_id: string }) => campaignIds.has(item.campaign_id) && groupIds.has(item.group_id))).toBe(true);

    for (const ad of audit.ads.filter((item: { creative: string | null }) => item.creative)) {
      expect((await stat(`site/${ad.creative}`)).size).toBeGreaterThan(1_000);
    }

    const creativeFiles = await readdir("site/assets/creatives");
    expect(creativeFiles).toHaveLength(73);
    expect(new Set(creativeFiles)).toEqual(new Set(audit.ads.filter((item: { creative: string | null }) => item.creative).map((item: { id: string }) => `${item.id}.webp`)));
  });

  it("offers uncropped previews and a fullscreen creative viewer", async () => {
    const [html, app, css] = await Promise.all([
      readFile("site/index.html", "utf8"),
      readFile("site/app.js", "utf8"),
      readFile("site/styles.css", "utf8"),
    ]);

    expect(html).toContain('id="creative-viewer"');
    expect(app).toContain("showModal()");
    expect(app).toContain('class="creative-open"');
    expect(css).toContain("height: auto");
    expect(css).toContain("grid-template-columns: repeat(2");
  });
});
