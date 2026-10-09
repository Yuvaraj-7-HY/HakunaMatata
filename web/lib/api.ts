// Data access layer.
//
// NEXT_PUBLIC_USE_MOCK (default true) reads the static JSON in web/public/mock
// so every screen works before the API exists. Set NEXT_PUBLIC_USE_MOCK=false
// to talk to the FastAPI replay engine (api/, M6).

import type {
  AgentAskResponse,
  FleetResponse,
  HistoryRange,
  HistoryResponse,
  MachineResponse,
  ReplayResponse,
  Scenario,
  ScoreboardResponse,
} from "./types";

import fleetJson from "@/public/mock/fleet.json";
import machineM04Json from "@/public/mock/machine_M-04.json";
import machineM04HistoryJson from "@/public/mock/machine_M-04_history.json";
import replayScenariosJson from "@/public/mock/replay_scenarios.json";
import replaySc01Json from "@/public/mock/replay.json";
import replaySc02Json from "@/public/mock/replay_sc-02.json";
import replaySc03Json from "@/public/mock/replay_sc-03.json";
import scoreboardJson from "@/public/mock/scoreboard.json";
import agentAskJson from "@/public/mock/agent_ask.json";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export const isMock = USE_MOCK;
export const MOCK_MACHINE_ID = "M-04";

function clone<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function getFleet(): Promise<FleetResponse> {
  if (USE_MOCK) return clone<FleetResponse>(fleetJson);
  return getJson<FleetResponse>("/fleet");
}

/** True when a dedicated mock evidence file exists for this machine. */
export function hasMachineMock(id: string): boolean {
  return id === MOCK_MACHINE_ID;
}

export async function getMachine(id: string): Promise<MachineResponse> {
  if (USE_MOCK) {
    // Only M-04 ships a full evidence mock; other rows reuse it and the page
    // labels the sample honestly.
    void id;
    return clone<MachineResponse>(machineM04Json);
  }
  return getJson<MachineResponse>(`/machine/${id}`);
}

export async function getMachineHistory(
  id: string,
  range: HistoryRange = "24h"
): Promise<HistoryResponse> {
  if (USE_MOCK) {
    void id;
    void range;
    return clone<HistoryResponse>(machineM04HistoryJson);
  }
  return getJson<HistoryResponse>(`/machine/${id}/history?range=${range}`);
}

export async function getScenarios(): Promise<Scenario[]> {
  if (USE_MOCK) return clone<Scenario[]>(replayScenariosJson);
  return getJson<Scenario[]>("/replay/scenarios");
}

export async function getReplay(scenarioId: string): Promise<ReplayResponse> {
  if (USE_MOCK) {
    if (scenarioId === "sc-02") return clone<ReplayResponse>(replaySc02Json);
    if (scenarioId === "sc-03") return clone<ReplayResponse>(replaySc03Json);
    return clone<ReplayResponse>(replaySc01Json);
  }
  return getJson<ReplayResponse>(`/replay/${scenarioId}`);
}

export async function getScoreboard(): Promise<ScoreboardResponse> {
  if (USE_MOCK) return clone<ScoreboardResponse>(scoreboardJson);
  return getJson<ScoreboardResponse>("/scoreboard");
}

export async function askAgent(question: string): Promise<AgentAskResponse> {
  if (USE_MOCK) {
    const canned = clone<AgentAskResponse>(agentAskJson);
    return { ...canned, answer: `${canned.answer}\n\n(echo) Question: ${question}` };
  }
  const res = await fetch(`${API_BASE}/agent/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(`POST /agent/ask failed: ${res.status}`);
  return (await res.json()) as AgentAskResponse;
}
