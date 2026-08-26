import { describe, expect, it } from "vitest";
import { createParkSkazkaFixture } from "@portal/db/fixtures/park-skazka-fixture";
import {
  FixturePortalReadRepository,
  type PortalReadRepository,
} from "@portal/db/repositories/read-repository";
import { handleReadRequest } from "@portal/api/read-routes";

describe("portal read repository boundary", () => {
  it("exposes fixture data through a replaceable read-only repository", () => {
    const repository: PortalReadRepository = new FixturePortalReadRepository(createParkSkazkaFixture());
    expect(repository.getFixture().workspace.slug).toBe("parkskazka");
    expect(repository).not.toHaveProperty("create");
    expect(repository).not.toHaveProperty("update");
    expect(repository).not.toHaveProperty("delete");
  });

  it("allows the API handler to consume an injected repository", async () => {
    const repository = new FixturePortalReadRepository({
      ...createParkSkazkaFixture(),
      workspace: { ...createParkSkazkaFixture().workspace, name: "Injected Park Skazka" },
    });
    const response = await handleReadRequest(
      new Request("http://portal.test/api/summary?from=2026-08-12&to=2026-08-12"),
      repository,
    );
    expect(await response.json()).toMatchObject({ summary: { source: "vk_ads" } });
  });
});

