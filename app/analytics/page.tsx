"use client";

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Activity, MousePointerClick, Eye, LayoutGrid } from "lucide-react";
import { ClientOnly } from "@/components/client-only";
import { TRACK_POINTS } from "@/lib/analytics/registry";
import { fetchLogQuery, type QueryResponse } from "@/lib/analytics/query";

const AnalyticsCharts = lazy(() => import("./charts"));

const RANGE_OPTIONS = [7, 30, 90] as const;

const TYPE_LABEL: Record<string, string> = {
    display: "展现",
    exposure: "曝光",
    click: "点击",
};

function StatCard({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
}) {
    return (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                {icon}
            </div>
            <div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">
                    {value.toLocaleString()}
                </div>
                <div className="text-xs text-zinc-400">{label}</div>
            </div>
        </div>
    );
}

export default function AnalyticsPage() {
    const [days, setDays] = useState<number>(30);
    const [data, setData] = useState<QueryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        fetchLogQuery(days, "Asia/Shanghai", controller.signal)
            .then((result) => setData(result))
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                setError(err instanceof Error ? err.message : "加载失败");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [days]);

    const totals = data?.totals ?? {};
    const liveTotals = useMemo(() => {
        const map = new Map<string, QueryResponse["points"][number]>();
        for (const point of data?.points ?? []) map.set(point.key, point);
        return map;
    }, [data]);

    return (
        <main className="min-h-screen w-full bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
            <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 flex flex-col gap-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">埋点看板</h1>
                        <p className="text-sm text-zinc-500 mt-1">
                            展现 / 曝光 / 点击的全站点位登记与趋势（时区 Asia/Shanghai）。
                        </p>
                    </div>
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 self-start">
                        {RANGE_OPTIONS.map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setDays(option)}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                    days === option
                                        ? "bg-white dark:bg-zinc-700 shadow-sm font-medium"
                                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                                }`}
                            >
                                近 {option} 天
                            </button>
                        ))}
                    </div>
                </header>

                {error && (
                    <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-300">
                        数据加载失败：{error}
                    </div>
                )}

                <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={<LayoutGrid className="w-5 h-5" />} label="总事件" value={totals.all ?? 0} />
                    <StatCard icon={<Activity className="w-5 h-5" />} label="展现" value={totals.display ?? 0} />
                    <StatCard icon={<Eye className="w-5 h-5" />} label="曝光" value={totals.exposure ?? 0} />
                    <StatCard
                        icon={<MousePointerClick className="w-5 h-5" />}
                        label="点击"
                        value={totals.click ?? 0}
                    />
                </section>

                <section>
                    <h2 className="text-lg font-semibold mb-1">点位登记</h2>
                    <p className="text-xs text-zinc-400 mb-4">
                        全站埋点的形式化清单；实时总量来自查询接口，未登记点位会在趋势区标注。
                    </p>
                    <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500">
                                <tr>
                                    <th className="text-left font-medium px-4 py-2.5">点位</th>
                                    <th className="text-left font-medium px-4 py-2.5">类型</th>
                                    <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">
                                        来源
                                    </th>
                                    <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">
                                        说明
                                    </th>
                                    <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">
                                        参数
                                    </th>
                                    <th className="text-right font-medium px-4 py-2.5">总量</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {TRACK_POINTS.map((point) => (
                                    <tr key={point.key} className="align-top">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-zinc-800 dark:text-zinc-100">
                                                {point.label}
                                            </div>
                                            <code className="text-[11px] text-zinc-400">{point.key}</code>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-500">
                                            {TYPE_LABEL[point.type] ?? point.type}
                                        </td>
                                        <td className="px-4 py-3 text-zinc-500 hidden md:table-cell whitespace-nowrap">
                                            {point.source}
                                        </td>
                                        <td className="px-4 py-3 text-zinc-500 hidden lg:table-cell max-w-xs">
                                            {point.description}
                                        </td>
                                        <td className="px-4 py-3 hidden lg:table-cell">
                                            <div className="flex flex-wrap gap-1">
                                                {point.params.map((param) => (
                                                    <code
                                                        key={param}
                                                        className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                                                    >
                                                        {param}
                                                    </code>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                                            {(liveTotals.get(point.key)?.total ?? 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {loading && !data ? (
                    <div className="text-sm text-zinc-400 py-10 text-center">正在加载数据…</div>
                ) : data && totals.all === 0 ? (
                    <div className="text-sm text-zinc-400 py-10 text-center">
                        当前时间窗内暂无埋点数据。
                    </div>
                ) : data ? (
                    <ClientOnly>
                        <Suspense
                            fallback={<div className="text-sm text-zinc-400 py-10 text-center">正在渲染图表…</div>}
                        >
                            <AnalyticsCharts data={data} />
                        </Suspense>
                    </ClientOnly>
                ) : null}
            </div>
        </main>
    );
}
