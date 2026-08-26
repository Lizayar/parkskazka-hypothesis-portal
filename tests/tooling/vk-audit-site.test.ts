import { readFile, readdir, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("published VK audit", () => {
  it("contains the current working hierarchy and honest creative coverage", async () => {
    const audit = JSON.parse(await readFile("site/data/audit.json", "utf8"));
    const excludedCampaignIds = ["1221944", "1898108", "16109752", "16262003", "17138676", "17416462", "17558021", "17558098", "17810751", "17931142"];

    expect(audit.summary).toMatchObject({ campaigns: 13, active_campaigns: 12, groups: 47, active_groups: 26, ads: 75, active_ads: 42, creatives_observed: 73, creatives_not_observed: 2, unique_creatives: 49, duplicate_creative_sets: 18, ads_in_duplicate_creative_sets: 42 });
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

    for (const item of [...audit.campaigns, ...audit.groups, ...audit.ads]) {
      expect(item.cabinet_name).toBe(item.name);
      expect(item.cabinet_name).not.toBe("Название не наблюдается");
      expect(item.display_name).toBe(`${item.cabinet_name} · ID ${item.id}`);
    }
    expect(audit.groups.every((item: { name: string }) => !/^Группа(?:\s|$)/i.test(item.name))).toBe(true);

    const groupsById = new Map(audit.groups.map((item: { id: string }) => [item.id, item]));
    expect(groupsById.get("147693868")).toMatchObject({ name: "vk_a3_commfam_mskmo_banner_familyday", display_name: "vk_a3_commfam_mskmo_banner_familyday · ID 147693868" });
    expect(groupsById.get("148796612")).toMatchObject({ name: "vk_a1_kw14_mskmo_feed-video_familyticket", display_name: "vk_a1_kw14_mskmo_feed-video_familyticket · ID 148796612" });
    expect(groupsById.get("148796613")).toMatchObject({ name: "vk_a32_intleisure_mskmo_feed-video_standardticket", display_name: "vk_a32_intleisure_mskmo_feed-video_standardticket · ID 148796613" });

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

  it("groups exact visual duplicates and recomputes aggregate rates", async () => {
    const audit = JSON.parse(await readFile("site/data/audit.json", "utf8"));
    const observedAds = audit.ads.filter((item: { creative_sha256: string | null }) => item.creative_sha256);
    const groupedAdIds = audit.creatives.flatMap((item: { ad_ids: string[] }) => item.ad_ids);

    expect(audit.creatives).toHaveLength(49);
    expect(new Set(audit.creatives.map((item: { visual_sha256: string }) => item.visual_sha256)).size).toBe(49);
    expect(groupedAdIds).toHaveLength(73);
    expect(new Set(groupedAdIds)).toEqual(new Set(observedAds.map((item: { id: string }) => item.id)));
    expect(audit.creatives.filter((item: { ad_count: number }) => item.ad_count > 1)).toHaveLength(18);
    expect(audit.creatives.filter((item: { ad_count: number }) => item.ad_count > 1).reduce((sum: number, item: { ad_count: number }) => sum + item.ad_count, 0)).toBe(42);

    const adTotals = observedAds.reduce((totals: { spend: number; impressions: number; clicks: number }, item: { spend_value: number | null; impressions_value: number | null; clicks_value: number | null }) => ({
      spend: totals.spend + (item.spend_value ?? 0),
      impressions: totals.impressions + (item.impressions_value ?? 0),
      clicks: totals.clicks + (item.clicks_value ?? 0),
    }), { spend: 0, impressions: 0, clicks: 0 });
    const creativeTotals = audit.creatives.reduce((totals: { spend: number; impressions: number; clicks: number }, item: { spend_value: number | null; impressions_value: number | null; clicks_value: number | null }) => ({
      spend: totals.spend + (item.spend_value ?? 0),
      impressions: totals.impressions + (item.impressions_value ?? 0),
      clicks: totals.clicks + (item.clicks_value ?? 0),
    }), { spend: 0, impressions: 0, clicks: 0 });
    expect(creativeTotals.spend).toBeCloseTo(adTotals.spend, 6);
    expect(creativeTotals.impressions).toBe(adTotals.impressions);
    expect(creativeTotals.clicks).toBe(adTotals.clicks);

    for (const creative of audit.creatives.filter((item: { impressions_value: number | null; clicks_value: number | null }) => item.impressions_value && item.clicks_value !== null)) {
      expect(creative.ctr_value).toBeCloseTo(creative.clicks_value / creative.impressions_value * 100, 10);
      if (creative.clicks_value > 0 && creative.spend_value !== null) expect(creative.cpc_value).toBeCloseTo(creative.spend_value / creative.clicks_value, 10);
      if (creative.spend_value !== null) expect(creative.cpm_value).toBeCloseTo(creative.spend_value / creative.impressions_value * 1000, 10);
    }
  });

  it("preserves VK thousands separators when parsing delivery rows", async () => {
    const audit = JSON.parse(await readFile("site/data/audit.json", "utf8"));
    const byId = new Map(audit.ads.map((item: { id: string }) => [item.id, item]));

    expect(byId.get("229960598")).toMatchObject({ impressions: "106 107", clicks: "3 109" });
    expect(byId.get("230959709")).toMatchObject({ impressions: "454 187", clicks: "25 121" });
    expect(byId.get("232034526")).toMatchObject({ impressions: "34 606", clicks: "1 069" });
  });

  it("offers uncropped previews and a fullscreen creative viewer", async () => {
    const [html, app, css] = await Promise.all([
      readFile("site/index.html", "utf8"),
      readFile("site/app.js", "utf8"),
      readFile("site/styles.css", "utf8"),
    ]);

    expect(html).toContain('id="creative-viewer"');
    expect(html).toContain('data-view="creatives"');
    expect(app).toContain("showModal()");
    expect(app).toContain('class="creative-open"');
    expect(app).toContain("campaignRecord");
    expect(app).toContain("groupRecord");
    expect(app).toContain("uniqueCreativeCard");
    expect(app).toContain("item.display_name");
    expect(css).toContain("height: auto");
    expect(css).toContain("grid-template-columns: repeat(2");
  });
});
