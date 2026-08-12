export type DatabaseHealth = {
  driver: "postgresql";
  status: "not_configured" | "ready";
};

export function databaseHealth(databaseUrl: string | undefined): DatabaseHealth {
  return {
    driver: "postgresql",
    status: databaseUrl ? "ready" : "not_configured",
  };
}

