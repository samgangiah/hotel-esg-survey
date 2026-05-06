import type { Role } from "@/lib/schema";

export type RoleKey = Role;

export const ROLE_KEYS: RoleKey[] = [
  "gm",
  "engineering",
  "housekeeping",
  "laundry",
  "finance",
  "energy_manager",
];

export const ROLE_LABELS: Record<RoleKey, string> = {
  gm: "General Manager",
  engineering: "Engineering / Maintenance",
  housekeeping: "Housekeeping",
  laundry: "Laundry",
  finance: "Finance",
  energy_manager: "Energy / ESG Manager",
};

export const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  gm: "Property-level overview, occupancy, EPC, certifications.",
  engineering: "HVAC, water, plant, BMS, set-points, equipment data.",
  housekeeping: "In-room behaviour, lighting, appliances, linen policy.",
  laundry: "Washer & drier per-machine details, ironing, dosing.",
  finance: "Energy bills, monthly kWh, SECR/ESOS reporting.",
  energy_manager: "ESG strategy, renewables, certifications, BMS scope.",
};
