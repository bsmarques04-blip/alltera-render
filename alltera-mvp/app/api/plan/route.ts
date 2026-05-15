import { NextResponse } from "next/server";
import { filterLeads } from "@/lib/normalization";
import { generateCommercialPlan, generateVisitPlan } from "@/lib/planning";
import { getLeads } from "@/lib/store";
import { LeadPriority, PlanningCriteria } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    filters?: {
      locality?: string;
      clientType?: string;
      status?: string;
    };
  };

  const scopedLeads = filterLeads(getLeads(), body.filters ?? {});
  return NextResponse.json({ plan: generateVisitPlan(scopedLeads) });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { criteria?: PlanningCriteria };

  if (!body.criteria) {
    return NextResponse.json(
      { message: "Criterios de planeamento em falta." },
      { status: 400 }
    );
  }

  const criteria = normalizeCriteria(body.criteria);

  return NextResponse.json({
    plan: generateCommercialPlan(getLeads(), criteria)
  });
}

function normalizeCriteria(criteria: PlanningCriteria): PlanningCriteria {
  const priorities: LeadPriority[] = ["Alta", "Media", "Baixa"];
  const minimumPriority = priorities.includes(criteria.minimumPriority)
    ? criteria.minimumPriority
    : "Baixa";

  return {
    locality: criteria.locality,
    radiusKm: Math.max(1, Number(criteria.radiusKm) || 1),
    minimumPriority,
    maxVisits: Math.min(12, Math.max(1, Number(criteria.maxVisits) || 1))
  };
}
