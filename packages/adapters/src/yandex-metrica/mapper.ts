import type { YandexFixtureReport } from "./fixtures.js";

export type YandexCanonicalRow = {
  source: "yandex_metrica";
  objectLevel: "campaign";
  externalId: string;
  name: string;
  sessions: number;
  goals: Readonly<Record<string, number>>;
  attributionModel: string;
  timezone: string;
  period: { from: string; to: string };
};

export function mapYandexReport(report: YandexFixtureReport): readonly YandexCanonicalRow[] {
  return report.rows.map((row) => ({
    source: "yandex_metrica",
    objectLevel: "campaign",
    externalId: row.campaignId,
    name: row.campaignName,
    sessions: row.sessions,
    goals: { ...row.goals },
    attributionModel: row.attributionModel,
    timezone: report.timezone,
    period: { from: report.from, to: report.to },
  }));
}

