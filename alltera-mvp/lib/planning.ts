import { Lead, LeadPriority, PlanningCriteria, VisitPlan } from "./types";

type GeoPoint = Pick<Lead, "latitude" | "longitude">;

const priorityScore: Record<LeadPriority, number> = {
  Alta: 3,
  Media: 2,
  Baixa: 1
};

const emptyPlan = (locality: string): VisitPlan => ({
  locality,
  totalDistanceKm: 0,
  averagePriority: 0,
  averagePriorityLabel: "Sem dados",
  distancesBetweenVisits: [],
  visits: []
});

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const earthRadiusKm = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function priorityMeetsMinimum(priority: LeadPriority, minimum: LeadPriority): boolean {
  return priorityScore[priority] >= priorityScore[minimum];
}

function isVisitCandidate(lead: Lead): boolean {
  return lead.status === "Nova" || lead.status === "Contactada";
}

function hasCoordinates(lead: Lead): boolean {
  return Number.isFinite(lead.latitude) && Number.isFinite(lead.longitude);
}

function sortByPriority(a: Lead, b: Lead): number {
  const priorityDiff = priorityScore[b.priority] - priorityScore[a.priority];
  if (priorityDiff !== 0) return priorityDiff;
  return a.name.localeCompare(b.name);
}

function averagePriorityScore(leads: Lead[]): number {
  if (leads.length === 0) return 0;
  const total = leads.reduce((sum, lead) => sum + priorityScore[lead.priority], 0);
  return Number((total / leads.length).toFixed(1));
}

function averagePriorityLabel(score: number): LeadPriority | "Sem dados" {
  if (score === 0) return "Sem dados";
  if (score >= 2.5) return "Alta";
  if (score >= 1.5) return "Media";
  return "Baixa";
}

function routeByPriorityAndDistance(leads: Lead[]): Lead[] {
  const pending = [...leads].sort(sortByPriority);
  const route: Lead[] = [];
  const first = pending.shift();

  if (!first) return route;
  route.push(first);

  while (pending.length > 0) {
    const current = route[route.length - 1];
    let nextIndex = 0;

    pending.forEach((candidate, index) => {
      const best = pending[nextIndex];
      const distanceDiff = distanceKm(current, candidate) - distanceKm(current, best);
      const priorityDiff = priorityScore[best.priority] - priorityScore[candidate.priority];

      if (distanceDiff < 0 || (distanceDiff === 0 && priorityDiff < 0)) {
        nextIndex = index;
      }
    });

    const [next] = pending.splice(nextIndex, 1);
    route.push(next);
  }

  return route;
}

function distancesBetweenVisits(visits: Lead[]): number[] {
  return visits.slice(1).map((lead, index) => {
    return Number(distanceKm(visits[index], lead).toFixed(1));
  });
}

function buildPlan(locality: string, visits: Lead[]): VisitPlan {
  const distances = distancesBetweenVisits(visits);
  const averagePriority = averagePriorityScore(visits);

  return {
    locality,
    totalDistanceKm: Number(distances.reduce((sum, distance) => sum + distance, 0).toFixed(1)),
    averagePriority,
    averagePriorityLabel: averagePriorityLabel(averagePriority),
    distancesBetweenVisits: distances,
    visits
  };
}

function groupScore(leads: Lead[]): number {
  return leads.reduce((sum, lead) => sum + priorityScore[lead.priority], 0);
}

function averageDistanceFromSeed(seed: Lead, leads: Lead[]): number {
  if (leads.length <= 1) return 0;
  const total = leads.reduce((sum, lead) => sum + distanceKm(seed, lead), 0);
  return total / leads.length;
}

function chooseBestGroup(groups: Array<{ seed: Lead; leads: Lead[] }>) {
  return groups.sort((a, b) => {
    const countDiff = b.leads.length - a.leads.length;
    if (countDiff !== 0) return countDiff;

    const scoreDiff = groupScore(b.leads) - groupScore(a.leads);
    if (scoreDiff !== 0) return scoreDiff;

    return averageDistanceFromSeed(a.seed, a.leads) - averageDistanceFromSeed(b.seed, b.leads);
  })[0];
}

export function generateVisitPlan(leads: Lead[], maxVisits = 6): VisitPlan {
  const candidates = leads
    .filter(isVisitCandidate)
    .sort(sortByPriority)
    .slice(0, maxVisits);

  if (candidates.length === 0) return emptyPlan("Sem plano");

  return buildPlan(candidates[0].locality, routeByPriorityAndDistance(candidates));
}

export function generateCommercialPlan(
  leads: Lead[],
  criteria: PlanningCriteria
): VisitPlan {
  const candidates = leads
    .filter(isVisitCandidate)
    .filter((lead) => lead.locality === criteria.locality)
    .filter((lead) => priorityMeetsMinimum(lead.priority, criteria.minimumPriority))
    .sort(sortByPriority);

  if (candidates.length === 0) return emptyPlan(criteria.locality);

  const candidatesWithCoordinates = candidates.filter(hasCoordinates);
  if (candidatesWithCoordinates.length === 0) {
    return buildPlan(criteria.locality, candidates.slice(0, criteria.maxVisits));
  }

  const groups = candidatesWithCoordinates.map((seed) => ({
    seed,
    leads: candidatesWithCoordinates.filter((lead) => distanceKm(seed, lead) <= criteria.radiusKm)
  }));

  const bestGroup = chooseBestGroup(groups);
  if (!bestGroup) return emptyPlan(criteria.locality);

  const visits = routeByPriorityAndDistance(bestGroup.leads).slice(0, criteria.maxVisits);
  return buildPlan(criteria.locality, visits);
}
