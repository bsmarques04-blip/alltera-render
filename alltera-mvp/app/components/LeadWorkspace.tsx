"use client";

import dynamic from "next/dynamic";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, RefreshCcw } from "lucide-react";
import { AppHeader } from "./AppHeader";
import { filterLeads, validateImportedRows } from "@/lib/normalization";
import { DashboardKpis, ImportPreview, Lead } from "@/lib/types";

const MapView = dynamic(() => import("./MapView").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => <div className="empty">A carregar mapa...</div>
});

type LeadsResponse = {
  leads: Lead[];
  kpis: DashboardKpis;
};

const emptyKpis: DashboardKpis = {
  totalLeads: 0,
  leadsByStatus: {},
  leadsByLocality: {},
  suggestedVisitsToday: 0
};

export function LeadWorkspace() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [kpis, setKpis] = useState<DashboardKpis>(emptyKpis);
  const [uploadStatus, setUploadStatus] = useState("Dados de exemplo ativos");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [locality, setLocality] = useState("Todas");
  const [clientType, setClientType] = useState("Todos");
  const [status, setStatus] = useState("Todos");

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    const response = await fetch("/api/leads");
    const data = (await response.json()) as LeadsResponse;
    setLeads(data.leads);
    setKpis(data.kpis);
  }

  const filteredLeads = useMemo(
    () => filterLeads(leads, { locality, clientType, status }),
    [leads, locality, clientType, status]
  );

  const localities = useMemo(
    () => ["Todas", ...Array.from(new Set(leads.map((lead) => lead.locality))).sort()],
    [leads]
  );

  async function handleExcelUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus("A validar ficheiro Excel...");
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const preview = validateImportedRows(rows, leads);

    setImportPreview(preview);
    setUploadStatus(
      `${preview.validLeads.length} leads validas, ${preview.errors.length} erros`
    );
    event.target.value = "";
  }

  async function confirmImport() {
    if (!importPreview || importPreview.validLeads.length === 0) return;

    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leads: importPreview.validLeads, mode: "append" })
    });
    const data = (await response.json()) as LeadsResponse;
    setLeads(data.leads);
    setKpis(data.kpis);
    setUploadStatus(`${importPreview.validLeads.length} leads guardadas`);
    setImportPreview(null);
  }

  async function resetSampleData() {
    const response = await fetch("/api/leads", { method: "DELETE" });
    const data = (await response.json()) as LeadsResponse;
    setLeads(data.leads);
    setKpis(data.kpis);
    setImportPreview(null);
    setUploadStatus("Dados de exemplo repostos");
  }

  return (
    <div className="shell">
      <AppHeader />
      <main className="main">
        <section className="toolbar">
          <div className="page-title">
            <h1>Gestao de leads B2B</h1>
            <p>
              Importe o Excel operacional da Alltera, valide os dados antes de guardar
              e acompanhe oportunidades comerciais no mapa.
            </p>
          </div>

          <div className="upload-box">
            <label className="upload-label">
              <FileSpreadsheet size={18} />
              Validar Excel
              <input accept=".xlsx,.xls" type="file" onChange={handleExcelUpload} />
            </label>
            <button className="icon-button" type="button" onClick={resetSampleData}>
              <RefreshCcw size={17} />
              Repor exemplo
            </button>
            <span className="status-text">{uploadStatus}</span>
          </div>
        </section>

        <ImportReview preview={importPreview} onConfirm={confirmImport} />

        <section className="kpi-grid" aria-label="Indicadores principais">
          <KpiCard label="Total de leads" value={kpis.totalLeads} />
          <KpiCard label="Localidades" value={Object.keys(kpis.leadsByLocality).length} />
          <KpiCard label="Estados" value={Object.keys(kpis.leadsByStatus).length} />
          <KpiCard label="Visitas sugeridas" value={kpis.suggestedVisitsToday} />
        </section>

        <section className="filters" aria-label="Filtros">
          <FilterSelect label="Localidade" value={locality} onChange={setLocality}>
            {localities.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </FilterSelect>

          <FilterSelect label="Tipo de cliente" value={clientType} onChange={setClientType}>
            <option>Todos</option>
            <option>Restaurante</option>
            <option>Hotel</option>
            <option>Outro</option>
          </FilterSelect>

          <FilterSelect label="Estado" value={status} onChange={setStatus}>
            <option>Todos</option>
            <option>Nova</option>
            <option>Contactada</option>
            <option>Qualificada</option>
            <option>Visita agendada</option>
            <option>Sem interesse</option>
          </FilterSelect>
        </section>

        <section className="content-grid">
          <LeadTable leads={filteredLeads} />
          <section className="panel map-panel">
            <div className="panel-header">
              <h2>Mapa de oportunidades</h2>
              <span className="badge">{filteredLeads.length} pins</span>
            </div>
            <MapView leads={filteredLeads} />
          </section>
        </section>
      </main>
    </div>
  );
}

function ImportReview({
  preview,
  onConfirm
}: {
  preview: ImportPreview | null;
  onConfirm: () => void;
}) {
  if (!preview) return null;

  return (
    <section className="import-review">
      <div className="import-summary">
        <span className="badge">
          <CheckCircle2 size={15} />
          {preview.validLeads.length} validas
        </span>
        <span className="badge warn">
          <AlertTriangle size={15} />
          {preview.errors.length} erros
        </span>
        <span className="small-muted">
          Duplicadas detetadas: {preview.duplicateCount}
        </span>
        <button
          className="primary-button"
          type="button"
          onClick={onConfirm}
          disabled={preview.validLeads.length === 0}
        >
          Confirmar importacao
        </button>
      </div>

      {preview.errors.length > 0 && (
        <div className="error-list">
          {preview.errors.slice(0, 8).map((error) => (
            <div className="error-item" key={`${error.row}-${error.message}`}>
              <strong>Linha {error.row}</strong>
              <span>{error.companyName}</span>
              <span>{error.message}</span>
            </div>
          ))}
          {preview.errors.length > 8 && (
            <div className="small-muted">
              Mais {preview.errors.length - 8} erros omitidos nesta vista.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </div>
  );
}

function LeadTable({ leads }: { leads: Lead[] }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Tabela de leads</h2>
        <span className="badge">{leads.length} resultados</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Tipo</th>
              <th>Localidade</th>
              <th>Estado</th>
              <th>Prioridade</th>
              <th>Contacto</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td className="name-cell">
                  <strong>{lead.name}</strong>
                  <span>
                    {lead.address}, {lead.postalCode}
                  </span>
                </td>
                <td>{lead.clientType}</td>
                <td>{lead.locality}</td>
                <td>
                  <span className="badge">{lead.status}</span>
                </td>
                <td>
                  <span className={lead.priority === "Alta" ? "badge warn" : "badge"}>
                    {lead.priority}
                  </span>
                </td>
                <td>
                  <span className="small-muted">
                    {lead.contact ? `${lead.contact} - ` : ""}
                    {lead.phone || lead.email || "Sem contacto"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
