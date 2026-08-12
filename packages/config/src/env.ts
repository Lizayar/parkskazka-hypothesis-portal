export type RuntimeEnvironment = "local" | "staging" | "production";

export type ServerEnv = {
  appBaseUrl: string;
  environment: RuntimeEnvironment;
  databaseUrl?: string;
  redisUrl?: string;
  objectStorageEndpoint?: string;
  objectStorageBucket?: string;
};

const requiredProductionNames = [
  "DATABASE_URL",
  "REDIS_URL",
  "SESSION_ENCRYPTION_KEY",
] as const;

function resolveEnvironment(value: string | undefined): RuntimeEnvironment {
  if (value === "production" || value === "staging") return value;
  return "local";
}

export function loadServerEnv(
  input: NodeJS.ProcessEnv,
  options: { strict?: boolean } = {},
): ServerEnv {
  const environment = resolveEnvironment(input.NODE_ENV);
  const strict = options.strict ?? environment === "production";
  const missing = strict
    ? requiredProductionNames.filter((name) => !input[name]?.trim())
    : [];

  if (missing.length > 0) {
    throw new Error(`Missing required server environment variables: ${missing.join(", ")}`);
  }

  return {
    appBaseUrl: input.APP_BASE_URL?.trim() || "http://localhost:3000",
    environment,
    databaseUrl: input.DATABASE_URL?.trim(),
    redisUrl: input.REDIS_URL?.trim(),
    objectStorageEndpoint: input.OBJECT_STORAGE_ENDPOINT?.trim(),
    objectStorageBucket: input.OBJECT_STORAGE_BUCKET?.trim(),
  };
}

