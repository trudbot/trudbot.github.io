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

function WigglyLine() {
  return (
    <svg
      className="text-share-generator-wiggly-line"
      width="180"
      height="10"
      viewBox="0 0 180 10"
      aria-hidden="true"
    >
      <path
        d="M0 6 Q8 1 16 6 Q24 9 32 6 Q40 1 48 6 Q56 9 64 6 Q72 1 80 6 Q88 9 96 6 Q104 1 112 6 Q120 9 128 6 Q136 1 144 6 Q152 9 160 6 Q168 1 176 6"
        stroke="#FF7043"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EmptyQRHint() {
  return (
    <div className="text-share-empty-qr" aria-label="先输入内容">
      <svg viewBox="0 0 280 280" className="text-share-empty-qr-svg" aria-hidden="true">
        <rect
          x="8"
          y="8"
          width="264"
          height="264"
          rx="4"
          fill="none"
          stroke="#C8BEA8"
          strokeWidth="2.5"
          strokeDasharray="10 7"
        />
        <rect
          x="28"
          y="28"
          width="38"
          height="38"
          rx="2"
          fill="none"
          stroke="#C8BEA8"
          strokeWidth="2"
        />
        <rect x="35" y="35" width="24" height="24" rx="1" fill="#E8DFC8" />
        <rect
          x="214"
          y="28"
          width="38"
          height="38"
          rx="2"
          fill="none"
          stroke="#C8BEA8"
          strokeWidth="2"
        />
        <rect x="221" y="35" width="24" height="24" rx="1" fill="#E8DFC8" />
        <rect
          x="28"
          y="214"
          width="38"
          height="38"
          rx="2"
          fill="none"
          stroke="#C8BEA8"
          strokeWidth="2"
        />
        <rect x="35" y="221" width="24" height="24" rx="1" fill="#E8DFC8" />
        <text
          x="140"
          y="154"
          textAnchor="middle"
          fill="#C8BEA8"
          fontSize="42"
          fontFamily="Caveat, cursive"
          fontWeight="700"
        >
          ?
        </text>
        <text
          x="140"
          y="184"
          textAnchor="middle"
          fill="#C8BEA8"
          fontSize="18"
          fontFamily="Caveat, cursive"
        >
          先输入内容
        </text>
      </svg>
    </div>
  );
}

export default function SharePage() {
  const [inputText, setInputText] = useState("");
  const [currentOrigin, setCurrentOrigin] = useState("");
  const { copy, copied } = useClipboard();
  const hasInput = inputText.trim().length > 0;
  const isUrl = hasInput && (inputText.startsWith("http://") || inputText.startsWith("https://"));

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

      <main className="text-share-generator-main">
        <section className="text-share-hero" aria-labelledby="share-title">
          <Sparkle x={-10} y={10} color="#FF7043" size={24} />
          <Sparkle x={340} y={-5} color="#42A5F5" size={18} />
          <Sparkle x={280} y={30} color="#FFDE59" size={14} />

          <p className="text-share-generator-subtitle">把你的文字 →</p>
          <h1 id="share-title" className="text-share-generator-heading">
            变成一个
            <br />
            <span>
              二维码
              <WigglyLine />
            </span>
          </h1>
        </section>

        <div className="text-share-generator-layout">
          <RoughCard seed={3} className="text-share-input-panel">
            <div className="text-share-input-panel-inner">
              <div className="text-share-generator-input-label">在这里写点什么</div>

              <textarea
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                className="text-share-generator-input"
                placeholder={"网址、一句话、一个秘密…\n什么都可以"}
                spellCheck={false}
              />

              <div className="text-share-generator-control-row">
                <span
                  className={`text-share-char-count ${inputText.length > 1000 ? "warning" : ""}`}
                >
                  {inputText.length} 字符
                </span>

                <div className="text-share-generator-action-row">
                  {hasInput && (
                    <span
                      className={`text-share-type-badge ${isUrl ? "text-share-type-badge-url" : "text-share-type-badge-text"} text-share-pop-in`}
                    >
                      {isUrl ? "URL" : "文本"}
                    </span>
                  )}
                  <div className="text-share-action-wrap">
                    {copied && <CopiedBubble />}
                    <RoughActionButton
                      fill={hasInput ? "#FF7043" : "#E8E0CC"}
                      seed={20}
                      disabled={!hasInput}
                      className="text-share-generator-button"
                      onClick={() => copy(shareUrl)}
                    >
                      <div className="text-share-generator-button-content">
                        <span>{copied ? "已复制!" : "生成并分享 →"}</span>
                      </div>
                    </RoughActionButton>
                  </div>
                </div>
              </div>
            </div>
          </RoughCard>

          <div className="text-share-qr-panel-wrap">
            <RoughCard seed={7} className="text-share-qr-panel text-share-float">
              <div className="text-share-qr-panel-inner">
                <span className="text-share-qr-title">实时预览</span>

                <div className="text-share-qr-preview-box text-share-pop-in">
                  {hasInput ? <QRCodeImg value={shareUrl} /> : <EmptyQRHint />}
                </div>

                <div className="text-share-qr-status-row">
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <circle
                      cx="6"
                      cy="6"
                      r="4"
                      fill={hasInput ? "#4CAF50" : "#C8BEA8"}
                      stroke="#1C1917"
                      strokeWidth="1.2"
                    />
                  </svg>
                  <span>{hasInput ? "已生成" : "等待输入…"}</span>
                </div>
              </div>
            </RoughCard>
          </div>
        </div>
      </main>
    </div>
  );
}
