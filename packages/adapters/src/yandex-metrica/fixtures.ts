export type YandexFixtureRow = {
  campaignId: string;
  campaignName: string;
  sessions: number;
  goals: Readonly<Record<string, number>>;
  attributionModel: "lastsign" | "firstsign";
  date: string;
};

export type YandexFixtureReport = {
  counterId: string;
  timezone: string;
  from: string;
  to: string;
  rows: readonly YandexFixtureRow[];
};

export const yandexFixtureReport: YandexFixtureReport = {
  counterId: "counter-fixture",
  timezone: "Europe/Moscow",
  from: "2026-08-12",
  to: "2026-08-12",
  rows: [
    {
      campaignId: "campaign-summer",
      campaignName: "Summer Park Visit",
      sessions: 1200,
      goals: { lead: 48, ticketPurchase: 12 },
      attributionModel: "lastsign",
      date: "2026-08-12",
    },
  ],
};

