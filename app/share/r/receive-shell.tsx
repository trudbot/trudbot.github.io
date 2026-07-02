import { getOpenableUrl } from "../receive-params";

type ReceiveShellProps = {
  content: string;
  copied?: boolean;
  onCopy?: () => void;
  onOpen?: () => void;
  onGoToShare?: () => void;
  interactive?: boolean;
};

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

function TopBar() {
  return (
    <header className="text-share-topbar">
      <div className="text-share-topbar-inner">
        <a href="/share" className="text-share-brand" aria-label="文本分享首页">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
            <path
              d="M1.5 3 Q2 1.5 3.5 1.5 L26.5 1.5 Q28.5 1.5 28.5 3.5 L28.5 26.5 Q28.5 28.5 26 28.5 L3.5 28.5 Q1.5 28.5 1.5 26.5 Z"
              fill="#FFDE59"
              stroke="#1C1917"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <rect x="4" y="4" width="8" height="8" rx="1" fill="#1C1917" />
            <rect x="5.5" y="5.5" width="5" height="5" rx="0.5" fill="#FFDE59" />
            <rect x="18" y="4" width="8" height="8" rx="1" fill="#1C1917" />
            <rect x="19.5" y="5.5" width="5" height="5" rx="0.5" fill="#FFDE59" />
            <rect x="4" y="18" width="8" height="8" rx="1" fill="#1C1917" />
            <rect x="5.5" y="19.5" width="5" height="5" rx="0.5" fill="#FFDE59" />
            <rect x="18" y="18" width="3" height="3" rx="0.5" fill="#1C1917" />
            <rect x="22" y="18" width="3" height="3" rx="0.5" fill="#1C1917" />
            <rect x="25" y="21" width="3" height="3" rx="0.5" fill="#1C1917" />
            <rect x="18" y="22" width="3" height="3" rx="0.5" fill="#1C1917" />
            <rect x="22" y="25" width="3" height="3" rx="0.5" fill="#1C1917" />
          </svg>
          <span>TextDoodle</span>
        </a>
        <nav className="text-share-nav" aria-label="分享页面导航">
          <a href="/share" className="text-share-nav-link" style={{ opacity: 0.45 }}>
            生成
          </a>
          <span className="text-share-nav-separator">/</span>
          <a href="/share/r" className="text-share-nav-link" style={{ opacity: 1 }}>
            展示
            <svg
              className="text-share-wiggly-underline"
              height="6"
              viewBox="0 0 80 6"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M0 4.5 Q5 1 10 3.5 Q15 6 20 3.5 Q25 1 30 3.5 Q35 6 40 3.5 Q45 1 50 3.5 Q55 6 60 3.5 Q65 1 70 3.5 Q75 6 80 3.5"
                stroke="#4CAF50"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </a>
        </nav>
        <div className="text-share-step-indicator" aria-hidden="true">
          <span style={{ color: "#4CAF50" }}>02</span>
          <span className="text-share-step-divider"> / </span>
          <span>02</span>
        </div>
      </div>
    </header>
  );
}

function Sparkle({
  x = 0,
  y = 0,
  color = "#FF7043",
  size = 20,
}: {
  x?: number;
  y?: number;
  color?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className="text-share-sparkle"
      style={{ left: x, top: y }}
      aria-hidden="true"
    >
      <path
        d="M10 1 L11.2 8.5 L18 7 L12.5 11 L17 17 L10 13.5 L3 17 L7.5 11 L2 7 L8.8 8.5 Z"
        stroke={color}
        strokeWidth="1.2"
        fill={color}
        fillOpacity="0.3"
      />
    </svg>
  );
}

