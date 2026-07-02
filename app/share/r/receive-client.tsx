"use client";
import { useEffect, useMemo, useState } from "react";
import LZString from "lz-string";
import {
  CopiedBubble,
  RoughActionButton,
  RoughCard,
  ScribbleDivider,
  ShareTopBar,
  Sparkle,
} from "../share-doodle-ui";

function useClipboard() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const copy = async (text: string) => {
    const copyWithTextarea = () => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
    };

    try {
      if (navigator?.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      } else {
        copyWithTextarea();
      }
    } catch (e) {
      try {
        copyWithTextarea();
      } catch {
        console.error("Failed to copy", e);
      }
    }
  };

  return { copy, copied };
}

function CopyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="7" y="7" width="12" height="12" rx="1.5" stroke="#1C1917" strokeWidth="1.8" />
      <path
        d="M4 15H3.5a2 2 0 01-2-2V3.5a2 2 0 012-2H13a2 2 0 012 2V7"
        stroke="#1C1917"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M9 4H5a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-4M14 2h6v6M20 2L11 11"
        stroke="#1C1917"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg width="28" height="16" viewBox="0 0 28 16" fill="none" aria-hidden="true">
      <path
        d="M26 8 Q16 2 6 8 Q3 9 2 8"
        stroke="#FF7043"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M6 4 L2 8 L6 12"
        stroke="#FF7043"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default function ReceiveClient() {
  const [receivedContent, setReceivedContent] = useState("");
  const [openableUrl, setOpenableUrl] = useState("");
  const [currentOrigin, setCurrentOrigin] = useState("");
  const { copy, copied } = useClipboard();

  const content = useMemo(() => {
    if (typeof window === "undefined") return "";

    const searchParams = new URLSearchParams(window.location.search);
    const compressed = searchParams.get("compressed");
    if (compressed) return LZString.decompressFromEncodedURIComponent(compressed) || "";
    return searchParams.get("content") || "";
  }, []);

  useEffect(() => {
    setCurrentOrigin(window.location.origin + window.location.pathname.replace("/r", ""));

    if (content) {
      setReceivedContent(content);

      try {
        const url = new URL(content);
        setOpenableUrl(url.protocol === "http:" || url.protocol === "https:" ? url.href : "");
      } catch {
        setOpenableUrl("");
      }
    }
  }, [content]);

  const openInNewTab = () => {
    if (openableUrl) {
      const openedWindow = window.open(openableUrl, "_blank", "noopener,noreferrer");
      if (openedWindow) openedWindow.opener = null;
    }
  };

  const goToShare = () => {
    window.location.href = currentOrigin || "/share";
  };

  if (!receivedContent) {
    return (
      <div className="text-share-page">
        <ShareTopBar activePage="receive" />

        <main className="text-share-main">
          <section className="text-share-hero" aria-labelledby="receive-empty-title">
            <Sparkle x={-8} y={8} color="#FF7043" size={22} />
            <Sparkle x={300} y={0} color="#42A5F5" size={16} />

            <div className="text-share-kicker-row">
              <span className="text-share-badge text-share-badge-orange">未找到内容</span>
              <span className="text-share-date">分享链接里没有可展示的文本</span>
            </div>

            <h1 id="receive-empty-title" className="text-share-heading">
              空空
              <br />
              如也
            </h1>
          </section>

          <RoughCard seed={11}>
            <div className="text-share-card-inner">
              <div className="text-share-empty">
                <span className="text-share-empty-mark">?</span>
                <p>回到生成页，写一段内容再试试。</p>
              </div>
              <div className="text-share-actions text-share-actions-single">
                <RoughActionButton fill="#FFDE59" seed={31} onClick={goToShare}>
                  <div className="text-share-action-content">
                    <BackArrowIcon />
                    <div>
                      <div className="text-share-action-title">去分享</div>
                      <div className="text-share-action-subtitle">生成新的二维码</div>
                    </div>
                  </div>
                </RoughActionButton>
              </div>
            </div>
          </RoughCard>
        </main>
      </div>
    );
  }

  return (
    <div className="text-share-page">
      <ShareTopBar activePage="receive" />

      <main className="text-share-main">
        <section className="text-share-hero" aria-labelledby="receive-title">
          <Sparkle x={-8} y={8} color="#4CAF50" size={22} />
          <Sparkle x={300} y={0} color="#42A5F5" size={16} />

          <div className="text-share-kicker-row">
            <span className="text-share-badge text-share-badge-green">扫码成功</span>
            <span className="text-share-date">
              {new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}
            </span>
          </div>

          <h1 id="receive-title" className="text-share-heading">
            收到
            <br />
            内容
          </h1>
        </section>

        <RoughCard seed={5}>
          <div className="text-share-card-inner">
            <div className="text-share-result-content">
              <span className="text-share-quote-mark" aria-hidden="true">
                &quot;
              </span>
              <p className="text-share-content">{receivedContent}</p>
            </div>

            {openableUrl && (
              <>
                <ScribbleDivider />
                <div className="text-share-source-row">
                  <span className="text-share-badge text-share-badge-blue">链接</span>
                  <span className="text-share-source-text">{receivedContent}</span>
                </div>
              </>
            )}
          </div>
        </RoughCard>

        <div className="text-share-actions">
          <div className="text-share-action-wrap">
            {copied && <CopiedBubble />}
            <RoughActionButton fill="#FFDE59" seed={30} onClick={() => copy(receivedContent)}>
              <div className="text-share-action-content">
                <CopyIcon />
                <div>
                  <div className="text-share-action-title">
                    {copied ? "内容已复制" : "复制文本"}
                  </div>
                  <div className="text-share-action-subtitle">复制全部内容</div>
                </div>
              </div>
            </RoughActionButton>
          </div>

          {openableUrl && (
            <RoughActionButton fill="#E8F5E9" seed={50} onClick={openInNewTab}>
              <div className="text-share-action-content">
                <OpenIcon />
                <div>
                  <div className="text-share-action-title">打开链接</div>
                  <div className="text-share-action-subtitle">在浏览器中跳转</div>
                </div>
              </div>
            </RoughActionButton>
          )}
        </div>

        <a href="/share" className="text-share-back-link">
          <BackArrowIcon />
          返回生成新码
        </a>
      </main>
    </div>
  );
}
