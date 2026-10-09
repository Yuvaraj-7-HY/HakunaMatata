# Predictive Maintenance for Mysuru Manufacturing

Hackathon prototype for problem statement **CSE/AIML-06** — "The Machine That Warned Everyone Without Speaking".

A physics-grounded **simulator** generates multi-machine sensor data; a **causal detector** turns regime-adjusted residuals into a 0–100 health score; an **evaluation harness** proves lead time against baselines on a held-out, shifted "hidden" fleet. A FastAPI replay engine serves the data as a simulated live stream to a Next.js dashboard, with alerts routed through n8n to Telegram and a grounded chat agent for explanation.

**All data is simulated.** Nothing here is real plant data, and the numbers demonstrate the *method*, not field accuracy.

## Layout

```
analysis/   simulator, detector, evaluation   (detector must NOT import sim)
api/        FastAPI replay engine + REST endpoints + chat agent
web/        Next.js dashboard (public/mock holds endpoint mocks)
n8n/        exported alert workflows + docs
data/       generated parquet/db files (gitignored)
docs/       BRIEF.md, DEFINITIONS.md
tests/      pytest suites
```

## Quick start

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pytest -q
uvicorn api.main:app --reload      # http://localhost:8000/health
```

Web (mock mode):

```powershell
cd web
npm install
npm run dev                        # http://localhost:3000
```

See `docs/BRIEF.md` for the full specification and `docs/DEFINITIONS.md` for the exact definitions of failure, warning and the data split.
