export type TelegramUtm = {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
};

export type TelegramTargeting = {
  language: string;
  interests: readonly string[];
};

export type TelegramAdRow = {
  date: string;
  channelExternalId: string;
  channelName: string;
  campaignExternalId: string;
  campaignName: string;
  messageExternalId: string;
  creativeExternalId: string;
  messageText: string;
  mediaType: "image" | "video" | "text";
  mediaUrl?: string;
  destinationUrl: string;
  hook: string;
  cta: string;
  targeting: TelegramTargeting;
  utm: TelegramUtm;
  currency: "RUB" | "USD";
  spend: number;
  impressions: number;
  clicks: number;
};

export const telegramFixtureExport: readonly TelegramAdRow[] = [
  {
    date: "2026-08-12",
    channelExternalId: "channel-parkskazka",
    channelName: "Парк Сказка | Москва",
    campaignExternalId: "tg-campaign-summer",
    campaignName: "Summer family visit",
    messageExternalId: "tg-message-family",
    creativeExternalId: "tg-creative-family",
    messageText: "Парк Сказка — семейный выходной рядом с городом.",
    mediaType: "image",
    mediaUrl: "https://parkskazka.com/assets/tg-family.jpg",
    destinationUrl: "https://parkskazka.com/weekend?utm_source=telegram&utm_medium=sponsored&utm_campaign=summer-family",
    hook: "Семейный выходной",
    cta: "Выбрать дату",
    targeting: { language: "ru", interests: ["family", "leisure"] },
    utm: { source: "telegram", medium: "sponsored", campaign: "summer-family", content: "family-image" },
    currency: "RUB",
    spend: 7800,
    impressions: 28000,
    clicks: 640,
  },
];

