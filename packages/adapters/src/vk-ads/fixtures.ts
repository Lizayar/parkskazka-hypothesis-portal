export type VkUtm = {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
};

export type VkExportRow = {
  date: string;
  currency: "RUB" | "EUR";
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  adId: string;
  adName: string;
  creativeId: string;
  creativeName: string;
  copy: string;
  hook: string;
  offer: string;
  cta: string;
  landingUrl: string;
  utm: VkUtm;
  spend: number;
  impressions: number;
  clicks: number;
};

export const vkFixtureExport: readonly VkExportRow[] = [
  {
    date: "2026-08-12",
    currency: "RUB",
    campaignId: "vk-campaign-summer",
    campaignName: "Summer Park Visit",
    adGroupId: "vk-ad-group-families",
    adGroupName: "Families 25-44",
    adId: "vk-ad-control",
    adName: "Control rotation A",
    creativeId: "vk-creative-control",
    creativeName: "Control: family weekend",
    copy: "Семейный выходной в Парке Сказка",
    hook: "Отдых рядом с городом",
    offer: "Билет на семейный день",
    cta: "Узнать программу",
    landingUrl: "https://parkskazka.com/weekend?utm_source=vk&utm_medium=cpc&utm_campaign=summer-park",
    utm: { source: "vk", medium: "cpc", campaign: "summer-park", content: "control-a" },
    spend: 12500,
    impressions: 42000,
    clicks: 980,
  },
];

