"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Route } from "lucide-react";
import { AppHeader } from "./AppHeader";
import { Lead, LeadPriority, PlanningCriteria, VisitPlan } from "@/lib/types";

const MapView = dynamic(() => import("./MapView").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => <div className="empty">A carregar mapa...</div>
});

type LeadsResponse = {
  leads: Lead[];
};

const defaultPlan: VisitPlan = {
  locality: "Sem plano",
  totalDistanceKm: 0,
  averagePriority: 0,
  averagePriorityLabel: "Sem dados",
  distancesBetweenVisits: [],
  visits: []
};

export function PlanningView() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [locality, setLocality] = useState("");
  const [radiusKm, setRadiusKm] = useState(8);
  const [minimumPriority, setMinimumPriority] = useState<LeadPriority>("Media");
  const [maxVisits, setMaxVisits] = useState(5);
  const [plan, setPlan] = useState<VisitPlan>(defaultPlan);

  useEffect(() => {
    fetch("/api/leads")
      .then((response) => response.json())
      .then((data: LeadsResponse) => {
        setLeads(data.leads);
        setLocality(data.leads[0]?.locality ?? "");
      });
  }, []);

  const localities = useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.locality))).sort(),
    [leads]
  );

  async function generatePlan() {
    const criteria: PlanningCriteria = {
      locality,
      radiusKm,
      minimumPriority,
      maxVisits
    };

    const response = await fetch("/api/plan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criteria })
    });
    const data = (await response.json()) as { plan: VisitPlan };
    setPlan(data.plan);
  }

  return (
    <div className="shell">
      <AppHeader />
      <main className="main">
        <section className="toolbar">
          <div className="page-title">
            <h1>Planeamento Comercial</h1>
            <p>
              A sugestao considera apenas leads novas ou contactadas, agrupa
              oportunidades proximas dentro do raio definido e ordena visitas por
              prioridade e distancia.
            </p>
          </div>
        </section>

        <section className="planning-layout">
          <section className="panel planning-form">
            <div className="panel-header">
              <h2>Criterios de planeamento</h2>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Localidade</label>
                <select value={locality} onChange={(event) => setLocality(event.target.value)}>
                  {localities.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Raio em km</label>
                <input
                  min={1}
                  max={80}
                  type="number"
                  value={radiusKm}
                  onChange={(event) => setRadiusKm(Number(event.target.value))}
                />
              </div>

              <div className="field">
                <label>Prioridade minima</label>
                <select
                  value={minimumPriority}
                  onChange={(event) => setMinimumPriority(event.target.value as LeadPriority)}
                >
                  <option>Alta</option>
                  <option>Media</option>
                  <option>Baixa</option>
                </select>
              </div>

              <div className="field">
                <label>Maximo de visitas</label>
                <input
                  min={1}
                  max={12}
                  type="number"
                  value={maxVisits}
                  onChange={(event) => setMaxVisits(Number(event.target.value))}
                />
              </div>
            </div>

            <button
              className="primary-button full-button"
              disabled={!locality}
              type="button"
              onClick={generatePlan}
            >
              <Route size={18} />
              Gerar sugestao de visitas
            </button>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Mapa do plano</h2>
              <span className="badge">{plan.visits.length} visitas</span>
            </div>
            <MapView leads={plan.visits.length > 0 ? plan.visits : leads} />
          </section>
        </section>

        <section className="plan-panel">
          <div className="plan-header">
            <div>
              <h2>Sugestao para o dia</h2>
              <span className="small-muted">
                Localidade principal: {plan.locality}
              </span>
            </div>
            <span className="badge warn">{plan.visits.length} visitas</span>
          </div>

          {plan.visits.length === 0 ? (
            <div className="empty">
              Ainda nao foi gerado plano ou nao existem leads elegiveis para os criterios.
            </div>
          ) : (
            <>
              <section className="plan-metrics" aria-label="Resumo do plano">
                <article>
                  <span>Total de visitas</span>
                  <strong>{plan.visits.length}</strong>
                </article>
                <article>
                  <span>Distancia total</span>
                  <strong>{plan.totalDistanceKm} km</strong>
                </article>
                <article>
                  <span>Prioridade media</span>
                  <strong>
                    {plan.averagePriorityLabel} ({plan.averagePriority})
                  </strong>
                </article>
              </section>

              <ol className="visit-list">
                {plan.visits.map((lead, index) => (
                  <li className="visit-item detailed" key={lead.id}>
                    <span className="visit-index">{index + 1}</span>
                    <span>
                      <strong>{lead.name}</strong>
                      <span className="small-muted">
                        {lead.address}, {lead.postalCode} {lead.locality}
                      </span>
                      <span className="small-muted">
                        {index === 0
                          ? "Ponto inicial do percurso"
                          : `${plan.distancesBetweenVisits[index - 1]} km desde a visita anterior`}
                      </span>
                    </span>
                    <span className="badge">{lead.priority}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
