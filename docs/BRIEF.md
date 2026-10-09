# AGENT BRIEF: Predictive Maintenance for Mysuru Manufacturing (PS CSE/AIML-06)

Paste this whole document to your coding agent as the first message. Keep it in the repo as `docs/BRIEF.md` and update it as decisions change.

---

## 0. How to work with me (read first)

- The builder is a CSE student comfortable with Next.js/React, n8n, and AI agent building. This is a **hackathon prototype**, not production. Optimize for: *an honest, reproducible demo that answers the problem statement's two questions with evidence*.
- Work **one milestone at a time** (Section 15). After each milestone: stop, summarize what you built, and tell me **exactly how to verify it** (commands, URLs, expected output). Do not start the next milestone until I confirm.
- Do **not** add features outside Section 4. If you think something is missing, propose it in one sentence and wait.
- Ask at most 1 to 2 questions at a time, only when truly blocked. Otherwise make the simplest reasonable choice and state it.
- **Never claim something works unless you ran it.** Report test output, not intentions.
- Everything must be **free**: open-source libraries, local services, free-tier APIs only. No secrets in the repo; use `.env` files and commit `.env.example`.
- Prefer boring, simple code. No premature abstractions. The one deliberate boundary: the detector must never import the simulator (Section 8.1).
- When you are unsure about a library API or a free-tier limit, say so and check, instead of guessing.

---

## 1. The problem statement

**Title:** 06. Predictive Maintenance for Mysuru Manufacturing (code CSE/AIML-06)
**Subtitle:** "The Machine That Warned Everyone Without Speaking"

**Scenario (summary):** In a Mysuru manufacturing facility, motors, pumps, compressors and other equipment run for hours every day. One morning an operator notices a machine sounds slightly different and runs a little warmer. It still works, so production continues; nobody wants to stop a working machine without a clear reason. Days later it suddenly stops, production halts, and maintenance is called. On investigation, the team realises the machine may have been showing subtle warning signs earlier: changed vibration, increased current consumption, shifted temperature or acoustic signature. The difficulty is that these signals are buried in large amounts of normal operating data.

**The questions posed:**
1. Given the machine's historical data, how would you investigate whether the machine was actually giving a warning before it failed?
2. What would convince you that a particular change was important enough to act upon?

**Industry / institutional connection:** Automotive, engineering, machining and industrial manufacturing companies in Mysuru.
**Prototype opportunity (30%):** ML-based anomaly detection, failure classification, remaining-useful-life estimation or machine-health scoring.
**Expected demonstration / outcome:** A sensor-data or simulated-data model that identifies abnormal operating conditions.

*(The full judging rubric is not known beyond this. Treat the prototype as 30% of the score and assume the rest rewards how well we reason about the two questions.)*

---

## 2. Our interpretation and intent

**One sentence:** A system that learns what normal looks like for each machine under each operating condition, scores how far it has drifted (a 0 to 100 health score), alerts only when the drift is sustained and corroborated across signals, **proves on held-out failures how much warning it would have given**, and lets a maintenance team inspect the evidence and ask an AI agent why a machine was flagged.

**How we answer the two questions:**
- *"Was it warning us?"* A **failure replay** shows the health score drifting before a known failure, with the alert marker and the measured **lead time**, compared against a naive threshold.
- *"What convinces us to act?"* A **sustained, multi-signal drift**, beyond a threshold we chose from healthy data only, with the trade-off between false alarms and lead time shown interactively.

**Core philosophy:**
- The model and the investigation matter most. The UI exists to make the evidence visible.
- **Honesty over polish.** The data is simulated, so we disclose that and design the evaluation so it is not circular (Section 8.1 and 10).
- We never claim a *confirmed* fault. Subsystem attributions are **suspected**, based on which signals drifted.
- Safety posture: when in doubt, flag for human inspection; never prescribe repairs beyond "inspect".

---

## 3. Hard constraints

- **Completely free** stack and services.
- **All data is generated** by our own simulator (there is no real plant data). Everything in the UI must be labelled as simulated.
- Must run locally on a laptop for the demo, from one command each (API, web, n8n).
- Demo must run on **compressed time** (for example one simulated day per 10 seconds) using the real detector, never a scripted fake.
- Time budget is limited and unknown; follow the cut order in Section 18.

