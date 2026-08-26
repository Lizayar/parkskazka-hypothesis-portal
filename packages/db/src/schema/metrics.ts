export type MetricObservation = {
  id: string;
  testId: string;
  period: string;
  calculationVersion: string;
  metricKey: string;
  numerator: number;
  denominator: number;
  value: number;
  source: string;
  attributionModel: string;
  qualityStatus: "valid" | "partial" | "invalid";
};

export const metricConstraints = {
  observationIdentity: ["testId", "period", "calculationVersion"],
} as const;