function ScribbleDivider() {
  return (
    <svg
      className="text-share-scribble-divider"
      width="100%"
      height="12"
      viewBox="0 0 400 12"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 8 Q25 2 50 7 Q75 12 100 7 Q125 2 150 7 Q175 12 200 7 Q225 2 250 7 Q275 12 300 7 Q325 2 350 7 Q375 12 400 7"
        stroke="#E8DFC8"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ReceiveShell({
  content,
  copied = false,
  onCopy,
  onOpen,
  onGoToShare,
  interactive = false,
}: ReceiveShellProps) {
  const openableUrl = getOpenableUrl(content);
  const hasContent = Boolean(content);

  return (
    <div className="text-share-page" data-share-receive-shell>
      <TopBar />

      <main className="text-share-main">
        <section className="text-share-hero" aria-labelledby="receive-title">
          <span data-share-status-sparkle>
            <Sparkle x={-8} y={8} color={hasContent ? "#4CAF50" : "#FF7043"} size={22} />
          </span>
          <Sparkle x={300} y={0} color="#42A5F5" size={16} />

          <div className="text-share-kicker-row">
            <span
              className={`text-share-badge ${hasContent ? "text-share-badge-green" : "text-share-badge-orange"}`}
              data-share-status-badge
            >
              {hasContent ? "扫码成功" : "未找到内容"}
            </span>
            <span className="text-share-date" data-share-status-note>
              {hasContent ? "分享内容已就绪" : "分享链接里没有可展示的文本"}
            </span>
          </div>

          <h1 id="receive-title" className="text-share-heading" data-share-title>
            {hasContent ? "收到" : "空空"}
            <br />
            {hasContent ? "内容" : "如也"}
          </h1>
        </section>

        <div className="text-share-rough-card text-share-css-rough-card">
          <div className="text-share-rough-content">
            <div className="text-share-card-inner">
              <div className="text-share-empty" data-share-empty hidden={hasContent}>
                <span className="text-share-empty-mark">?</span>
                <p>回到生成页，写一段内容再试试。</p>
              </div>

              <div
                className="text-share-result-content text-share-prehydrated-content"
                data-share-result
                hidden={!hasContent}
              >
                <span className="text-share-quote-mark" aria-hidden="true">
                  &quot;
                </span>
                <p className="text-share-content" data-share-content>
                  {content}
                </p>
              </div>

              <div data-share-link-row hidden={!openableUrl}>
                <ScribbleDivider />
                <div className="text-share-source-row">
                  <span className="text-share-badge text-share-badge-blue">链接</span>
                  <span className="text-share-source-text" data-share-source>
                    {openableUrl}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {interactive && (
          <>
            <div className="text-share-actions">
              <div className="text-share-action-wrap">
                {copied && (
                  <div className="text-share-copied-bubble text-share-pop-in" aria-live="polite">
                    <svg width="80" height="34" viewBox="0 0 80 34" aria-hidden="true">
                      <path
                        d="M4 2 Q3 1 5 1 L75 1 Q79 1 79 5 L79 24 Q79 28 75 28 L44 28 L40 33 L36 28 L5 28 Q1 28 1 24 L1 5 Q1 1 4 2 Z"
                        fill="#4CAF50"
                        stroke="#1C1917"
                        strokeWidth="1.8"
                      />
                      <text
                        x="40"
                        y="18"
                        textAnchor="middle"
                        fill="#FFFDF5"
                        fontSize="13"
                        fontFamily="Caveat, cursive"
                        fontWeight="700"
                      >
                        已复制!
                      </text>
                    </svg>
                  </div>
                )}
                <button
                  type="button"
                  className="text-share-css-rough-button text-share-css-rough-button-yellow"
                  onClick={onCopy}
                >
                  <div className="text-share-action-content">
                    <CopyIcon />
                    <div>
                      <div className="text-share-action-title">
                        {copied ? "内容已复制" : "复制文本"}
                      </div>
                      <div className="text-share-action-subtitle">复制全部内容</div>
                    </div>
                  </div>
                </button>
              </div>

              {openableUrl && (
                <button
                  type="button"
                  className="text-share-css-rough-button text-share-css-rough-button-green"
                  onClick={onOpen}
                >
                  <div className="text-share-action-content">
                    <OpenIcon />
                    <div>
                      <div className="text-share-action-title">打开链接</div>
                      <div className="text-share-action-subtitle">在浏览器中跳转</div>
                    </div>
                  </div>
                </button>
              )}
            </div>

            <button type="button" className="text-share-back-button" onClick={onGoToShare}>
              <BackArrowIcon />
              返回生成新码
            </button>
          </>
        )}
      </main>
    </div>
  );
}