---

## 4. Scope

### In scope
1. A **physics-grounded simulator** that generates multi-machine sensor data with regimes, noise, nuisance events, degradation modes, and ground truth.
2. A **causal (streaming-safe) detector**: regime-adjusted residuals, features, anomaly model, health score, alert logic, explainability.
3. An **evaluation harness** with baselines, a hidden test fleet, and honest metrics.
4. A **replay engine and API** that serves the data as a simulated live stream with presenter controls.
5. A **dashboard with four screens**: Fleet overview, Machine evidence, Failure replay and proof, Ask the agent.
6. A **grounded chat agent** that answers only from tool results.
7. **Alerts via n8n** to Telegram.

### Out of scope (do NOT build)
Real sensor ingestion or hardware, authentication/accounts, multi-plant or multi-tenant features, work-order integration (the "Schedule inspection" button is a mock), 3D models, mobile app, cloud deployment, claims of real-world accuracy, prescriptive repair advice. A simple 2D schematic is allowed; 3D is not unless explicitly requested later.

---

## 5. Architecture

```
 SIMULATOR (offline)                       ground truth (events table)
   generates fleet_demo + eval_dev + eval_hidden       |
        |                                              |
        v   (sensor readings only: no ground truth)    |
 REPLAY ENGINE (FastAPI background task)               |
   sim clock per machine, speed, play/pause            |
        |                                              |
        v                                              |
 DETECTOR.update(batch)  -> health, status, contributors
        |
        v
 SQLite: readings | scores | alerts | sim_state | machines
        |                    |
        v                    v
   REST API  <----  alert webhook ----> n8n -> Telegram
        |
        v
 NEXT.JS DASHBOARD (4 screens) + CHAT PANEL -> /agent/ask -> LLM with tools
```

**Key design decisions**
- **One engine, two features.** The replay engine serves both "simulated live" and the "failure replay" screen.
- **Causality is enforced and tested.** At simulated time T the detector only sees data up to T. A unit test must prove it (Section 9.6).
- **The detector is blind to the generator.** It consumes a DataFrame of readings and nothing else. Ground truth is used only by the evaluation harness and by tests.
- **n8n is for alert routing, not streaming.** Python does the high-frequency work.

---

## 6. Tech stack

| Layer | Choice |
|---|---|
| Simulator, detector, evaluation | Python 3.11+, numpy, pandas, scipy, scikit-learn, matplotlib |
| API and replay engine | FastAPI, uvicorn, pydantic, SQLite (sqlite3 or SQLModel) |
| Dashboard | Next.js (App Router), TypeScript, Tailwind CSS, Recharts, polling every 2 to 3 seconds |
| Alerts | n8n (local, Docker is possible), Webhook node, Telegram Bot API |
| Chat agent | A free-tier LLM with function/tool calling (Gemini or Groq; **verify current free limits**), plus a deterministic fallback (Section 13.3) |

Open decision for the agent to ask me early: Python and Node versions, whether n8n runs in Docker (changes localhost routing), and which LLM key I have.

---

## 7. Repo layout

```
/analysis
  sim/            generator.py, machines.py, scenarios.py
  detector/       features.py, regime.py, baselines.py, model.py, health.py, alerts.py, explain.py
  eval/           harness.py, metrics.py, report.py
  notebooks/      exploration only
/api              main.py, replay.py, db.py, schemas.py, agent.py, config.py
/web              Next.js app (components listed in Section 12)
  public/mock/    mock JSON for every endpoint (Section 11)
/n8n              exported workflows + docs
/data             generated files (gitignored): fleet_demo.parquet, eval_dev.parquet, eval_hidden.parquet, events_*.parquet
/docs             BRIEF.md
/tests
```

**Boundary rule:** nothing under `/analysis/detector` may import from `/analysis/sim`. Ground truth lives in separate `events_*` files.

---

## 8. The simulator

### 8.1 Why it must be careful
Because we write the data generator, a detector can "discover" what we built in, which makes accuracy numbers circular. We mitigate by: (a) modelling realistic degradation physics and nuisance events, (b) keeping the detector blind to the generator, (c) evaluating on a **hidden fleet** generated with **held-out seeds and shifted parameter ranges**, (d) disclosing all of this in the UI and pitch. Lead-time numbers demonstrate the *method*, not field performance.

