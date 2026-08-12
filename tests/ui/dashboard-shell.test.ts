import { describe, expect, it } from "vitest";
import { dashboardShellState, renderDashboardShell } from "@portal/ui/dashboard-shell";

describe("dashboard shell states", () => {
  it("renders loading, error, empty and ready states explicitly", () => {
    expect(renderDashboardShell(dashboardShellState("loading"))).toMatchObject({ state: "loading", ariaBusy: true });
    expect(renderDashboardShell(dashboardShellState("error", "Data unavailable"))).toMatchObject({ state: "error", message: "Data unavailable" });
    expect(renderDashboardShell(dashboardShellState("empty"))).toMatchObject({ state: "empty", message: "No data for selected filters" });
    expect(renderDashboardShell(dashboardShellState("ready"))).toMatchObject({ state: "ready", sections: ["summary", "hypotheses", "explorer"] });
  });
});

