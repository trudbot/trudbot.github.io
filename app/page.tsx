import { ProfileCard } from "@/components/profile-card"
import { FloatingShapes } from "@/components/floating-shapes"
import { BottomDecoration } from "@/components/bottom-decoration"

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <FloatingShapes />
      <div className="relative z-10 flex min-h-screen flex-col p-8 md:p-16">
        <ProfileCard />
        <BottomDecoration />
      </div>
    </main>
  )
}

// import React from "react";
// import "./ProfilePage.css"; // 样式独立成文件，也可以直接内联

function ProfilePage() {
  const links = [
    {
      href: "https://github.com/trudbot",
      icon: "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/202407191658446.png",
      text: "github",
    },
    {
      href: "https://trudbot.cn/Blog",
      icon: "https://trudbot-pic.oss-cn-hangzhou.aliyuncs.com/20240110214815285776-7322466096995979814-3.webp",
      text: "blog",
    },
    {
      href: "https://www.zhihu.com/people/qu-ge-sha-ming-hao-ni-30",
      icon: "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/202407191656864.png",
      text: "zhihu",
    },
    {
      href: "https://www.npmjs.com/org/trudbot",
      icon: "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/202407191651233.png",
      text: "npm",
    },
  ];

  return (
    <div className="content">
      <div className="info-container">
        <img
          className="avatar transition-opacity animate-pulse-slow"
          src="https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/202407082112768.jpg"
          srcSet={`
            https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/uploads/2025/10/01/1759302034583_202407082112768_160x160.jpg 1x,
            https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/uploads/2025/10/01/1759302034339_202407082112768_1x.jpg 1.5x,
            https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/uploads/2025/10/01/1759301753695_202407082112768_2x.jpg 2x,
            https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/uploads/2025/10/01/1759301753695_202407082112768_3x.jpg 3x
          `}
          alt="avatar"
          fetchPriority="high"
        />
        <div className="name">@trudbot</div>
      </div>

      <div className="links-container">
        {links.map(({ href, icon, text }) => (
          <div key={text} className="link-item">
            <a
              className="link-button-wrapper"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="link-icon" style={{ backgroundImage: `url(${icon})` }} />
              <p className="link-text">{text}</p>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
