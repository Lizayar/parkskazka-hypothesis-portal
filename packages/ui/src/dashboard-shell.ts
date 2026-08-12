export type DashboardShellState =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "empty" }
  | { state: "ready" };

export function dashboardShellState(state: DashboardShellState["state"], message?: string): DashboardShellState {
  if (state === "error") return { state, message: message ?? "Unable to load portal data" };
  return { state };
}

export type DashboardShellView = {
  state: DashboardShellState["state"];
  ariaBusy: boolean;
  message?: string;
  sections?: readonly string[];
};

export function renderDashboardShell(state: DashboardShellState): DashboardShellView {
  if (state.state === "loading") return { state: "loading", ariaBusy: true };
  if (state.state === "error") return { state: "error", ariaBusy: false, message: state.message };
  if (state.state === "empty") return { state: "empty", ariaBusy: false, message: "No data for selected filters" };
  return { state: "ready", ariaBusy: false, sections: ["summary", "hypotheses", "explorer"] };
}