### 8.2 Data schema (one row per machine per 10 minutes)
`ts, machine_id, vibration_rms (mm/s), vibration_kurtosis, temperature_c, current_a, load_pct, speed_rpm, ambient_c`. Sensor dropouts appear as NaN or flat-lined segments. Document every unit and assumption in `sim/README`; values are **illustrative, not real plant measurements**.

### 8.3 Machine types (illustrative parameters per type)
CNC spindle motor, air compressor, hydraulic pump, lathe drive, coolant pump. Each has base vibration, base temperature rise, base current, load sensitivities, and a thermal time constant.

### 8.4 Operating regime
- Three-shift pattern with job-driven load changes: `load_pct` between about 20 and 95 with piecewise-constant jobs.
- Discrete speed levels per type.
- Ambient temperature: daily sinusoid plus seasonal offset plus random heat-wave episodes.

### 8.5 Healthy signal model
- `vibration_rms = base * (1 + a*load + b*speed_factor) + AR(1) noise`
- `temperature_c = ambient + thermal_response(load) with first-order lag + noise`
- `current_a = base + c*load + noise`
- `vibration_kurtosis` is near 3 with noise.

### 8.6 Degradation modes (each with random onset time and progression shape: linear or exponential)
Let `g(t)` go from 0 at onset to 1 at failure.
1. **bearing_wear:** kurtosis rises early, vibration RMS rises, temperature rises late. Component: "Rotating assembly (bearings)".
2. **cooling_fault:** temperature rises relative to load-expected; vibration unchanged. Component: "Cooling and lubrication".
3. **drive_load_issue:** current rises with added ripple; vibration modest. Component: "Drive and load path".
4. **sudden_fault:** step change within hours, very short warning. Included on purpose to show honest limits.

### 8.7 Nuisance events (look like faults but are not)
Load surges lasting hours to days, heat waves, startup transients at shift start, sensor dropouts, and **maintenance resets** (a component is replaced and the baseline returns). These exist to test false alarms.

### 8.8 Ground truth outputs
`events_*.parquet`: `machine_id, mode, component, onset_ts, failure_ts, nuisance_events[]`. Never fed to the detector.

### 8.9 Datasets
- **fleet_demo:** 8 machines for the live demo: 3 healthy, 2 slow drift, 1 near failure, 1 with a nuisance false alarm, 1 sudden fault. 90 days each, first 14 days healthy (commissioning).
- **eval_dev:** about 30 failures plus about 10 healthy-with-nuisance machines, seeds 0 to 99. Used for development and threshold calibration.
- **eval_hidden:** same structure, **seeds 1000 to 1099**, with noise scaled about 1.2x and progression-rate ranges shifted about 30 percent beyond the dev ranges. Evaluated at most once per milestone, every run logged.
- Simulator must be **deterministic given a seed** (unit test).

---

## 9. The detector

### 9.1 Interface (must be causal)
```python
class Detector:
    def fit_baseline(self, commissioning_df): ...   # first 14 healthy days per machine
    def update(self, batch_df) -> list[MachineState]  # incremental; never sees the future
```
`MachineState`: `machine_id, ts, health (0-100), status (healthy|watch|act_now), status_since, contributors[{signal, z, share}], suspected_subsystem|None, basis`.

### 9.2 Regime normalization (the crux)
Fit, per machine, an expected-value model of each signal given operating regime (load, lagged/EWMA load for thermal lag, speed, ambient). Start with polynomial regression (degree 2 with interactions); try gradient boosting only if needed. Compute **residuals** and standardize with the commissioning-period residual standard deviation to get z-scores. Without this step the detector becomes a load detector.

### 9.3 Features (rolling windows of residual z, sample = 10 min: 6h = 36, 24h = 144)
Rolling mean and std, EWMA, CUSUM statistic, 24h and 72h slopes, rolling kurtosis of vibration, count of signals beyond threshold.

### 9.4 Methods to compare (all implemented, all evaluated)
- **B0 naive:** fixed threshold on raw vibration RMS.
- **B1 control chart:** EWMA or CUSUM on regime-adjusted residuals.
- **M main model:** IsolationForest or PCA reconstruction error on rolling residual features (autoencoder only if time allows).
Keep whichever is best on dev. If M does not beat B1, **keep B1 and report that honestly.**

