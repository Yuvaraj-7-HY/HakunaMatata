"use client";

import { useState } from "react";

export default function ScheduleButton() {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setDone(true)}
      disabled={done}
      className="inline-flex min-h-11 items-center rounded-md bg-teal px-4 text-sm font-semibold text-white hover:bg-teal/90 disabled:opacity-70"
    >
      {done ? "Inspection requested ✓" : "Schedule an inspection"}
    </button>
  );
}
