import "@fontsource/caveat/latin-600.css";
import "@fontsource/caveat/latin-700.css";
import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import LZString from "lz-string";
import { QRCodeImg } from "./qr-code-img";
import {
  CopiedBubble,
  RoughActionButton,
  RoughCard,
  ScribbleDivider,
  ShareTopBar,
  Sparkle,
} from "./share-doodle-ui";

const COMPRESSION_MIN_LENGTH = 200;

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

export default function SharePage() {
  const [inputText, setInputText] = useState("");
  const [currentOrigin, setCurrentOrigin] = useState("");
  const { copy, copied } = useClipboard();

  const shareUrl = useMemo(() => {
    if (!inputText) return "";

    const encoded = encodeURIComponent(inputText);
    if (inputText.length < COMPRESSION_MIN_LENGTH) {
      return `${currentOrigin}/r?content=${encoded}`;
    }

    const compressed = LZString.compressToEncodedURIComponent(inputText);
    if (compressed.length >= encoded.length) {
      return `${currentOrigin}/r?content=${encoded}`;
    }
    return `${currentOrigin}/r?compressed=${compressed}`;
  }, [inputText, currentOrigin]);

  useEffect(() => {
    setCurrentOrigin(`${window.location.origin}/share`);
  }, []);

  return (
    <div className="text-share-page">
      <ShareTopBar activePage="share" />

      <main className="text-share-main">
        <section className="text-share-hero" aria-labelledby="share-title">
          <Sparkle x={-8} y={8} color="#FF7043" size={22} />
          <Sparkle x={310} y={4} color="#42A5F5" size={16} />

          <div className="text-share-kicker-row">
            <span className="text-share-badge text-share-badge-orange">生成分享</span>
            <span className="text-share-date">文本、链接、任何想传递的内容</span>
          </div>

          <h1 id="share-title" className="text-share-heading">
            文本
            <br />
            分享
          </h1>
        </section>

        <RoughCard seed={7}>
          <div className="text-share-card-inner">
            <div className="text-share-input-header">
              <div>
                <h2>写下要分享的内容</h2>
                <p>输入后会自动生成可扫码打开的分享二维码。</p>
              </div>
              <span className={`text-share-char-count ${inputText.length > 1000 ? "warning" : ""}`}>
                {inputText.length} 字符
              </span>
            </div>

            <textarea
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              className="text-share-input-area"
              placeholder="在此输入要分享的文本或长链接..."
              rows={6}
            />

            <ScribbleDivider />

            {inputText ? (
              <div className="text-share-preview text-share-pop-in">
                <QRCodeImg value={shareUrl} />

                <div className="text-share-actions text-share-actions-single">
                  <div className="text-share-action-wrap">
                    {copied && <CopiedBubble />}
                    <RoughActionButton fill="#FFDE59" seed={30} onClick={() => copy(shareUrl)}>
                      <div className="text-share-action-content">
                        <CopyIcon />
                        <div>
                          <div className="text-share-action-title">
                            {copied ? "链接已复制" : "复制分享链接"}
                          </div>
                          <div className="text-share-action-subtitle">扫码或发给朋友查看</div>
                        </div>
                      </div>
                    </RoughActionButton>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-share-empty">
                <span className="text-share-empty-mark">?</span>
                <p>输入内容后自动生成二维码</p>
              </div>
            )}
          </div>
        </RoughCard>
      </main>
    </div>
  );
}
