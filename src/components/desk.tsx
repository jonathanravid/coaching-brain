import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";
import { dashboard } from "@/data/dashboard";
import { formSeries } from "@/data/form-series";
import { refreshDesk, type DeskLive } from "@/lib/desk-refresh";

type Tab = "today" | "plan" | "trends" | "coach";

const phases = [
  { name: "This week", when: "19–25 Oct", hours: "Test", text: "FTP test is done. Do not add a session. Block A starts Monday.", tag: "Now", current: true },
  { name: "Block A", when: "26 Oct – 22 Nov", hours: "13.5–15 h", text: "Build. Two hard bikes, then one. One hard run plus the long run. Indoor watts.", tag: "Build", next: true },
  { name: "Block B", when: "23 Nov – 10 Jan", hours: "15–16 h", text: "Threshold. Hold 15, touch 16. Down week before the 10k. Only if A was absorbed.", tag: "Threshold" },
  { name: "Block C", when: "11 Jan – 28 Feb", hours: "15–16 h", text: "Specific. The 10k writes the pace. 1:25 is not assumed.", tag: "Specific" },
  { name: "Block D", when: "1–21 Mar", hours: "10–12 h", text: "Sharpen into Shamrock on 21 Mar. Race week is not a big week.", tag: "Sharpen" },
  { name: "Block E", when: "22 Mar – 25 Apr", hours: "toward 14 h", text: "Olympic. Starts after the half, if the legs are honest. St. Anthony's is 25 Apr.", tag: "Olympic" },
];

type Session = { name: string; meta: string; done?: boolean };
type Day = { key: string; label: string; date: string; iso: string; today?: boolean; sessions: Session[] };

const thisWeek: Day[] = [
  { key: "19", label: "Mon", date: "19", iso: "2026-10-19", sessions: [{ name: "Aerobic + tempo", meta: "Ride · 90 min · load 74", done: true }] },
  { key: "20", label: "Tue", date: "20", iso: "2026-10-20", sessions: [
    { name: "Swim easy", meta: "50 min", done: true },
    { name: "Strength, light legs", meta: "35 min", done: true },
    { name: "Easy run + strides", meta: "35 min · 6.2 km · avg 144", done: true },
  ] },
  { key: "21", label: "Wed", date: "21", iso: "2026-10-21", sessions: [{ name: "20-min FTP test", meta: "Ride · 75 min · load 86", done: true }] },
  { key: "22", label: "Thu", date: "22", iso: "2026-10-22", sessions: [{ name: "Easy spin", meta: "92 min · 43.4 km · avg 128 · 151 W", done: true }] },
  { key: "23", label: "Fri", date: "23", iso: "2026-10-23", sessions: [
    { name: "Easy run", meta: "40 min" },
    { name: "Easy spin, optional", meta: "25 min" },
  ] },
  { key: "24", label: "Sat", date: "24", iso: "2026-10-24", sessions: [{ name: "Long ride easy", meta: "3:30 · planned load 147" }] },
  { key: "25", label: "Sun", date: "25", iso: "2026-10-25", sessions: [{ name: "Long run easy", meta: "70 min" }] },
];

const nextWeek: Day[] = [
  { key: "26", label: "Mon", date: "26", iso: "2026-10-26", sessions: [
    { name: "Aerobic swim", meta: "50 min · slower than 1:40 /100m" },
    { name: "Light lift", meta: "35 min" },
  ] },
  { key: "27", label: "Tue", date: "27", iso: "2026-10-27", sessions: [{ name: "Z4 run, 6×3 min", meta: "51 min" }] },
  { key: "28", label: "Wed", date: "28", iso: "2026-10-28", sessions: [{ name: "Sweet spot 3×10", meta: "222–236 W · indoor" }] },
  { key: "29", label: "Thu", date: "29", iso: "2026-10-29", sessions: [
    { name: "Aerobic swim", meta: "50 min" },
    { name: "Z2 spin", meta: "2:30 · 165–190 W indoor" },
  ] },
  { key: "30", label: "Fri", date: "30", iso: "2026-10-30", sessions: [{ name: "2×15 min", meta: "229–244 W · indoor" }] },
  { key: "31", label: "Sat", date: "31", iso: "2026-10-31", sessions: [{ name: "Long ride 4:30", meta: "165–190 W indoor, or 150–165 bpm outside" }] },
  { key: "01", label: "Sun", date: "1", iso: "2026-11-01", sessions: [{ name: "Long run", meta: "80 min · Z2" }] },
];

function parseDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function nyIso() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function daysUntil(iso: string, fromIso: string) {
  return Math.round((parseDay(iso).getTime() - parseDay(fromIso).getTime()) / 86400000);
}

function short(iso: string) {
  return parseDay(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const tip = {
  contentStyle: { background: "var(--color-surface)", border: "1px solid var(--color-line)", color: "var(--color-ink)" },
};

function namesMatch(planned: string, actual: string) {
  const p = planned.toLowerCase();
  const a = actual.toLowerCase();
  if (a.includes(p) || p.includes(a)) return true;
  const words = p.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  return words.length > 0 && words.every((w) => a.includes(w));
}

function sportOf(name: string) {
  const n = name.toLowerCase();
  if (n.includes("run")) return "Run";
  if (n.includes("swim")) return "Swim";
  if (n.includes("lift") || n.includes("strength")) return "WeightTraining";
  if (n.includes("spin") || n.includes("ride") || n.includes("bike")) return "Ride";
  return "";
}

function withLive(days: Day[], live: DeskLive | null, todayIso: string): Day[] {
  const used = new Set<number>();
  const sessions = live?.sessions ?? [];
  return days.map((day) => ({
    ...day,
    today: day.iso === todayIso,
    sessions: day.sessions.map((s) => {
      const sport = sportOf(s.name);
      const hit = sessions.findIndex((a, i) => {
        if (used.has(i) || a.date !== day.iso) return false;
        if (namesMatch(s.name, a.name)) return true;
        return sport !== "" && a.type === sport;
      });
      if (hit < 0) return s;
      used.add(hit);
      const a = sessions[hit];
      const bits = [`${a.mins} min`];
      if (a.km) bits.push(`${a.km} km`);
      if (a.avgHr) bits.push(`avg ${a.avgHr}`);
      if (a.avgW) bits.push(`${a.avgW} W`);
      return { ...s, done: true, meta: bits.join(" · ") };
    }),
  }));
}

export function Desk({ initial }: { initial: DeskLive }) {
  const [tab, setTab] = useState<Tab>("today");
  const [live, setLive] = useState<DeskLive | null>(initial.ok ? initial : null);
  const todayIso = live?.today ?? nyIso();
  const shamrock = daysUntil(dashboard.shamrock, todayIso);
  const anthonys = daysUntil(dashboard.anthonys, todayIso);

  useEffect(() => {
    let stop = false;
    const pull = () => {
      refreshDesk()
        .then(async (data) => {
          if (!stop && data.ok) {
            setLive(data);
            return;
          }
          const res = await fetch("/desk-live.json", { cache: "no-store" });
          if (!res.ok) return;
          const file = (await res.json()) as DeskLive;
          if (!stop && file.ok) setLive(file);
        })
        .catch(() => undefined);
    };
    pull();
    const timer = window.setInterval(pull, 120_000);
    const onFocus = () => pull();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      stop = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return (
    <div className="min-h-dvh bg-bg pb-20 text-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4">
        {tab === "today" ? (
          <TodayPanel
            shamrock={shamrock}
            anthonys={anthonys}
            live={live}
            week={withLive(thisWeek, live, todayIso)}
            next={withLive(nextWeek, live, todayIso)}
          />
        ) : null}
        {tab === "plan" ? <PlanPanel /> : null}
        {tab === "trends" ? <TrendsPanel live={live} /> : null}
        {tab === "coach" ? <CoachPanel /> : null}
      </div>

      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl grid-cols-4">
          {(
            [
              ["today", "Today"],
              ["plan", "Plan"],
              ["trends", "Trends"],
              ["coach", "Coach"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-14 text-sm font-medium ${tab === id ? "text-accent" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-xl border border-line bg-surface p-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-serif text-3xl leading-none">{value}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </article>
  );
}

function WeekRow({ kicker, title, days }: { kicker: string; title: string; days: Day[] }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-medium tracking-wide text-muted">{kicker}</p>
      <h2 className="font-serif text-xl">{title}</h2>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {days.map((day) => (
          <article
            key={day.key}
            className={`w-40 shrink-0 rounded-xl border p-3 ${day.today ? "border-accent" : "border-line"}`}
          >
            <p className="text-xs text-muted">
              {day.label} {day.date}
              {day.today ? " · today" : ""}
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {day.sessions.map((s) => (
                <li key={s.name}>
                  <p className="text-sm font-medium leading-snug">{s.name}</p>
                  <p className="text-xs leading-relaxed text-muted">{s.meta}</p>
                  {s.done ? <p className="text-xs text-accent">Done</p> : null}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function TodayPanel({
  shamrock,
  anthonys,
  live,
  week,
  next,
}: {
  shamrock: number;
  anthonys: number;
  live: DeskLive | null;
  week: Day[];
  next: Day[];
}) {
  const t = dashboard.today;
  const ctl = live?.ctl ?? t.ctl;
  const atl = live?.atl ?? t.atl;
  const form = live?.form ?? t.form;
  return (
    <div className="flex flex-col gap-3">
      <header className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">Next A race</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <h1 className="font-serif text-3xl leading-none">Shamrock Half</h1>
              <p className="mt-1 text-sm text-muted">21 Mar 2027 · Virginia Beach</p>
            </div>
            <p className="font-serif text-5xl leading-none text-accent">{shamrock}</p>
          </div>
        </section>
        <section className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">Second A race</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl leading-none">St. Anthony's</h2>
              <p className="mt-1 text-sm text-muted">25 Apr 2027 · 1.5 km / 40 km / 10 km</p>
            </div>
            <p className="font-serif text-5xl leading-none">{anthonys}</p>
          </div>
        </section>
      </header>
      <section className="grid grid-cols-3 gap-3">
        <Stat label="Fitness" value={ctl.toFixed(1)} hint={live?.asOf ? `CTL · ${short(live.asOf)}` : "CTL"} />
        <Stat label="Fatigue" value={atl.toFixed(1)} hint="ATL" />
        <Stat label="Form" value={form.toFixed(1)} hint="Tired on purpose" />
      </section>
      <p className="text-xs text-muted">{live?.ok ? "Intervals, refreshed while this page is open." : "Saved snapshot. Refreshing from intervals."}</p>
      <WeekRow kicker="This week · 19–25 Oct" title="On the intervals calendar. Do not add work." days={week} />
      <WeekRow kicker="Next week · 26 Oct – 1 Nov" title="Block A. Watts are indoor. Outside, hold heart rate." days={next} />
    </div>
  );
}

function PlanPanel() {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="font-serif text-xl">The blocks</h2>
      <p className="mt-1 text-sm text-muted">Shamrock first. St. Anthony's five weeks later. Later blocks are not on the calendar yet.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {phases.map((phase) => (
          <article
            key={phase.name}
            className={`rounded-xl border p-3 ${phase.current ? "border-accent bg-bg" : "border-line"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">{phase.name}</h3>
              <span className="text-xs text-muted">{phase.hours}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{phase.when}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{phase.text}</p>
            <p className="mt-3 text-xs tracking-wide text-accent">{phase.next ? "Starts Monday" : phase.tag}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function TrendsPanel({ live }: { live: DeskLive | null }) {
  const axis = { fill: "var(--color-muted)", fontSize: 11 };
  const series = useMemo(() => {
    const rows = [...(formSeries as unknown as { d: string; ctl: number; atl: number; form: number }[])];
    if (live?.ctl == null || live.atl == null || live.form == null) return rows;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const point = { d: today, ctl: live.ctl, atl: live.atl, form: live.form };
    const last = rows.at(-1);
    if (last?.d === today) rows[rows.length - 1] = point;
    else if (!last || last.d < today) rows.push(point);
    return rows;
  }, [live]);
  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-xl">Fitness and form</h2>
          <span className="rounded-full border border-line px-2 py-1 text-xs text-muted">Since 1 Jul</span>
        </div>
        <div className="mt-3 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="d" tickFormatter={short} tick={{ fill: "var(--color-muted)", fontSize: 11 }} interval={20} />
              <YAxis domain={[20, 100]} tick={{ fill: "var(--color-muted)", fontSize: 11 }} width={28} />
              <Tooltip labelFormatter={(v) => short(String(v))} contentStyle={tip.contentStyle} />
              <Line type="monotone" dataKey="ctl" name="Fitness" stroke="var(--color-accent)" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="atl" name="Fatigue" stroke="var(--color-ink)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="d" tickFormatter={short} tick={{ fill: "var(--color-muted)", fontSize: 11 }} interval={20} />
              <YAxis domain={[-40, 25]} tick={{ fill: "var(--color-muted)", fontSize: 11 }} width={28} />
              <Tooltip labelFormatter={(v) => short(String(v))} contentStyle={tip.contentStyle} />
              <ReferenceArea y1={-40} y2={-30} fill="var(--color-risk)" fillOpacity={0.18} />
              <ReferenceArea y1={-30} y2={-10} fill="var(--color-accent)" fillOpacity={0.16} />
              <ReferenceArea y1={-10} y2={5} fill="var(--color-ink)" fillOpacity={0.06} />
              <ReferenceArea y1={5} y2={25} fill="var(--color-accent)" fillOpacity={0.28} />
              <Area type="monotone" dataKey="form" name="Form" stroke="var(--color-ink)" fill="var(--color-accent)" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Top: fitness and fatigue. Bottom: form. Pale green is fresh. The open band around zero is grey. The darker green, about −10 to −30, is where a build belongs. Below −30 is too deep. You are at {(live?.form ?? dashboard.today.form).toFixed(0)}.
        </p>
      </section>
      <Chart title="Weekly hours" note="The week of 12 Oct includes the runs the export missed.">
        <BarChart data={dashboard.volume as unknown as { week: string; run: number; ride: number; swim: number }[]}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="week" tickFormatter={short} tick={axis} interval={3} />
          <YAxis tick={axis} width={28} />
          <Tooltip labelFormatter={(v) => short(String(v))} contentStyle={tip.contentStyle} />
          <Bar dataKey="ride" name="Ride" stackId="h" fill="var(--color-accent)" />
          <Bar dataKey="run" name="Run" stackId="h" fill="var(--color-ink)" />
          <Bar dataKey="swim" name="Swim" stackId="h" fill="var(--color-muted)" />
        </BarChart>
      </Chart>
      <Chart title="Resting heart rate" note="Readings from 40 to 85 only. The 123 on 20 Oct is left off.">
        <LineChart data={dashboard.rhr as unknown as { d: string; v: number }[]}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="d" tickFormatter={short} tick={axis} interval={3} />
          <YAxis domain={[40, 90]} tick={axis} width={28} />
          <Tooltip labelFormatter={(v) => short(String(v))} contentStyle={tip.contentStyle} />
          <Line type="monotone" dataKey="v" name="bpm" stroke="var(--color-accent)" dot={false} strokeWidth={2} />
        </LineChart>
      </Chart>
      <Chart title="HRV" note="Last point is 25 Feb 2025. Nothing in this block.">
        <LineChart data={dashboard.hrv as unknown as { d: string; v: number }[]}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="d" tickFormatter={short} tick={axis} interval={10} />
          <YAxis tick={axis} width={32} />
          <Tooltip labelFormatter={(v) => short(String(v))} contentStyle={tip.contentStyle} />
          <Line type="monotone" dataKey="v" name="HRV" stroke="var(--color-ink)" dot={false} strokeWidth={2} />
        </LineChart>
      </Chart>
      <Chart title="Weight" note="Nine entries. Last is 15 Sep 2026, 64.9 kg.">
        <LineChart data={dashboard.weight as unknown as { d: string; kg: number }[]}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="d" tickFormatter={short} tick={axis} />
          <YAxis domain={[62, 67]} tick={axis} width={32} />
          <Tooltip labelFormatter={(v) => short(String(v))} contentStyle={tip.contentStyle} />
          <Line type="monotone" dataKey="kg" name="kg" stroke="var(--color-accent)" strokeWidth={2} />
        </LineChart>
      </Chart>
    </div>
  );
}

function Chart({ title, note, children }: { title: string; note: string; children: ReactElement }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="font-serif text-xl">{title}</h2>
      <p className="mt-1 text-sm text-muted">{note}</p>
      <div className="mt-3 h-48">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function CoachPanel() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-serif text-xl">What's working</h2>
        <ul className="mt-3 flex flex-col gap-3 text-sm leading-relaxed">
          <li>September was already 10 to 13 hour weeks. You are not starting from zero.</li>
          <li>The week of 12 Oct was about 15 hours, and the two runs were actually easy: 139 and 133 bpm.</li>
          <li>The trainer test was a real 20 minutes: 266 W at 187 bpm. Indoor FTP is 252. Outdoor FTP is unknown.</li>
          <li>The Olympic swim has been 22:08 and 22:18.</li>
        </ul>
      </section>
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-serif text-xl">What to work on</h2>
        <ul className="mt-3 flex flex-col gap-3 text-sm leading-relaxed">
          <li>A run near 5:00 per km is often tempo. Easy is at or under 161 bpm and 5:15 per km or slower.</li>
          <li>Sleep and HRV stopped on 25 Feb 2025. Last night is blank.</li>
          <li>1:25 stays locked until the 11 Jan 10k is under 39:00. Open Shamrock at 6:43, not 6:29.</li>
          <li>Do not hold the indoor watts on the road. Outside, heart rate is the target.</li>
        </ul>
      </section>
    </div>
  );
}
