# Definitions and split plan (M0)

One page. Every subsequent milestone uses *these* definitions; if we change them, we update this file and say so.

## 1. What is a "failure"?

A **failure** is a labelled ground-truth event in the simulator: a machine's degradation reaches the point where it would stop being usable. It is a single timestamp `failure_ts` per labelled event.

- `failure_ts` is set by the simulator, not the detector. The detector never sees it.
- A failure has a **mode** (`bearing_wear`, `cooling_fault`, `drive_load_issue`, `sudden_fault`), a **component**, an **onset_ts**, and a progression shape.
- **Onset** `onset_ts` is the moment degradation *begins* — the earliest point at which a careful analyst could in principle have seen a shift. Before onset the machine is healthy; after failure it is stopped.
- The **degradation window** is `[onset_ts, failure_ts)`. Any alert inside it is "useful"; any alert outside it (before onset, or on a healthy machine) is a false alarm.

## 2. What is a "warning" (and lead time)?

A **warning** is the first detector alert whose timestamp falls inside the degradation window `[onset_ts, failure_ts)`.

- **Lead time** = `failure_ts − first_alert_ts`. Reported in hours.
- **Detection delay** = `first_alert_ts − onset_ts` — how long after onset the detector spoke up. (Lead time + detection delay = window length.)
- **Missed failure** = no alert inside the window at all.
- **Status levels** (from Section 9.5): `watch` (health < 70 sustained ≥ 6h with corroboration) and `act_now` (health < 50 sustained ≥ 3h). For lead-time purposes we count the **first alert of either level**; the report breaks out `watch`-only vs `act_now`.
- **Why this matters:** a detector that alerts early but constantly is useless, and one that never false-alarms but always alerts at failure is useless. Lead time alone is meaningless without the false-alarm rate next to it.

## 3. What is a "false alarm episode"?

An **alert** that fires outside the degradation window, or any alert on a healthy machine.

- Consecutive/overlapping alerts are **merged into one episode** if they are within **6 hours** of each other (so a machine that stays in `watch` for two days counts once, not dozens of times).
- Reported as **false alarms per machine-week** = `(number of false-alarm episodes) / (total machine-weeks observed)`.
- Nuisance events (load surges, heat waves, startup transients, dropouts, maintenance resets) exist specifically to generate realistic false-alarm pressure. A method that scores well only because it never fires is not good — see Section 10.

## 4. Health score semantics

A per-machine, per-timestamp number in `[0, 100]`, derived by mapping a healthy-calibrated anomaly score `a` through fixed healthy percentiles (`p50 → 100`, `p99 → 70`, `p99.9 → 50`, `2·p99.9 → 0`).

- `health ≥ 70` → **healthy**.
- `70 > health ≥ 50` → **watch** — beyond the 99th percentile of *this machine's own healthy behaviour*.
- `health < 50` → **act_now** — beyond the 99.9th percentile.
- Thresholds are calibrated on **eval_dev healthy data only**; they are never tuned on the hidden fleet.

## 5. Data split plan (no leakage, by machine and seed)

| Split | Purpose | Seeds | Notes |
|---|---|---|---|
| **commissioning** | fit per-machine baselines (regime model + residual std) | demo: days 0–14 of each machine | first 14 days healthy, no degradation |
| **fleet_demo** | the live demo fleet (8 machines, 90 days) | fixed seed | includes healthy, slow drift, near-failure, nuisance, sudden |
| **eval_dev** | develop + calibrate all thresholds and persistence params | 0–99 | ~30 failures + ~10 healthy-with-nuisance |
| **eval_hidden** | final honest scoreboard | 1000–1099 | noise ×1.2, progression ranges shifted ~30% beyond dev; **run once per milestone, every run logged** |

Rules:
- Splits are **by machine and seed**, never by random rows — a machine's whole history lives in exactly one split.
- **eval_hidden is never used to choose anything.** It is opened at M5 (and only re-run, logged, if we fix a bug).
- Everything shown in the UI is labelled **simulated**.

## 6. The one boundary

Nothing under `analysis/detector/` may import from `analysis/sim/`. Ground truth lives in `events_*.parquet` files that only the evaluation harness and tests read. This keeps the "was it warning us?" answer honest rather than circular.
