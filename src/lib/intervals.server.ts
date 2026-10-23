import { readFileSync } from "node:fs";

export type LiveSession = {
  date: string;
  name: string;
  type: string;
  mins: number;
  km: number;
  avgHr: number | null;
  maxHr: number | null;
  avgW: number | null;
  np: number | null;
  load: number | null;
};

export type DeskLive = {
  ok: boolean;
  today?: string;
  asOf?: string;
  ctl?: number;
  atl?: number;
  form?: number;
  restingHr?: number | null;
  restingDate?: string | null;
  sessions?: LiveSession[];
};

function creds(): { athlete: string; key: string } | null {
  const fromEnv = process.env.INTERVALS_API_KEY?.trim();
  const athleteEnv = process.env.INTERVALS_ATHLETE_ID?.trim();
  if (fromEnv && athleteEnv) return { athlete: athleteEnv, key: fromEnv };
  for (const path of ["/workspace/attachments/.env", "/workspace/.env"]) {
    try {
      const bag: Record<string, string> = {};
      for (const line of readFileSync(path, "utf8").split("\n")) {
        const s = line.trim();
        if (!s || s.startsWith("#") || !s.includes("=")) continue;
        const i = s.indexOf("=");
        bag[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      }
      if (bag.INTERVALS_API_KEY && bag.INTERVALS_ATHLETE_ID) {
        return { athlete: bag.INTERVALS_ATHLETE_ID, key: bag.INTERVALS_API_KEY };
      }
    } catch {
      /* next path */
    }
  }
  return null;
}

function nyDate(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  return now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

async function icu(path: string, key: string) {
  const res = await fetch(`https://intervals.icu/api/v1${path}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`API_KEY:${key}`).toString("base64")}`,
      "User-Agent": "PersonalIntervalsExport/1.0",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

let cache: { at: number; data: DeskLive } | null = null;

export async function pullDesk(): Promise<DeskLive> {
  if (cache && Date.now() - cache.at < 60_000) return cache.data;
  const c = creds();
  if (!c) return { ok: false };
  try {
    const oldest = nyDate(-16);
    const newest = nyDate(1);
    const athlete = encodeURIComponent(c.athlete);
    const [wellness, activities] = await Promise.all([
      icu(`/athlete/${athlete}/wellness?oldest=${oldest}&newest=${newest}`, c.key),
      icu(`/athlete/${athlete}/activities?oldest=${oldest}&newest=${newest}`, c.key),
    ]);
    const rows = (wellness as { id?: string; ctl?: number; atl?: number; restingHR?: number | null }[])
      .filter((row) => row.id)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const today = nyDate(0);
    const todayRow = rows.find((row) => row.id === today);
    const last = [...rows].reverse().find((row) => row.ctl != null && row.atl != null);
    const used = todayRow?.ctl != null ? todayRow : last;
    const resting = [...rows].reverse().find((row) => {
      const hr = row.restingHR;
      return typeof hr === "number" && hr >= 40 && hr <= 85;
    });
    const sessions: LiveSession[] = (activities as Record<string, unknown>[]).map((a) => ({
      date: String(a.start_date_local ?? "").slice(0, 10),
      name: String(a.name ?? "Activity"),
      type: String(a.type ?? ""),
      mins: Math.round(Number(a.moving_time ?? 0) / 60),
      km: Math.round(Number(a.distance ?? 0) / 100) / 10,
      avgHr: a.average_heartrate == null ? null : Math.round(Number(a.average_heartrate)),
      maxHr: a.max_heartrate == null ? null : Math.round(Number(a.max_heartrate)),
      avgW: a.icu_average_watts == null ? null : Math.round(Number(a.icu_average_watts)),
      np: a.icu_weighted_avg_watts == null ? null : Math.round(Number(a.icu_weighted_avg_watts)),
      load: a.icu_training_load == null ? null : Math.round(Number(a.icu_training_load)),
    }));
    const data: DeskLive = {
      ok: true,
      today,
      asOf: used?.id,
      ctl: used?.ctl == null ? undefined : Math.round(used.ctl * 10) / 10,
      atl: used?.atl == null ? undefined : Math.round(used.atl * 10) / 10,
      form: used?.ctl == null || used.atl == null ? undefined : Math.round((used.ctl - used.atl) * 10) / 10,
      restingHr: resting?.restingHR ?? null,
      restingDate: resting?.id ?? null,
      sessions,
    };
    cache = { at: Date.now(), data };
    return data;
  } catch {
    return { ok: false };
  }
}
