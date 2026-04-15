export type EventDashboardTab = "edycja" | "uczestnicy";

export function parseEventDashboardTab(tab: string | undefined): EventDashboardTab {
  if (tab === "uczestnicy") return "uczestnicy";
  return "edycja";
}
