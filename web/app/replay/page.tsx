import AppShell from "@/components/AppShell";
import ReplayExplorer from "@/components/ReplayExplorer";
import Scoreboard from "@/components/Scoreboard";
import { getReplay, getScenarios, getScoreboard } from "@/lib/api";
import type { ReplayResponse } from "@/lib/types";

export default async function ReplayPage() {
  const [scenarios, scoreboard] = await Promise.all([
    getScenarios(),
    getScoreboard(),
  ]);

  const replays: Record<string, ReplayResponse> = {};
  await Promise.all(
    scenarios.map(async (s) => {
      replays[s.id] = await getReplay(s.id);
    })
  );

  return (
    <AppShell active="replay">
      <h1 className="text-2xl font-semibold text-ink">
        Failure replay &amp; proof
      </h1>
      <p className="mt-1 max-w-3xl text-sm text-ink/55">
        Answering “was it warning us?”. The health score drifts before a known
        failure; we compare our alert against a naive vibration threshold and
        show the measured lead time. The scoreboard is from the held-out hidden
        fleet.
      </p>

      <section className="mt-5">
        <ReplayExplorer scenarios={scenarios} replays={replays} />
      </section>

      <section className="mt-5">
        <Scoreboard scoreboard={scoreboard} />
      </section>

      <section className="mt-5 rounded-lg border border-line bg-surface p-4 text-sm text-ink/70">
        <h2 className="text-sm font-semibold text-ink">
          What we do and do not claim
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Sudden faults</strong> have a very short window; early
            warning there is not physically possible, so we report that mode
            separately instead of hiding it in an average.
          </li>
          <li>
            Thresholds and persistence are chosen on <strong>eval_dev</strong>{" "}
            only; <strong>eval_hidden</strong> is evaluated once per milestone
            and never used to tune.
          </li>
          <li>
            The detector is blind to the simulator, but because we write both
            halves, circularity can never be fully eliminated — these numbers
            demonstrate the method, not field accuracy.
          </li>
        </ul>
      </section>
    </AppShell>
  );
}
