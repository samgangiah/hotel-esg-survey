#!/usr/bin/env node
// One-off transform: adds `level` (per question) and `roles` (per group)
// to data/questions.json. Bumps meta.version to 0.3.
//
// Run with: node scripts/tag-questions.mjs
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data/questions.json";
const json = JSON.parse(readFileSync(PATH, "utf8"));

// --- Group → roles ----------------------------------------------------------
const groupRoles = {
  general_main: ["gm", "engineering", "energy_manager", "finance"],
  rooms_hvac: ["engineering", "gm"],
  rooms_lighting: ["engineering", "housekeeping"],
  rooms_water: ["engineering"],
  rooms_appliances: ["housekeeping", "gm"],
  rooms_process: ["housekeeping", "gm"],
  rooms_other: ["gm", "engineering", "housekeeping"],
  laundry_overview: ["laundry", "engineering", "gm"],
  laundry_washers: ["laundry", "engineering"],
  laundry_driers: ["laundry", "engineering"],
  laundry_ironing: ["laundry"],
  laundry_other: ["laundry", "gm"],
};

// --- Question id → level ----------------------------------------------------
// Defaults by section (overridable per id below).
const sectionDefault = {
  general: "site",
  rooms: "building",
  laundry: "building",
};

const levelById = {
  // general — building-specific
  general_room_count: "building",
  general_floors: "building",
  general_property_age: "building",
  general_epc_rating: "building",
  general_epc_certificate: "building",

  // general — organisation-level
  general_secr_required: "org",
  general_certifications: "org",
  general_certifications_other: "org",

  // (everything else in general defaults to 'site' via section default.)
};

// --- Apply ------------------------------------------------------------------
let questionCount = 0;
for (const section of json.sections) {
  for (const group of section.groups) {
    group.roles = groupRoles[group.id] ?? ["gm"];
    for (const q of group.questions) {
      q.level = levelById[q.id] ?? sectionDefault[section.id] ?? "building";
      questionCount++;
      // Repeater sub-questions inherit the parent's level (always per-item under a building).
      if (q.subQuestions) {
        for (const sq of q.subQuestions) {
          sq.level = q.level;
          questionCount++;
        }
      }
    }
  }
}

json.meta.version = "0.3";

writeFileSync(PATH, JSON.stringify(json, null, 2) + "\n", "utf8");
console.log(`Tagged ${questionCount} questions across ${json.sections.length} sections.`);
console.log("Bumped meta.version to 0.3.");
