# HakunaMatata — What You Have & What To Do Next
Project: Predictive Maintenance (Mysuru Manufacturing) — CSE/AIML-06

## What Has Been Built

### M0 (Foundations) — DONE
- Skeleton, docs/BRIEF.md, docs/DEFINITIONS.md
- api/schemas.py (all endpoint shapes), api/main.py (/health)
- web/public/mock/* (8 mocks), Next.js 16 + TS + Tailwind + Recharts (mock mode)
- tests/test_schemas.py — 17 passed

### M1 (Simulator — One Machine) — DONE
- analysis/sim/machines.py, scenarios.py, generator.py, plot_demo.py, README.md
- tests/test_sim.py — 22 passed
- Evidence: load surge affects load but not kurtosis; bearing wear raises kurtosis while load stays near-normal

Commits: bcfc57b, 0687361 on main

## Next — M2 (Full Simulator)

You must implement:
1. 5 machine types: CNC spindle, air compressor, hydraulic pump, lathe drive, coolant pump
2. 4 degradation modes: bearing_wear, cooling_fault, drive_load_issue, sudden_fault
3. All nuisances: load_surge, heat_wave, startup_transient, sensor_dropout, maintenance_reset
4. 3 datasets with ground truth (fleet_demo, eval_dev seeds 0–99, eval_hidden seeds 1000–1099; noise ×1.2, +30% range shift for hidden). Deterministic by machine+seed.
5. analysis/sim/make_datasets.py (one command)
6. M2 tests (keep M1/M0 passing)
7. Update analysis/sim/README.md

## Steps

1. cd C:\Users\Yuvaraj\Desktop\HM
2. .\.venv\Scripts\Activate.ps1
3. pip install -r requirements.txt
4. pytest -q (>=22 passed)
5. Edit analysis/sim/machines.py, scenarios.py, generator.py
6. Create analysis/sim/make_datasets.py
7. python -m analysis.sim.make_datasets (writes data/*.parquet)
8. pytest -q (all pass)
9. git add -A && git commit -m "M2: full simulator (5 types, 4 modes, all nuisances, 3 datasets)" && git push origin main
10. Summarize + exact verify steps. STOP — do not go to M3.

Read docs/BRIEF.md, docs/DEFINITIONS.md, analysis/sim/README.md before coding.
