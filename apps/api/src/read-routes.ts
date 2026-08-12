import { parsePortalFilters } from "@portal/ui/read-models";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function handleReadRequest(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "READ_ONLY_ROUTE" }, 405);

  const url = new URL(request.url);
  const kind = url.pathname.split("/").filter(Boolean).at(-1);
  if (kind !== "summary" && kind !== "hypotheses" && kind !== "explorer") {
    return json({ error: "NOT_FOUND" }, 404);
  }

  try {
    const filters = parsePortalFilters({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      timezone: url.searchParams.get("timezone") ?? undefined,
      source: url.searchParams.get("source") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      ownerSubjectId: url.searchParams.get("ownerSubjectId") ?? undefined,
    });

    if (kind === "summary") return json({ kind, filters, summary: null, quality: "not_loaded" });
    if (kind === "hypotheses") return json({ kind, filters, items: [] });
    return json({ kind, filters, tree: [] });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_FILTERS";
    const safeCode = code.startsWith("INVALID_") ? code : "INVALID_FILTERS";
    return json({ error: safeCode }, 400);
  }
}

