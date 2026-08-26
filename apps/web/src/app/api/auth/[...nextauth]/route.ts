/**
 * Provider callback boundary. Real GitHub OAuth wiring is intentionally deferred
 * until the persistence and deployment adapter tasks; this route never accepts
 * a password or exposes a provider token to the browser.
 */
export async function GET(): Promise<Response> {
  return new Response(JSON.stringify({ error: "AUTH_RUNTIME_DEFERRED" }), {
    status: 501,
    headers: { "content-type": "application/json" },
  });
}

