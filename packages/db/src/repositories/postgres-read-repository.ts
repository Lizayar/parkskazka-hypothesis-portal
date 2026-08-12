import type { Source } from "../schema/core.js";

export type SqlExecutor = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[],
  ): Promise<readonly Row[]>;
};

export type PortalReadQuery = {
  workspaceId: string;
  from: string;
  to: string;
  source?: Source;
};

export type PortalReadRow = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  timezone: string;
  campaignId: string;
  campaignName: string;
  source: Source;
  hypothesisId?: string;
  hypothesisTitle?: string;
  hypothesisStatus?: string;
  startsOn?: string;
  endsOn?: string;
  decisionOutcome?: string;
};

type PostgresPortalReadRow = Record<string, unknown> & {
  workspace_id: string;
  workspace_slug: string;
  workspace_name: string;
  timezone: string;
  campaign_id: string;
  campaign_name: string;
  source: Source;
  hypothesis_id?: string | null;
  hypothesis_title?: string | null;
  hypothesis_status?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  decision_outcome?: string | null;
};

const portalReadSql = `
  select
    w.id as workspace_id,
    w.slug as workspace_slug,
    w.name as workspace_name,
    w.timezone,
    c.id as campaign_id,
    c.name as campaign_name,
    c.source,
    h.id as hypothesis_id,
    h.title as hypothesis_title,
    h.status as hypothesis_status,
    h.starts_on,
    h.ends_on,
    d.outcome as decision_outcome
  from workspace w
  join source_account sa on sa.workspace_id = w.id
  join campaign c on c.account_id = sa.id
  left join hypothesis h
    on h.workspace_id = w.id
   and h.starts_on <= $3::date
   and h.ends_on >= $2::date
  left join experiment_test et on et.hypothesis_id = h.id
  left join decision d on d.test_id = et.id
  where w.id = $1::uuid
    and ($4::text is null or c.source = $4::text)
  order by c.name, h.starts_on nulls last, d.created_at desc nulls last;
`;

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function createPostgresReadRepository(executor: SqlExecutor) {
  return {
    async getPortalReadRows(query: PortalReadQuery): Promise<PortalReadRow[]> {
      const rows = await executor.query<PostgresPortalReadRow>(portalReadSql, [
        query.workspaceId,
        query.from,
        query.to,
        query.source ?? null,
      ]);

      return rows.map((row) => ({
        workspaceId: row.workspace_id,
        workspaceSlug: row.workspace_slug,
        workspaceName: row.workspace_name,
        timezone: row.timezone,
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        source: row.source,
        hypothesisId: optionalString(row.hypothesis_id),
        hypothesisTitle: optionalString(row.hypothesis_title),
        hypothesisStatus: optionalString(row.hypothesis_status),
        startsOn: optionalString(row.starts_on),
        endsOn: optionalString(row.ends_on),
        decisionOutcome: optionalString(row.decision_outcome),
      }));
    },
  };
}

