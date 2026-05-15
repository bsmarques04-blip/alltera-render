import {
  ClientType,
  ImportError,
  ImportPreview,
  Lead,
  LeadPriority,
  LeadStatus
} from "./types";

type RawLead = Record<string, unknown>;

const statusValues: LeadStatus[] = [
  "Nova",
  "Contactada",
  "Qualificada",
  "Visita agendada",
  "Sem interesse"
];

const priorityValues: LeadPriority[] = ["Alta", "Media", "Baixa"];

const requiredColumns = [
  "nome_empresa",
  "tipo_cliente",
  "morada",
  "codigo_postal",
  "localidade",
  "telefone",
  "estado_lead",
  "prioridade",
  "latitude",
  "longitude"
];

function read(row: RawLead, key: string): string {
  const found = Object.entries(row).find(
    ([candidate]) => candidate.trim().toLowerCase() === key
  );
  return found && found[1] !== undefined && found[1] !== null
    ? String(found[1]).trim()
    : "";
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeLocality(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeForComparison(value: string): string {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeClientType(value: string): ClientType {
  const lower = normalizeForComparison(value);
  if (lower.includes("hotel")) return "Hotel";
  if (lower.includes("restaurante") || lower.includes("restaurant")) return "Restaurante";
  return "Outro";
}

export function normalizeStatus(value: string): LeadStatus {
  const normalized = normalizeForComparison(value).replace(/_/g, " ");
  if (["novo", "nova"].includes(normalized)) return "Nova";
  if (["contactado", "contactada"].includes(normalized)) return "Contactada";
  if (["qualificado", "qualificada"].includes(normalized)) return "Qualificada";
  if (["visita agendada", "agendada"].includes(normalized)) return "Visita agendada";
  if (["sem interesse", "perdida", "perdido"].includes(normalized)) {
    return "Sem interesse";
  }

  const match = statusValues.find(
    (status) => normalizeForComparison(status) === normalized
  );
  return match ?? "Nova";
}

function isKnownStatus(value: string): boolean {
  return normalizeStatus(value) !== "Nova" || ["novo", "nova"].includes(normalizeForComparison(value));
}

function normalizePriority(value: string): LeadPriority {
  const normalized = normalizeForComparison(value);
  const match = priorityValues.find(
    (priority) => normalizeForComparison(priority) === normalized
  );
  return match ?? "Media";
}

function isKnownPriority(value: string): boolean {
  return priorityValues.some(
    (priority) => normalizeForComparison(priority) === normalizeForComparison(value)
  );
}

function parseCoordinate(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function duplicateKey(name: string, phone: string): string {
  return `${normalizeForComparison(name)}|${normalizeForComparison(phone)}`;
}

function leadDuplicateKey(lead: Lead): string {
  return duplicateKey(lead.name, lead.phone ?? "");
}

function validateRequiredFields(row: RawLead): string[] {
  return requiredColumns.filter((column) => !read(row, column));
}

function buildLead(row: RawLead, index: number): {
  lead: Lead | null;
  errors: string[];
} {
  const missing = validateRequiredFields(row);
  const errors: string[] = [];

  if (missing.length > 0) {
    errors.push(`Campos obrigatorios em falta: ${missing.join(", ")}`);
  }

  const latitude = parseCoordinate(read(row, "latitude"));
  const longitude = parseCoordinate(read(row, "longitude"));

  if (latitude === null || longitude === null) {
    errors.push("Latitude e longitude devem ser numeros validos");
  }

  if (read(row, "estado_lead") && !isKnownStatus(read(row, "estado_lead"))) {
    errors.push("estado_lead nao reconhecido");
  }

  if (read(row, "prioridade") && !isKnownPriority(read(row, "prioridade"))) {
    errors.push("prioridade deve ser Alta, Media ou Baixa");
  }

  if (errors.length > 0) {
    return { lead: null, errors };
  }

  return {
    lead: {
      id: `import-${Date.now()}-${index}`,
      name: normalizeText(read(row, "nome_empresa")),
      clientType: normalizeClientType(read(row, "tipo_cliente")),
      address: normalizeText(read(row, "morada")),
      postalCode: normalizeText(read(row, "codigo_postal")),
      locality: normalizeLocality(read(row, "localidade")),
      contact: normalizeText(read(row, "contacto")),
      email: normalizeText(read(row, "email")),
      phone: normalizeText(read(row, "telefone")),
      status: normalizeStatus(read(row, "estado_lead")),
      priority: normalizePriority(read(row, "prioridade")),
      notes: normalizeText(read(row, "observacoes")),
      latitude: latitude ?? 0,
      longitude: longitude ?? 0
    },
    errors: []
  };
}

export function validateImportedRows(
  rows: RawLead[],
  existingLeads: Lead[] = []
): ImportPreview {
  const existingKeys = new Set(existingLeads.map(leadDuplicateKey));
  const importedKeys = new Set<string>();
  const validLeads: Lead[] = [];
  const errors: ImportError[] = [];
  let duplicateCount = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const companyName = read(row, "nome_empresa") || `Linha ${rowNumber}`;
    const result = buildLead(row, index);

    if (!result.lead) {
      result.errors.forEach((message) =>
        errors.push({ row: rowNumber, companyName, message })
      );
      return;
    }

    const key = leadDuplicateKey(result.lead);
    if (existingKeys.has(key) || importedKeys.has(key)) {
      duplicateCount += 1;
      errors.push({
        row: rowNumber,
        companyName: result.lead.name,
        message: "Lead duplicada por nome_empresa + telefone"
      });
      return;
    }

    importedKeys.add(key);
    validLeads.push(result.lead);
  });

  return { validLeads, errors, duplicateCount };
}

export function filterLeads<T extends Lead>(
  leads: T[],
  filters: {
    locality?: string;
    clientType?: string;
    status?: string;
  }
) {
  return leads.filter((lead) => {
    const localityMatch =
      !filters.locality ||
      filters.locality === "Todas" ||
      lead.locality === filters.locality;
    const typeMatch =
      !filters.clientType ||
      filters.clientType === "Todos" ||
      lead.clientType === filters.clientType;
    const statusMatch =
      !filters.status ||
      filters.status === "Todos" ||
      lead.status === filters.status;

    return localityMatch && typeMatch && statusMatch;
  });
}
