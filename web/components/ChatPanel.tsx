"use client";

import { useRef, useState } from "react";
import type { AgentAskResponse } from "@/lib/types";
import ToolChip from "./ToolChip";

interface Msg {
  role: "user" | "agent";
  text: string;
  meta?: AgentAskResponse;
}

export default function ChatPanel({
  suggested,
  answers,
  fallback,
}: {
  suggested: string[];
  answers: Record<string, AgentAskResponse>;
  fallback: AgentAskResponse;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  function ask(question: string) {
    const q = question.trim();
    if (!q || thinking) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setThinking(true);
    // Deterministic, grounded reply from tool data (mock mode). In live mode
    // this would call POST /agent/ask.
    window.setTimeout(() => {
      const meta = answers[q] ?? fallback;
      setMessages((m) => [...m, { role: "agent", text: meta.answer, meta }]);
      setThinking(false);
      window.requestAnimationFrame(() => {
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
      });
    }, 450);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="flex flex-col rounded-lg border border-line bg-surface">
        <div
          ref={logRef}
          className="flex-1 space-y-4 overflow-y-auto p-4"
          style={{ maxHeight: 520 }}
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <p className="text-sm text-ink/55">
              Ask about any machine on the fleet. Answers are grounded in tool
              results from the simulated sensor history — never invented.
            </p>
          ) : null}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-lg rounded-br-sm bg-teal px-3 py-2 text-sm text-white">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} className="max-w-[92%]">
                <div className="rounded-lg rounded-bl-sm border border-line bg-ground px-3 py-2 text-sm text-ink/85">
                  <p className="whitespace-pre-line">{m.text}</p>
                </div>
                {m.meta ? (
                  <div className="mt-2 space-y-2">
                    {m.meta.tool_calls.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {m.meta.tool_calls.map((t, j) => (
                          <ToolChip key={j} name={t.name} args={t.args} />
                        ))}
                      </div>
                    ) : null}
                    {m.meta.citations.length > 0 ? (
                      <div className="flex flex-wrap gap-2 text-xs text-ink/55">
                        {m.meta.citations.map((c, j) => (
                          <span
                            key={j}
                            className="rounded border border-line bg-white px-2 py-0.5"
                          >
                            cite · {c.machine_id} · {c.window}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p className="text-xs italic text-ink/45">
                      Answered from simulated sensor history.
                    </p>
                  </div>
                ) : null}
              </div>
            )
          )}

          {thinking ? (
            <div className="text-sm text-ink/45">Checking tool results…</div>
          ) : null}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-end gap-2 border-t border-line p-3"
        >
          <div className="flex-1">
            <label
              htmlFor="chat-input"
              className="block text-xs font-medium uppercase tracking-wide text-ink/50"
            >
              Your question
            </label>
            <input
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Why was M-04 flagged?"
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink"
            />
          </div>
          <button
            type="submit"
            disabled={thinking || !input.trim()}
            className="inline-flex min-h-11 items-center rounded-md bg-teal px-4 text-sm font-semibold text-white hover:bg-teal/90 disabled:opacity-50"
          >
            Ask
          </button>
        </form>
      </div>

      <aside className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">Suggested questions</h2>
        <div className="mt-3 flex flex-col gap-2">
          {suggested.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ask(q)}
              className="min-h-11 rounded-md border border-line bg-ground px-3 py-2 text-left text-sm text-ink/80 hover:border-teal/40 hover:text-teal"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="mt-4 border-t border-line pt-3 text-xs text-ink/50">
          <p className="font-medium text-ink/70">Rules</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>Every number comes from a tool call.</li>
            <li>Subsystem attributions are “suspected”.</li>
            <li>Never prescribes repairs beyond inspection.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
