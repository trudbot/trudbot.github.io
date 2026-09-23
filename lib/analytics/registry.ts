import type { TrackEventType } from "./track";

/**
 * Formal catalogue of every tracking point emitted to the log endpoint.
 *
 * This is the single source of truth for "which points exist": the dashboard
 * renders one section per entry and labels/organises the raw counts returned
 * by the query API against it. Points observed in the data but missing here
 * surface as "undocumented" so the registry and reality never silently drift.
 *
 * `key` must equal `${type}:${name}`, matching how the backend groups events
 * (event name is stored in `params.name`).
 */
export interface TrackPointDef {
    key: string;
    type: TrackEventType;
    name: string;
    label: string;
    /** Which site(s) emit this point. */
    source: string;
    description: string;
    /** Custom params carried in `params`, beyond the always-present name/page. */
    params: string[];
    /** Duration points carry a cumulative dwell time; charts read dwell stats. */
    isDuration?: boolean;
}

function def(entry: Omit<TrackPointDef, "key">): TrackPointDef {
    return { key: `${entry.type}:${entry.name}`, ...entry };
}

export const TRACK_POINTS: TrackPointDef[] = [
    def({
        type: "display",
        name: "page_view",
        label: "页面展现",
        source: "trudbot.github.io · Blog",
        description: "每次页面加载（或博客非文章页路由切入）时上报一次。",
        params: ["page", "referrer", "title"],
    }),
    def({
        type: "display",
        name: "article_view",
        label: "文章展现",
        source: "Blog",
        description: "进入一篇文章页时上报，携带文章 id 与分类标签。",
        params: ["page", "id", "tags", "categories", "sid"],
    }),
    def({
        type: "exposure",
        name: "article_exposure",
        label: "文章曝光",
        source: "Blog",
        description: "文章正文真正进入视口时上报一次，区别于“打开即算”的展现。",
        params: ["page", "id", "sid"],
    }),
    def({
        type: "exposure",
        name: "page_exposure",
        label: "页面曝光",
        source: "Blog",
        description: "非文章内容页进入视口时上报一次。",
        params: ["page", "sid"],
    }),
    def({
        type: "display",
        name: "article_duration",
        label: "文章展现时长",
        source: "Blog",
        description: "文章可见停留时长（切后台暂停）。dwell_ms 累计，按 sid 取最大值即为单次阅读时长。",
        params: ["page", "id", "sid", "dwell_ms", "stay_ms", "reason"],
        isDuration: true,
    }),
    def({
        type: "display",
        name: "page_duration",
        label: "页面展现时长",
        source: "Blog",
        description: "非文章页的可见停留时长，语义同文章展现时长。",
        params: ["page", "sid", "dwell_ms", "stay_ms", "reason"],
        isDuration: true,
    }),
    def({
        type: "click",
        name: "social_link",
        label: "社交外链点击",
        source: "trudbot.github.io",
        description: "首页 GitHub / Blog / 知乎 / npm 外链点击。",
        params: ["name", "href"],
    }),
    def({
        type: "click",
        name: "steam_profile",
        label: "Steam 主页点击",
        source: "trudbot.github.io",
        description: "首页“我的 Steam”按钮点击。",
        params: ["href"],
    }),
];

const POINT_INDEX = new Map(TRACK_POINTS.map((point) => [point.key, point]));

export function findTrackPoint(key: string): TrackPointDef | undefined {
    return POINT_INDEX.get(key);
}
