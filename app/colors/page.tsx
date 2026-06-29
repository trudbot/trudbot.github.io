import './colors.css'

// ─── 颜色数据 ────────────────────────────────────────────────────────────────
interface ColorEntry {
  hex: string
  name: string
  note: string
  group: string
}

const colors: ColorEntry[] = [
  // 薄荷梦境
  { hex: "#5CE0D8", name: "泡泡薄荷", note: "清透如泡泡水", group: "薄荷梦境" },
  { hex: "#7DFFC7", name: "汽水绿", note: "碳酸饮料的气泡", group: "薄荷梦境" },
  { hex: "#B5F5EC", name: "薄荷冰", note: "融化中的冰淇淋", group: "薄荷梦境" },

  // 糖果铺子
  { hex: "#FF8FAB", name: "糖果粉", note: "柔软温暖", group: "糖果铺子" },
  { hex: "#FF6B9D", name: "草莓奶昔", note: "甜而不腻", group: "糖果铺子" },
  { hex: "#FFC4D6", name: "棉花糖", note: "蓬松的幸福", group: "糖果铺子" },

  // 阳光午后
  { hex: "#FFD166", name: "向日葵黄", note: "明亮阳光", group: "阳光午后" },
  { hex: "#FFA94D", name: "蜜橘", note: "秋天的第一口橘子", group: "阳光午后" },
  { hex: "#FFEAA7", name: "柠檬可丽饼", note: "温柔的午后", group: "阳光午后" },

  // 梦境紫
  { hex: "#A78BFA", name: "梦幻紫", note: "轻盈梦境感", group: "梦境紫" },
  { hex: "#C4B5FD", name: "薰衣草雾", note: "普罗旺斯的风", group: "梦境紫" },
  { hex: "#818CF8", name: "星空靛", note: "夜空中最亮的星", group: "梦境紫" },

  // 天空收集
  { hex: "#7DD3FC", name: "天空蓝", note: "晴天抬头看到的颜色", group: "天空收集" },
  { hex: "#67E8F9", name: "浅海", note: "海水最浅的地方", group: "天空收集" },
  { hex: "#A5F3FC", name: "冰川蓝", note: "格陵兰的冰", group: "天空收集" },
]

// 按 group 分组
const groups = Array.from(new Set(colors.map((c) => c.group)))

// 判断浅色用深色文字
function textColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? "#1a1a2e" : "#fffffe"
}

// ─── 页面 ────────────────────────────────────────────────────────────────────
export default function ColorsPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto max-w-5xl">
        {/* 标题 */}
        <header className="mb-16 colors-entry" style={{ animationDelay: "0s" }}>
          <h1 className="font-handwriting text-5xl font-bold tracking-tight text-foreground md:text-7xl">
            收藏的颜色
          </h1>
          <p className="mt-4 text-lg text-muted-foreground md:text-xl">
            那些让我心动的、清新的、像梦一样的颜色。
          </p>
          <div className="mt-6 flex gap-2">
            {["#5CE0D8", "#FF8FAB", "#FFD166", "#A78BFA", "#7DD3FC"].map((c) => (
              <div
                key={c}
                className="h-2 rounded-full colors-pop"
                style={{
                  background: c,
                  width: `${Math.random() * 40 + 24}px`,
                  animationDelay: `${0.3 + Math.random() * 0.3}s`,
                }}
              />
            ))}
          </div>
        </header>

        {/* 分组展示 */}
        {groups.map((group, gi) => (
          <section key={group} className="mb-16">
            <h2
              className="mb-6 font-handwriting text-2xl font-semibold text-foreground/80 md:text-3xl colors-entry"
              style={{ animationDelay: `${0.2 + gi * 0.15}s` }}
            >
              {group}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {colors
                .filter((c) => c.group === group)
                .map((color, ci) => (
                  <div
                    key={color.hex}
                    className="colors-pop group"
                    style={{ animationDelay: `${0.3 + gi * 0.15 + ci * 0.08}s` }}
                  >
                    <div
                      className="relative overflow-hidden rounded-2xl p-6 transition-transform duration-300 hover:scale-[1.03]"
                      style={{ background: color.hex }}
                    >
                      {/* 装饰圆 */}
                      <div
                        className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20"
                        style={{ background: textColor(color.hex) }}
                      />

                      <p
                        className="font-handwriting text-xl font-bold"
                        style={{ color: textColor(color.hex) }}
                      >
                        {color.name}
                      </p>
                      <p
                        className="mt-1 text-sm opacity-70"
                        style={{ color: textColor(color.hex) }}
                      >
                        {color.note}
                      </p>
                      <p
                        className="mt-3 font-mono text-xs opacity-50"
                        style={{ color: textColor(color.hex) }}
                      >
                        {color.hex}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ))}

        {/* 底部 */}
        <footer
          className="flex items-center justify-center gap-6 border-t border-border pt-8 colors-entry"
          style={{ animationDelay: "0.8s" }}
        >
          <div className="flex gap-1.5">
            {["#5CE0D8", "#FF8FAB", "#FFD166", "#A78BFA"].map((c) => (
              <div key={c} className="h-2 w-2 rounded-full" style={{ background: c }} />
            ))}
          </div>
          <a
            href="/"
            className="font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← 回到首页
          </a>
        </footer>
      </div>
    </main>
  )
}