### 9.5 Health score and alert logic (all parameters in `config.py`, tuned on dev only)
- Calibrate anomaly score `a` on healthy dev data: `p50`, `p99`, `p99.9`.
- Piecewise-linear map: `a = p50 -> 100`, `p99 -> 70`, `p99.9 -> 50`, `2 * p99.9 -> 0`. So **Watch (below 70) means beyond the 99th percentile of healthy behavior; Act now (below 50) means beyond the 99.9th.**
- **Watch** when health < 70 for at least 6 consecutive hours AND (at least 2 signals have |z| > 2 OR any signal |z| > 4).
- **Act now** when health < 50 for at least 3 consecutive hours.
- **Resolve** when health > 75 for at least 12 hours (hysteresis). Dedupe: one alert per status change.

### 9.6 Required tests
- **Causality test:** scores computed on data truncated at T must equal scores computed on the full data at the same timestamps.
- Simulator determinism by seed.
- Metric functions verified on tiny handmade series.

### 9.7 Explainability and subsystem attribution
Contributors = signals ranked by |z| with shares. Map patterns to a **suspected** subsystem with a simple rule table: vibration and kurtosis up -> "Rotating assembly (bearings)"; temperature up only -> "Cooling and lubrication"; current up with modest vibration -> "Drive and load path"; broad multi-signal -> "General degradation: inspect". Validate the table against simulator ground truth in the evaluation report. Every UI display says "Suspected, not a confirmed fault."

---

## 10. Evaluation protocol (this is where credibility comes from)

**Definitions (per failure):** `lead_time = failure_ts - first_alert_ts` where the first alert falls between `onset_ts` and `failure_ts`. **Missed** = no alert in that window. **False alarm episode** = an alert outside the onset-to-failure window (merge episodes within 6 hours); on healthy machines every alert episode is false. Also report detection delay = `first_alert_ts - onset_ts`.

**Metrics:** median and mean lead time, lead-time distribution, false alarms per machine-week, missed failures, per mode and overall, for B0, B1, and M. Also report the sudden-fault mode separately to show where early warning is not possible.

**Rules:**
- Choose all thresholds and persistence parameters on **eval_dev** only.
- Evaluate **eval_hidden** once per milestone; log every run.
- Splits by machine and seed, never random rows.
- Produce a sensitivity sweep (threshold vs false alarms per week vs median lead time) for the UI slider.
- Produce a short written report: what worked, what did not, the limits, and what a real plant would need to provide.

---

## 11. Replay engine and API

### 11.1 SQLite tables
`machines(id, name, type, location)`, `readings(machine_id, ts, ...signals)`, `scores(machine_id, ts, health, status, contributors_json)`, `alerts(id, machine_id, ts, level, reason, resolved_ts)`, `sim_state(machine_id, sim_ts, speed, playing)`.

### 11.2 Replay behaviour
A background task advances each machine's simulated clock by `speed`; at each tick it takes the new readings, calls `Detector.update`, stores scores, and on a status change creates an alert and POSTs the n8n webhook (header `X-Alert-Secret`). Presenter controls: play, pause, speed (1x, 1 day per 10 s, 1 day per 3 s), and "jump to 72 hours before failure". Stage the fleet by starting machines at different points in their lives.

