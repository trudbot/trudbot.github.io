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
    def({
        type: "click",
        name: "town_start",
        label: "小镇开始游戏",
        source: "trudbot.github.io · /town",
        description: "点击“开始冒险”进入 trudbot 小镇。",
        params: ["total"],
    }),
    def({
        type: "click",
        name: "town_mute",
        label: "小镇静音切换",
        source: "trudbot.github.io · /town",
        description: "切换游戏音效开关。",
        params: ["muted"],
    }),
    def({
        type: "click",
        name: "town_night",
        label: "小镇昼夜切换",
        source: "trudbot.github.io · /town",
        description: "白天/夜晚切换，按钮、快捷键或上床睡觉都会触发。",
        params: ["night", "location"],
    }),
    def({
        type: "click",
        name: "town_interact",
        label: "小镇互动",
        source: "trudbot.github.io · /town",
        description: "按互动键触发身边的提示（对话、开门、道具等）。",
        params: ["label", "location"],
    }),
    def({
        type: "click",
        name: "town_house_enter",
        label: "进入房屋",
        source: "trudbot.github.io · /town",
        description: "进入一栋房屋的室内场景。",
        params: ["house", "first_visit"],
    }),
    def({
        type: "click",
        name: "town_house_exit",
        label: "离开房屋",
        source: "trudbot.github.io · /town",
        description: "从室内回到小镇。",
        params: ["house"],
    }),
    def({
        type: "display",
        name: "town_effect",
        label: "小镇道具效果",
        source: "trudbot.github.io · /town",
        description: "吃到加速或变大道具后效果生效。",
        params: ["effect", "seconds"],
    }),
    def({
        type: "display",
        name: "town_star",
        label: "收集星星",
        source: "trudbot.github.io · /town",
        description: "捡到一颗星星。",
        params: ["id", "location", "count", "total", "pos", "play_s"],
    }),
    def({
        type: "display",
        name: "town_star_complete",
        label: "星星全收集",
        source: "trudbot.github.io · /town",
        description: "集齐全部星星。",
        params: ["total", "play_s"],
    }),
    def({
        type: "display",
        name: "town_session",
        label: "小镇游玩时长",
        source: "trudbot.github.io · /town",
        description: "开始游戏后离开页面时上报本次游玩汇总。",
        params: ["play_s", "stars", "total", "houses"],
    }),
    def({
        type: "display",
        name: "town_load_error",
        label: "小镇加载失败",
        source: "trudbot.github.io · /town",
        description: "3D 引擎加载或初始化失败。",
        params: ["reason"],
    }),
    def({
        type: "display",
        name: "town_hop_start",
        label: "跳跳乐开跑",
        source: "trudbot.github.io · /town",
        description: "从地面起跳或乘云从检查点出发，开始一次攀登。",
        params: ["assisted", "best_s", "checkpoint"],
    }),
    def({
        type: "display",
        name: "town_hop_checkpoint",
        label: "跳跳乐检查点",
        source: "trudbot.github.io · /town",
        description: "本次攀登首次到达某个检查点。",
        params: ["checkpoint", "total", "height", "time_s"],
    }),
    def({
        type: "display",
        name: "town_hop_end",
        label: "跳跳乐中断",
        source: "trudbot.github.io · /town",
        description: "攀登中掉回地面（fall）或离开场地（leave）。",
        params: ["result", "peak", "checkpoint", "time_s", "assisted", "springs", "crumbles"],
    }),
    def({
        type: "display",
        name: "town_hop_finish",
        label: "跳跳乐登顶",
        source: "trudbot.github.io · /town",
        description: "登上云顶终点。",
        params: ["time_s", "assisted", "new_best", "best_s", "checkpoint", "springs", "crumbles"],
    }),
    def({
        type: "click",
        name: "town_hop_slide",
        label: "跳跳乐彩虹滑梯",
        source: "trudbot.github.io · /town",
        description: "在云顶乘彩虹滑回地面。",
        params: [],
    }),
    def({
        type: "click",
        name: "town_hop_elevator",
        label: "跳跳乐乘云",
        source: "trudbot.github.io · /town",
        description: "点击起点云朵传送到已解锁的检查点；未解锁时 locked 为 true。",
        params: ["checkpoint", "locked", "height"],
    }),
];

const POINT_INDEX = new Map(TRACK_POINTS.map((point) => [point.key, point]));

export function findTrackPoint(key: string): TrackPointDef | undefined {
    return POINT_INDEX.get(key);
}
