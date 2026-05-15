import { sampleLeads } from "./sample-data";
import { Lead } from "./types";

let leads: Lead[] = [...sampleLeads];

export function getLeads() {
  return leads;
}

export function replaceLeads(nextLeads: Lead[]) {
  leads = nextLeads;
  return leads;
}

export function appendLeads(nextLeads: Lead[]) {
  leads = [...leads, ...nextLeads];
  return leads;
}

export function resetLeads() {
  leads = [...sampleLeads];
  return leads;
}