### 11.3 Endpoints (build the mock JSON for these in M0)
```
GET /fleet
{ "sim_time":"...", "mode":"simulated_live", "speed":..., "playing":true,
  "kpis":{"monitored":8,"healthy":5,"watch":2,"act_now":1,"alerts_today":3},
  "machines":[{"id":"M-04","name":"CNC spindle motor","health":41,"status":"act_now",
     "status_since":"...","sparkline":[...14 values...],"suspected_subsystem":"Rotating assembly",
     "load_pct":72,"speed_rpm":1800}],
  "heatmap":{"machine_ids":[...],"days":[...],"values":[[...]]},
  "alerts":[{"id":1,"machine_id":"M-04","level":"act_now","ts":"...","reason":"..."}] }

GET /machine/{id}
{ "id":"M-04","name":"...","type":"...","regime":{"load_pct":72,"speed_rpm":1800,"ambient_c":31},
  "status":"act_now","health":41,"status_since":"...",
  "signals":[{"name":"vibration_rms","unit":"mm/s","value":..,"expected":..,"band_low":..,"band_high":..,"z":3.2}],
  "why_flagged":{"contributors":[{"signal":"vibration_rms","z":3.2,"share":0.7}],
                 "drift_hours":120,"signals_agreeing":2,"signals_total":4},
  "context":[{"ts":"...","text":"Load rose 20% at 14:00; this explains part of the vibration increase."}],
  "suspected":{"subsystem":"Rotating assembly","basis":"vibration and kurtosis drifted","caveat":"Suspected, not a confirmed fault."},
  "suggested_action":"Schedule an inspection" }

GET /machine/{id}/history?range=24h|7d|30d
{ "ts":[...],"health":[...],"signals":{"vibration_rms":{"value":[],"expected":[],"band_low":[],"band_high":[]}},
  "thresholds":{"watch":70,"act_now":50},
  "markers":[{"ts":"...","type":"alert|maintenance|regime_change","label":"..."}] }

GET /replay/scenarios  -> [{"id","machine","mode","summary"}]
GET /replay/{scenario_id}
{ "ts":[...],"health_ours":[...],"health_naive":[...],
  "markers":{"drift_begins":"...","alert_ours":"...","alert_naive":"...","failure":"..."},
  "lead_time_hours_ours":..,"lead_time_hours_naive":..,"false_alarms_ours":..,"false_alarms_naive":.. }

GET /scoreboard?watch=70&act_now=50
{ "n_failures":..,"methods":{"naive":{"median_lead_h":..,"fa_per_week":..,"missed":..},"ewma":{..},"ours":{..}},
  "lead_time_hist":{"bins":[],"ours":[],"naive":[]},
  "sweep":[{"threshold":..,"fa_per_week":..,"median_lead_h":..}] }

POST /sim/control  {"action":"play|pause|speed|jump","speed":..,"scenario":"..","machine_id":"..","target":"before_failure_72h"}
POST /agent/ask    {"question":"..."} -> {"answer":"..","tool_calls":[{"name","args"}],"citations":[{"machine_id","window"}],"chart":null|{...}}
```
Scoreboard and replay numbers come from precomputed evaluation outputs (hidden fleet), never recomputed live.

---

## 12. Dashboard specification (exactly four screens)

**Visual direction:** light industrial control-room look. Font IBM Plex Sans. Palette: ground `#F6F7F5`, ink `#14201C`, teal `#0F6B5C` (healthy/primary), amber `#C98500` (watch), red `#B3261E` (act now). Status is always **text plus color**, never color alone. Touch targets at least 44px. Every input has a label. A persistent badge reads **"Simulated live"**, and a data drawer explains how the data is generated. Reference mock (layout only): https://claude.ai/artifact/NBq5iNw7XmKsfXTTjKFS1F

**Mock mode:** `NEXT_PUBLIC_USE_MOCK=true` loads `/public/mock/*.json` so the frontend can be built before the API exists.

### Screen 1: Fleet overview (home)
- **Top bar:** plant name, simulated clock, "Simulated live" badge, play/pause, speed selector, scenario picker (slow bearing wear, sudden cooling fault, false-alarm load spike, healthy day).
- **KPI tiles:** monitored, healthy, watch, act now, alerts today.
- **Machine table:** health score bar, status, time in status, 14-day sparkline, suspected subsystem; sorted worst first; each row links to Screen 2.
- **Fleet heatmap:** machines by days colored by health.
- **Alert feed:** newest first with machine, one-line reason, time, link to evidence.
- **Data drawer:** "About this data."

### Screen 2: Machine evidence
- **Header:** type, current load and speed, status, health score, time in status.
- **Health timeline:** normal band, Watch and Act-now threshold lines, alert and maintenance markers, range tabs (24h, 7d, 30d).
- **Signal panels:** a small chart per signal showing value vs the expected band for the current regime, plus deviation in standard deviations.
- **Why flagged:** top contributors, drift duration, signals agreeing.
- **Context card:** explains regime changes that account for part of a deviation.
- **Suspected subsystem:** 2D schematic with the suspected part highlighted, the "Suspected, not a confirmed fault" caveat, suggested action, and a mock "Schedule inspection" button.

