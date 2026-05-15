import { DashboardKpis, Lead } from "./types";
import { generateVisitPlan } from "./planning";

function countBy(leads: Lead[], key: keyof Lead) {
  return leads.reduce<Record<string, number>>((acc, lead) => {
    const value = String(lead[key] ?? "Sem valor");
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

export function buildDashboardKpis(leads: Lead[]): DashboardKpis {
  return {
    totalLeads: leads.length,
    leadsByStatus: countBy(leads, "status"),
    leadsByLocality: countBy(leads, "locality"),
    suggestedVisitsToday: generateVisitPlan(leads).visits.length
  };
}
