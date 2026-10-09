export default function DataDrawer() {
  return (
    <details className="group rounded-lg border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink">
        <span>About this data</span>
        <span className="text-ink/40 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="space-y-2 border-t border-line px-4 py-4 text-sm text-ink/70">
        <p>
          Everything here is <strong>simulated</strong>. A physics-grounded
          generator produces multi-machine sensor data (vibration RMS and
          kurtosis, temperature, current, load, speed, ambient) on a 10-minute
          grid, with operating regimes, nuisance events and four degradation
          modes.
        </p>
        <p>
          The detector is <strong>blind to the generator</strong>: it only sees
          sensor readings, fits a per-machine expected-value model from the
          commissioning period, and scores the regime-adjusted residuals into a
          0–100 health score. Nuisance events (load surges, heat waves, startup
          transients, sensor dropouts, maintenance resets) exist to stress false
          alarms.
        </p>
        <p>
          Lead time is measured on a held-out “hidden” fleet with shifted seeds
          and parameter ranges, and reported next to naive and control-chart
          baselines. Numbers demonstrate the method, not field accuracy.
        </p>
      </div>
    </details>
  );
}