### Screen 3: Failure replay and proof
- **Scenario picker** (past simulated failures) and a play/scrub control revealing the health curve progressively.
- **Markers:** drift begins (from ground truth), our alert, failure; computed lead time.
- **Side-by-side:** naive threshold alert vs our alert, with false alarms for each.
- **Scoreboard** from the hidden fleet: lead-time distribution, false alarms per machine-week, missed failures, versus baselines.
- **Sensitivity slider:** moves the threshold and updates false alarms vs lead time from the precomputed sweep.

### Screen 4: Ask the agent
- Chat with suggested questions, tool-call chips, answers that cite machine, window, and signals, and an embedded mini chart when explaining a flag.
- Footer on every answer: "Answered from simulated sensor history."

**Component list:** TopBar, SimControls, KpiTile, MachineTable, Sparkline, FleetHeatmap, AlertFeed, DataDrawer, HealthTimeline, SignalPanel, WhyFlagged, ContextCard, SubsystemSchematic, ReplayChart, ScenarioPicker, Scoreboard, SensitivitySlider, ChatPanel, ToolChip.

---

## 13. Chat agent

### 13.1 Tools (all read-only, backed by the API/DB)
`get_fleet_summary()`, `get_machine_health(machine_id)`, `get_signal_status(machine_id)`, `explain_flag(machine_id)`, `get_alert_history(machine_id?, since?)`, `compare_methods(scenario_id)`, `get_scoreboard()`.

### 13.2 System prompt (starting point)
```
You are the maintenance assistant for a simulated manufacturing plant dashboard. You answer ONLY from tool results. If the tools do not contain the answer, say you do not have that data.
Rules:
- Always call a tool before stating any number, status, or time.
- Say "suspected" for any subsystem attribution; never say a fault is confirmed.
- Never prescribe repairs. The most you may suggest is that someone inspect the machine.
- If asked whether this is real plant data, say clearly that all data is simulated.
- Keep answers short: what changed, how long, which signals, and what the evidence does not show.
```

### 13.3 Fallback
If the LLM is unavailable or rate-limited, answer from deterministic templates filled with tool output, so the demo never dies.

---

## 14. Alerts through n8n

- **Workflow `alert-notify`:** Webhook (Header Auth, method POST, response mode "Using 'Respond to Webhook' Node") receives `{machine_id, level, health, reason, ts, suspected}`, a Switch by level, Telegram message, respond 200. The API already dedupes by status change.
- **Message templates:** Watch: "M-04 (CNC spindle motor): drifting. Health 63. Vibration above normal for 8 hours. Suspected: rotating assembly. No immediate action required." Act now: "M-04: health 41, drift sustained for 5 days. Suspected: rotating assembly (not confirmed). Please schedule an inspection."
- **Compatibility notes:** webhook test URLs (`/webhook-test/...`) only work while "Listen for test event" is active; production URLs (`/webhook/...`) need the workflow Active. If n8n runs in Docker, n8n reaches the API at `host.docker.internal:8000`, and the API reaches n8n at the published `localhost:5678`. Do not rely on `$env` inside n8n nodes (blocked by default in n8n 2.x). In Header Auth credentials, **Name is the header name and Value is only the secret.** Never paste tokens or keys into chats.

---

## 15. Milestones (stop and verify after each)

**M0. Foundations (about 2h).** Repo skeleton, environment setup, a one-page definition of failure, warning, and the split plan, and **mock JSON for every endpoint** (Section 11.3).
*Accept:* the repo runs, the mock JSON exists and validates against pydantic models.

**M1. Simulator, one machine (about 3h).** One machine, one degradation mode, one nuisance event; plot 60 days of signals.
*Accept:* the plot clearly shows the load surge and the bearing drift as different things; determinism test passes.

**M2. Simulator, full (about 4h).** All machine types, modes, nuisance events, ground truth files, and the three datasets (demo, dev, hidden).
*Accept:* files are generated from one command; schema documented; seeds reproducible.

**M3. Baselines and evaluation harness (about 4h).** Regime normalization, B0 and B1, metrics, the report skeleton.
*Accept:* the harness prints lead time, false alarms per week, and missed failures for B0 and B1 on eval_dev.

