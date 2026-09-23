"use client";

import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import type { TrackEventType } from "@/lib/analytics/track";
import {
    formatDuration,
    type QueryResponse,
    type QuerySeriesBucket,
} from "@/lib/analytics/query";
import { findTrackPoint, TRACK_POINTS } from "@/lib/analytics/registry";

const TYPE_COLOR: Record<TrackEventType, string> = {
    display: "#3b82f6",
    exposure: "#10b981",
    click: "#f59e0b",
};

const TYPE_LABEL: Record<TrackEventType, string> = {
    display: "展现",
    exposure: "曝光",
    click: "点击",
};

function shortDate(value: string): string {
    return value.length >= 10 ? value.slice(5) : value;
}

function TrendChart({ data, color }: { data: QuerySeriesBucket[]; color: string }) {
    return (
        <ResponsiveContainer width="100%" height={116}>
            <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
                <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-zinc-200 dark:text-zinc-800"
                    vertical={false}
                />
                <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fontSize: 10 }}
                    minTickGap={28}
                    stroke="currentColor"
                    className="text-zinc-400"
                />
                <YAxis
                    allowDecimals={false}
                    width={30}
                    tick={{ fontSize: 10 }}
                    stroke="currentColor"
                    className="text-zinc-400"
                />
                <Tooltip
                    labelFormatter={(label) => `日期 ${label}`}
                    formatter={(value: number) => [value, "次数"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Area
                    type="monotone"
                    dataKey="count"
                    stroke={color}
                    fill={color}
                    fillOpacity={0.14}
                    strokeWidth={2}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

function DurationChart({ durations }: { durations: QueryResponse["durations"] }) {
    const data = durations.map((item) => ({
        name: findTrackPoint(item.key)?.label ?? item.name,
        平均: Number((item.avgMs / 1000).toFixed(1)),
        中位: Number((item.p50Ms / 1000).toFixed(1)),
        P90: Number((item.p90Ms / 1000).toFixed(1)),
    }));
    return (
        <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-zinc-200 dark:text-zinc-800"
                    vertical={false}
                />
                <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-zinc-400"
                />
                <YAxis
                    width={40}
                    tick={{ fontSize: 10 }}
                    unit="s"
                    stroke="currentColor"
                    className="text-zinc-400"
                />
                <Tooltip
                    formatter={(value: number, key) => [`${value}s`, String(key)]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="平均" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="中位" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="P90" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}

function TrendCard({
    label,
    keyId,
    type,
    total,
    lastAt,
    documented,
    series,
}: {
    label: string;
    keyId: string;
    type: TrackEventType;
    total: number;
    lastAt: string | null;
    documented: boolean;
    series: QuerySeriesBucket[];
}) {
    const color = TYPE_COLOR[type];
    return (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-100 truncate">
                            {label}
                        </span>
                        {!documented && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                未登记
                            </span>
                        )}
                    </div>
                    <code className="text-[11px] text-zinc-400">{keyId}</code>
                </div>
                <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full text-white shrink-0"
                    style={{ backgroundColor: color }}
                >
                    {TYPE_LABEL[type]}
                </span>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">
                    {total.toLocaleString()}
                </span>
                <span className="text-xs text-zinc-400">次</span>
            </div>
            <TrendChart data={series} color={color} />
            <div className="text-[11px] text-zinc-400">
                最近：{lastAt ? new Date(lastAt).toLocaleString("zh-CN") : "—"}
            </div>
        </div>
    );
}

export default function AnalyticsCharts({ data }: { data: QueryResponse }) {
    const byKey = new Map(data.points.map((point) => [point.key, point]));
    const emptySeries: QuerySeriesBucket[] = [];

    // Documented points first (registry order), then anything seen in the data
    // but missing from the registry, so drift is always visible.
    const documentedCards = TRACK_POINTS.map((def) => {
        const point = byKey.get(def.key);
        return {
            label: def.label,
            keyId: def.key,
            type: def.type,
            total: point?.total ?? 0,
            lastAt: point?.lastAt ?? null,
            documented: true,
            series: point?.series ?? emptySeries,
        };
    });
    const undocumentedCards = data.points
        .filter((point) => !findTrackPoint(point.key))
        .map((point) => ({
            label: point.name,
            keyId: point.key,
            type: point.type,
            total: point.total,
            lastAt: point.lastAt,
            documented: false,
            series: point.series,
        }));
    const cards = [...documentedCards, ...undocumentedCards];

    return (
        <div className="flex flex-col gap-10">
            <section>
                <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 mb-4">
                    趋势
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cards.map((card) => (
                        <TrendCard key={card.keyId} {...card} />
                    ))}
                </div>
            </section>

            {data.durations.length > 0 && (
                <section>
                    <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 mb-1">
                        展现时长
                    </h2>
                    <p className="text-xs text-zinc-400 mb-4">
                        按 sid 去重后的单次可见时长分布（秒）。
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
                            <DurationChart durations={data.durations} />
                        </div>
                        <div className="flex flex-col gap-3">
                            {data.durations.map((item) => (
                                <div
                                    key={item.key}
                                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
                                >
                                    <div className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">
                                        {findTrackPoint(item.key)?.label ?? item.name}
                                    </div>
                                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                                        <Stat label="平均" value={formatDuration(item.avgMs)} />
                                        <Stat label="中位" value={formatDuration(item.p50Ms)} />
                                        <Stat label="P90" value={formatDuration(item.p90Ms)} />
                                    </div>
                                    <div className="mt-2 text-[11px] text-zinc-400">
                                        {item.visits.toLocaleString()} 次访问
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-sm font-bold text-zinc-900 dark:text-white tabular-nums">
                {value}
            </div>
            <div className="text-[11px] text-zinc-400">{label}</div>
        </div>
    );
}
