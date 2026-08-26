import { createPostgresReadRepository, type PortalReadQuery, type PortalReadRow, type SqlExecutor } from "@portal/db/repositories/postgres-read-repository";
import type { PortalReadBackend } from "@portal/config/env";
import { createParkSkazkaFixture } from "@portal/db/fixtures/park-skazka-fixture";
import { FixturePortalReadRepository, type PortalReadRepository } from "@portal/db/repositories/read-repository";
import {
  mapPostgresRowsToReadModels,
  type MetricObservationInput,
  type PostgresReadModels,
} from "@portal/ui/postgres-read-mapper";
import { handleReadRequest } from "./read-routes.js";

export type ApiReadBackend = "fixture" | "postgres";

export type ApiReadServiceOptions = {
  backend?: ApiReadBackend;
  fixtureRepository?: PortalReadRepository;
  postgresExecutor?: SqlExecutor;
};

export function createApiReadServiceFromEnv(
  env: Pick<{ portalReadBackend: PortalReadBackend }, "portalReadBackend">,
  options: Omit<ApiReadServiceOptions, "backend"> = {},
): ApiReadService {
  return createApiReadService({ ...options, backend: env.portalReadBackend });
}

export type ApiReadService = {
  backend: ApiReadBackend;
  handle(request: Request): Promise<Response>;
  readRows(query: PortalReadQuery): Promise<readonly PortalReadRow[]>;
  readModels(
    query: PortalReadQuery,
    observations?: readonly MetricObservationInput[],
  ): Promise<PostgresReadModels>;
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function createApiReadService(options: ApiReadServiceOptions = {}): ApiReadService {
  const backend = options.backend ?? "fixture";
  if (backend !== "fixture" && backend !== "postgres") throw new Error("INVALID_READ_BACKEND");

  const fixtureRepository = options.fixtureRepository ?? new FixturePortalReadRepository(createParkSkazkaFixture());
  if (backend === "fixture") {
    return {
      backend,
      handle: (request) => handleReadRequest(request, fixtureRepository),
      async readRows() {
        return [];
      },
      async readModels() {
        throw new Error("READ_MODELS_POSTGRES_ONLY");
      },
    };
  }

  if (!options.postgresExecutor) throw new Error("POSTGRES_READ_EXECUTOR_REQUIRED");
  const repository = createPostgresReadRepository(options.postgresExecutor);
  return {
    backend,
    async handle(request) {
      if (request.method !== "GET") return json({ error: "READ_ONLY_ROUTE" }, 405);
      return json({ error: "POSTGRES_READ_ROUTE_NOT_MAPPED" }, 501);
    },
    readRows: repository.getPortalReadRows,
    async readModels(query, observations = []) {
      const rows = await repository.getPortalReadRows(query);
      return mapPostgresRowsToReadModels(rows, observations);
    },
  };
}

