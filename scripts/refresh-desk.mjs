import { writeFileSync } from "node:fs";

const key = process.env.INTERVALS_API_KEY?.trim();
const athlete = process.env.INTERVALS_ATHLETE_ID?.trim();
if (!key || !athlete) {
  console.error("Missing INTERVALS_API_KEY or INTERVALS_ATHLETE_ID");
  process.exit(1);
}

function nyDate(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  return now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

async function icu(path) {
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

const oldest = nyDate(-16);
const newest = nyDate(1);
const id = encodeURIComponent(athlete);
const [wellness, activities] = await Promise.all([
  icu(`/athlete/${id}/wellness?oldest=${oldest}&newest=${newest}`),
  icu(`/athlete/${id}/activities?oldest=${oldest}&newest=${newest}`),
]);

const rows = wellness
  .filter((row) => row.id)
  .sort((a, b) => String(a.id).localeCompare(String(b.id)));
const today = nyDate(0);
const todayRow = rows.find((row) => row.id === today);
const last = [...rows].reverse().find((row) => row.ctl != null && row.atl != null);
const used = todayRow?.ctl != null ? todayRow : last;
const resting = [...rows].reverse().find((row) => typeof row.restingHR === "number" && row.restingHR >= 40 && row.restingHR <= 85);
const sessions = activities.map((a) => ({
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
const series = rows
  .filter((row) => row.ctl != null && row.atl != null)
  .map((row) => ({
    d: row.id,
    ctl: Math.round(row.ctl * 10) / 10,
    atl: Math.round(row.atl * 10) / 10,
    form: Math.round((row.ctl - row.atl) * 10) / 10,
  }));
const data = {
  ok: true,
  today,
  asOf: used?.id,
  ctl: used?.ctl == null ? undefined : Math.round(used.ctl * 10) / 10,
  atl: used?.atl == null ? undefined : Math.round(used.atl * 10) / 10,
  form: used?.ctl == null || used.atl == null ? undefined : Math.round((used.ctl - used.atl) * 10) / 10,
  restingHr: resting?.restingHR ?? null,
  restingDate: resting?.id ?? null,
  sessions,
  series,
  refreshedAt: new Date().toISOString(),
};

const body = `${JSON.stringify(data, null, 2)}\n`;
writeFileSync(new URL("../public/desk-live.json", import.meta.url), body);
writeFileSync(new URL("../site/desk-live.json", import.meta.url), body);
console.log(`Wrote desk for ${today}`);