**M4. Main model, health score, alerts, causality test (about 5h).** Method M, calibration, alert logic, explainability, the causality unit test.
*Accept:* causality test passes; M compared to B1 on eval_dev; thresholds chosen on dev only.

**M5. Freeze results on the hidden fleet (about 1h).** Run eval_hidden once; save the scoreboard, replay outputs, and sensitivity sweep; write the honest report.
*Accept:* precomputed JSON files exist and the report lists limits.

**M6. API and replay engine (about 5h).** SQLite, replay task, endpoints from Section 11.3, sim controls, staged fleet.
*Accept:* `curl /fleet` shows health evolving as the clock advances; jump-to-before-failure works.

**M7. Dashboard (about 8h, can start at M0 from mock JSON).** The four screens, then switch from mock to real API.
*Accept:* one button runs the full replay from the UI; every screen carries the simulated-data labels.

**M8. n8n alerts (about 3h).** `alert-notify` workflow.
*Accept:* a status change during replay sends a Telegram message, once.

**M9. Chat agent (about 5h).** Tools, system prompt, fallback.
*Accept:* 10 test questions all return correct, data-backed answers; fallback tested by disabling the LLM.

**M10. Demo harness and rehearsal (rest of time).** Presenter controls, reset button, five full runs, a backup video.
*Accept:* three runs in a row with no manual intervention.

**M11. Pitch (not building).** See Section 17.

---

## 16. Parallel tracks (if several people work at once)

- **A (data and model):** M1 to M5.
- **B (backend):** M6, starting once the M3 harness exists.
- **C (frontend):** M7, starting from the mock JSON.
- **D (n8n and chat):** M8 and M9, starting once the API shapes are fixed.

---

## 17. Demo and pitch

**Demo script (about 5 minutes):**
1. Fleet overview, "Simulated live" badge, press play at one day per 10 seconds.
2. M-04 drifts: Watch, then Act now; a Telegram alert arrives on a phone.
3. Open Machine evidence: the signals, the context card, the suspected subsystem with its caveat.
4. Failure replay and proof: naive vs our alert, the scoreboard, and the sensitivity slider.
5. Ask the agent: "Why was M-04 flagged?" and "How early would we have been warned last time?"
6. Limits slide.

**Pitch structure:** story and the two questions; data and how it is simulated; the money chart (health drifting before failure); the numbers vs baselines; live demo; limits and path to a real Mysuru plant (what data a real shop would need: a vibration sensor, motor current, and temperature, logged with operating conditions).

**Likely judge questions to prepare for:** "Is this real data?" (No; here is how it is simulated and how we avoid circularity.) "How do you know it's the bearing?" (We don't; it is suspected from which signals drifted.) "What about false alarms?" (Here is the sweep and the nuisance-event results.) "What if the fault is sudden?" (We show the sudden-fault mode and say early warning is not possible there.)

---

## 18. Risks, open decisions, and cut order

**Risks**
1. **Simulator realism and circularity:** the biggest risk; mitigated by nuisance events, a blind detector, a hidden shifted fleet, and disclosure.
2. **Detector overfitting to the simulator:** keep the hidden fleet untouched until M5.
3. **LLM free-tier limits or latency:** the fallback in Section 13.3.
4. **Dashboard time sink:** build against mock JSON in parallel and time-box polish.
5. **n8n Docker networking:** see Section 14 compatibility notes.

**Cut order if time runs short**
1. The 2D schematic polish (use a plain text card).
2. The fleet heatmap.
3. The autoencoder (keep IsolationForest or PCA).
4. Chat sophistication (keep three or four tools plus the fallback).
5. n8n alerts (show alerts on screen only).
6. Number of machines in the demo fleet.

**Never cut:** the simulator with nuisance events, the causal detector with the causality test, the evaluation against baselines on the hidden fleet, and the failure replay with lead time.

---

## 19. Your first task

Do **not** write code yet. Reply with:
1. A summary of your understanding in 10 lines or fewer.
2. Your questions (maximum 5), starting with: Python and Node versions, whether n8n runs in Docker, how many hours and people we have, and which LLM free-tier key I have.
3. The exact file and command plan for **M0 only**.

Then wait for my confirmation.
