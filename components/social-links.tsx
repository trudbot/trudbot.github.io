const socialLinks = [
  {
    href: "https://github.com/trudbot",
    name: "GitHub",
    icon: "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/202407191658446.png",
    bgColor: "bg-gray-100", // 黑色图标配浅灰背景
  },
  {
    href: "https://trudbot.cn/Blog",
    name: "Blog",
    icon: "https://trudbot-pic.oss-cn-hangzhou.aliyuncs.com/20240110214815285776-7322466096995979814-3.webp",
    bgColor: "bg-emerald-100", // 绿色图标配淡绿背景
  },
  {
    href: "https://www.zhihu.com/people/qu-ge-sha-ming-hao-ni-30",
    name: "知乎",
    icon: "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/202407191656864.png",
    bgColor: "bg-blue-100", // 蓝色图标配淡蓝背景
  },
  {
    href: "https://www.npmjs.com/org/trudbot",
    name: "npm",
    icon: "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/202407191651233.png",
    bgColor: "bg-red-100", // 红色图标配淡红背景
  },
]

const shapes = [
  "clip-none",     // 正方形
  "clip-triangle", // 三角形
  "clip-diamond",  // 菱形
  "clip-none",     // 正方形
]

export function SocialLinks() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 animate-[sl-fade-in_0.4s_ease-out_both]">
      {socialLinks.map((link, index) => (
        <a
          key={link.name}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`group relative flex h-20 w-20 items-center justify-center focus-visible:outline-none ${link.bgColor} ${shapes[index]} sl-item`}
          style={{
            animation: `sl-enter 0.4s ease-out ${index * 0.08}s both`,
            // even items rotate +5 on hover, odd items rotate -5
            '--sl-hover-rotate': index % 2 === 0 ? '5deg' : '-5deg',
          } as React.CSSProperties}
        >
          <div className="relative z-10 h-8 w-8 transition-transform duration-300 group-hover:scale-110">
            <img
              src={link.icon || "/placeholder.svg"}
              alt={link.name}
              className="h-full w-full object-contain"
              crossOrigin="anonymous"
            />
          </div>
          <span className="sr-only">{link.name}</span>
        </a>
      ))}
    </div>
  )
}
