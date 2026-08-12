import type { ParkSkazkaFixture } from "../fixtures/park-skazka-fixture.js";

export interface PortalReadRepository {
  getFixture(): ParkSkazkaFixture;
}

export class FixturePortalReadRepository implements PortalReadRepository {
  constructor(private readonly fixture: ParkSkazkaFixture) {}

  getFixture(): ParkSkazkaFixture {
    return {
      ...this.fixture,
      workspace: { ...this.fixture.workspace },
      sourceAccount: { ...this.fixture.sourceAccount },
      campaign: { ...this.fixture.campaign },
      adGroup: { ...this.fixture.adGroup },
      creative: { ...this.fixture.creative },
      ad: { ...this.fixture.ad },
      hypothesis: {
        ...this.fixture.hypothesis,
        guardrailMetrics: [...this.fixture.hypothesis.guardrailMetrics],
      },
      test: {
        ...this.fixture.test,
        challengerCreativeIds: [...this.fixture.test.challengerCreativeIds],
      },
    };
  }
}

