// Data access. In M0 only GET /fleet is wired; more endpoints arrive with each milestone.
// NEXT_PUBLIC_USE_MOCK=true (default) reads web/public/mock/*.json so the UI can be built before the API.

import fs from "node:fs";
import path from "node:path";
import type { FleetResponse } from "./types";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export const isMock = USE_MOCK;

export async function getFleet(): Promise<FleetResponse> {
  if (USE_MOCK) {
    const file = path.join(process.cwd(), "public", "mock", "fleet.json");
    return JSON.parse(fs.readFileSync(file, "utf-8")) as FleetResponse;
  }
  const res = await fetch(`${API_BASE}/fleet`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /fleet failed: ${res.status}`);
  return (await res.json()) as FleetResponse;
}
