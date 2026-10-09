import AlertFeed from "@/components/AlertFeed";
import AppShell from "@/components/AppShell";
import DataDrawer from "@/components/DataDrawer";
import FleetHeatmap from "@/components/FleetHeatmap";
import KpiTile from "@/components/KpiTile";
import MachineTable from "@/components/MachineTable";
import SimControls from "@/components/SimControls";
import { getFleet, getScenarios } from "@/lib/api";
import { STATUS_COLOR } from "@/lib/format";

export default async function Home() {
  const [fleet, scenarios] = await Promise.all([getFleet(), getScenarios()]);
  const { kpis } = fleet;

  return (
    <AppShell active="fleet">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Fleet overview</h1>
          <p className="mt-1 text-sm text-ink/55">
            {kpis.monitored} machines monitored · staged demo fleet of 8 ·
            compressed time
          </p>
        </div>
      </div>

      <div className="mt-4">
        <SimControls
          simTime={fleet.sim_time}
          speed={fleet.speed}
          playing={fleet.playing}
          scenarios={scenarios}
        />
      </div>

      <section
        aria-label="Key indicators"
        className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        <KpiTile label="Monitored" value={kpis.monitored} />
        <KpiTile
          label="Healthy"
          value={kpis.healthy}
          accent={STATUS_COLOR.healthy}
        />
        <KpiTile label="Watch" value={kpis.watch} accent={STATUS_COLOR.watch} />
        <KpiTile
          label="Act now"
          value={kpis.act_now}
          accent={STATUS_COLOR.act_now}
        />
        <KpiTile
          label="Alerts today"
          value={kpis.alerts_today}
          hint="One per status change"
        />
      </section>

      <section className="mt-6">
        <MachineTable machines={fleet.machines} nowIso={fleet.sim_time} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <FleetHeatmap heatmap={fleet.heatmap} />
        <AlertFeed alerts={fleet.alerts} />
      </section>

      <section className="mt-6">
        <DataDrawer />
      </section>
    </AppShell>
  );
}
