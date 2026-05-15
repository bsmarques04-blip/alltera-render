export type ClientType = "Restaurante" | "Hotel" | "Outro";

export type LeadStatus =
  | "Nova"
  | "Contactada"
  | "Qualificada"
  | "Visita agendada"
  | "Sem interesse";

export type LeadPriority = "Alta" | "Media" | "Baixa";

export type Lead = {
  id: string;
  name: string;
  clientType: ClientType;
  address: string;
  postalCode: string;
  locality: string;
  status: LeadStatus;
  priority: LeadPriority;
  latitude: number;
  longitude: number;
  contact?: string;
  phone?: string;
  email?: string;
  notes?: string;
};

export type LeadFilters = {
  locality?: string;
  clientType?: ClientType | "Todos";
  status?: LeadStatus | "Todos";
};

export type VisitPlan = {
  locality: string;
  totalDistanceKm: number;
  averagePriority: number;
  averagePriorityLabel: LeadPriority | "Sem dados";
  distancesBetweenVisits: number[];
  visits: Lead[];
};

export type ImportError = {
  row: number;
  companyName: string;
  message: string;
};

export type ImportPreview = {
  validLeads: Lead[];
  errors: ImportError[];
  duplicateCount: number;
};

export type PlanningCriteria = {
  locality: string;
  radiusKm: number;
  minimumPriority: LeadPriority;
  maxVisits: number;
};

export type DashboardKpis = {
  totalLeads: number;
  leadsByStatus: Record<string, number>;
  leadsByLocality: Record<string, number>;
  suggestedVisitsToday: number;
};
