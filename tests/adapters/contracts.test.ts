import { describe, expect, it } from "vitest";
import type { ReadOnlyAdsAdapter } from "@portal/adapters/contracts";
import { adapterCapabilities } from "@portal/adapters/contracts";

describe("read-only adapter SDK", () => {
  it("exposes only discovery, listing and stats operations", () => {
    const adapter: ReadOnlyAdsAdapter = {
      source: "vk_ads",
      discoverCapabilities: async () => ({
        source: "vk_ads",
        supported: true,
        objectLevels: ["campaign", "ad_group", "ad", "creative"],
        metrics: ["impressions", "clicks", "spend"],
      }),
      async *listObjects() {
        yield { page: 1, hasNextPage: false, rows: [] };
      },
      async *getStats() {
        yield { page: 1, hasNextPage: false, rows: [] };
      },
    };

    expect(adapterCapabilities(adapter)).toEqual({
      source: "vk_ads",
      readOnly: true,
      mutationMethods: [],
    });
    expect(Object.keys(adapter)).not.toEqual(
      expect.arrayContaining(["createCampaign", "updateAd", "publishCreative", "deleteObject"]),
    );
  });

  it("represents unsupported sources without enabling writes", () => {
    expect(adapterCapabilities({ source: "telegram_ads", supported: false })).toEqual({
      source: "telegram_ads",
      readOnly: true,
      mutationMethods: [],
    });
  });
});

