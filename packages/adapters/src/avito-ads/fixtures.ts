export type AvitoUtm = {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
};

export type AvitoNativeCreative = {
  date: string;
  campaignExternalId: string;
  campaignName: string;
  adExternalId: string;
  adName: string;
  creativeExternalId: string;
  creativeName: string;
  width: number;
  height: number;
  fileBytes: number;
  title: string;
  text: string;
  imageUrl: string;
  moderationStatus: "approved" | "pending" | "rejected";
  utm: AvitoUtm;
};

export const avitoFixtureExport: readonly AvitoNativeCreative[] = [
  {
    date: "2026-08-12",
    campaignExternalId: "avito-campaign-summer",
    campaignName: "Summer Park Visit",
    adExternalId: "avito-ad-family",
    adName: "Family native card",
    creativeExternalId: "avito-creative-family",
    creativeName: "Family weekend 4:5",
    width: 600,
    height: 750,
    fileBytes: 486_000,
    title: "Семейный выходной в Парке Сказка",
    text: "Аттракционы, прогулка и программа для всей семьи рядом с городом.",
    imageUrl: "https://parkskazka.com/assets/avito-family-4x5.jpg",
    moderationStatus: "approved",
    utm: { source: "avito", medium: "native", campaign: "summer-park", content: "family" },
  },
];

