export const drizzleConfig = {
  schema: "./src/schema/*.ts",
  out: "./migrations",
  dialect: "postgresql" as const,
  dbCredentials: { urlEnv: "DATABASE_URL" },
};

