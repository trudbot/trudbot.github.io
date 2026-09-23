import type { TrackEventType } from "./track";

export interface QuerySeriesBucket {
    date: string;
    count: number;
}

export interface QueryPoint {
    key: string;
    type: TrackEventType;
    name: string;
    total: number;
    firstAt: string | null;
    lastAt: string | null;
    series: QuerySeriesBucket[];
}

export interface QueryDuration {
    key: string;
    type: TrackEventType;
    name: string;
    visits: number;
    avgMs: number;
    p50Ms: number;
    p90Ms: number;
}

export interface QueryPageBreakdown {
    page: string;
    total: number;
    series: QuerySeriesBucket[];
}

export interface QueryResponse {
    ok: boolean;
    range: { from: string; to: string; days: number; tz: string; bucket: string };
    totals: Record<string, number>;
    points: QueryPoint[];
    durations: QueryDuration[];
    pages?: { host: string | null; items: QueryPageBreakdown[] };
}

const QUERY_ENDPOINT =
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
        ?.VITE_LOG_QUERY_ENDPOINT ?? "https://api.trudbot.cn/query";

export async function fetchLogQuery(
    days: number,
    tz = "Asia/Shanghai",
    signal?: AbortSignal,
    host?: string,
): Promise<QueryResponse> {
    const url = new URL(QUERY_ENDPOINT);
    url.searchParams.set("days", String(days));
    url.searchParams.set("tz", tz);
    if (host) url.searchParams.set("host", host);
    const response = await fetch(url.toString(), { signal });
    if (!response.ok) throw new Error(`query failed: ${response.status}`);
    return (await response.json()) as QueryResponse;
}

/** Format a millisecond duration as a compact, human-readable string. */
export function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return "0s";
    const totalSeconds = Math.round(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60) return `${minutes}m${seconds ? ` ${seconds}s` : ""}`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
}
