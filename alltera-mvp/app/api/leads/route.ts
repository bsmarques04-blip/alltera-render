import { NextResponse } from "next/server";
import { buildDashboardKpis } from "@/lib/kpis";
import { appendLeads, getLeads, replaceLeads, resetLeads } from "@/lib/store";
import { Lead } from "@/lib/types";

export async function GET() {
  const leads = getLeads();
  return NextResponse.json({ leads, kpis: buildDashboardKpis(leads) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { leads?: Lead[]; mode?: "append" | "replace" };

  if (!Array.isArray(body.leads)) {
    return NextResponse.json(
      { message: "Pedido invalido: leads deve ser uma lista." },
      { status: 400 }
    );
  }

  const leads =
    body.mode === "append" ? appendLeads(body.leads) : replaceLeads(body.leads);
  return NextResponse.json({ leads, kpis: buildDashboardKpis(leads) });
}

export async function DELETE() {
  const leads = resetLeads();
  return NextResponse.json({ leads, kpis: buildDashboardKpis(leads) });
}
