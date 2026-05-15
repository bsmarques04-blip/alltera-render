"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "./AppHeader";
import { DashboardKpis } from "@/lib/types";

const emptyKpis: DashboardKpis = {
  totalLeads: 0,
  leadsByStatus: {},
  leadsByLocality: {},
  suggestedVisitsToday: 0
};

export function DashboardView() {
  const [kpis, setKpis] = useState<DashboardKpis>(emptyKpis);

  useEffect(() => {
    fetch("/api/leads")
      .then((response) => response.json())
      .then((data) => setKpis(data.kpis));
  }, []);

  return (
    <div className="shell">
      <AppHeader />
      <main className="main">
        <section className="toolbar">
          <div className="page-title">
            <h1>Dashboard comercial</h1>
            <p>
              Indicadores para acompanhar o funil de leads, concentracao geografica
              e capacidade diaria sugerida para a equipa comercial.
            </p>
          </div>
        </section>

        <section className="kpi-grid">
          <article className="kpi-card">
            <span>Total de leads</span>
            <strong>{kpis.totalLeads}</strong>
          </article>
          <article className="kpi-card">
            <span>Localidades com leads</span>
            <strong>{Object.keys(kpis.leadsByLocality).length}</strong>
          </article>
          <article className="kpi-card">
            <span>Estados no pipeline</span>
            <strong>{Object.keys(kpis.leadsByStatus).length}</strong>
          </article>
          <article className="kpi-card">
            <span>Visitas sugeridas hoje</span>
            <strong>{kpis.suggestedVisitsToday}</strong>
          </article>
        </section>

        <section className="dashboard-grid">
          <BreakdownPanel title="Leads por estado" values={kpis.leadsByStatus} />
          <BreakdownPanel title="Leads por localidade" values={kpis.leadsByLocality} />
        </section>
      </main>
    </div>
  );
}

function BreakdownPanel({
  title,
  values
}: {
  title: string;
  values: Record<string, number>;
}) {
  const max = Math.max(1, ...Object.values(values));

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
      </div>
      {Object.entries(values).length === 0 ? (
        <div className="empty">Sem dados disponiveis.</div>
      ) : (
        Object.entries(values).map(([label, value]) => (
          <div className="bar-row" key={label}>
            <strong>{label}</strong>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(value / max) * 100}%` }} />
            </span>
            <span>{value}</span>
          </div>
        ))
      )}
    </section>
  );
}
