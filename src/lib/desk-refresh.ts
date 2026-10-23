import { createServerFn } from "@tanstack/react-start";

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

export const refreshDesk = createServerFn({ method: "GET" }).handler(async (): Promise<DeskLive> => {
  const { pullDesk } = await import("./intervals.server");
  return pullDesk();
});
