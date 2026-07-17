import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { parseUrl, type UrlParameter } from "./url-parser";

const MONOSPACE_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("已复制");
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("复制失败，请手动选择文本");
    }
  }

  return (
    <button
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
    >
      {copied ? (
        <Check className="w-4 h-4" aria-hidden="true" />
      ) : (
        <Copy className="w-4 h-4" aria-hidden="true" />
      )}
    </button>
  );
}

function ValueBlock({
  label,
  value,
  tone = "raw",
}: {
  label: string;
  value: string;
  tone?: "raw" | "decoded";
}) {
  return (
    <div
      className={`rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-4 ${tone === "decoded" ? "border-l-3 border-primary" : ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{label}</span>
        <CopyButton value={value} label={`复制${label}`} />
      </div>
      <code className="block font-mono text-sm break-all text-zinc-700 dark:text-zinc-300 leading-relaxed">
        {value || <span className="text-zinc-400 italic">空字符串</span>}
      </code>
    </div>
  );
}

function ParameterRow({ parameter, index }: { parameter: UrlParameter; index: number }) {
  return (
    <motion.article
      className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, delay: Math.min(index * 0.055, 0.35) }}
    >
      <header className="flex items-baseline gap-3 flex-wrap">
        <span className="text-xs text-zinc-400 font-mono tabular-nums" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
          {parameter.key || "未命名参数"}
        </h3>
        {parameter.rawKey !== parameter.key && (
          <code className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono">
            {parameter.rawKey}
          </code>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ValueBlock label="RAW" value={parameter.rawValue} />
        {parameter.decodedValue !== undefined && (
          <ValueBlock label="DECODED" value={parameter.decodedValue} tone="decoded" />
        )}
      </div>

      {parameter.formattedJson && (
        <div className="rounded-lg bg-zinc-900 dark:bg-zinc-950 text-zinc-100 mt-3 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-700/50">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              JSON / FORMATTED
            </span>
            <CopyButton value={parameter.formattedJson} label="复制格式化 JSON" />
          </div>
          <pre
            className="text-[15px] p-4 overflow-auto max-h-64 leading-6 tab-size-2"
            style={{ fontFamily: MONOSPACE_FONT }}
          >
            {parameter.formattedJson}
          </pre>
        </div>
      )}
    </motion.article>
  );
}

export default function UrlPage() {
  const [input, setInput] = useState("");
  const analysis = useMemo(() => {
    if (!input.trim()) return { result: null, error: null };

    try {
      return { result: parseUrl(input), error: null };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : "无法解析这个 URL" };
    }
  }, [input]);
  const active = analysis.result !== null;

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 selection:bg-primary/20">
      <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-12 sm:pt-16 pb-16">
        <AnimatePresence initial={false}>
          {!active && (
            <motion.header
              className="mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-4"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12, height: 0, marginBottom: 0, paddingBottom: 0 }}
              transition={{ duration: 0.28, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                URL 解析器
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                查看并解码查询参数，自动格式化其中的 JSON。
              </p>
            </motion.header>
          )}
        </AnimatePresence>

        {/* Input area */}
        <motion.div className="relative" layout transition={{ duration: 0.28, ease: "easeInOut" }}>
          <label className="flex items-center gap-2 mb-2" htmlFor="url-input">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">输入 URL</span>
            {active && (
              <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                {analysis.result!.parameters.length} 个参数
              </span>
            )}
          </label>
          <div className="relative">
            <textarea
              id="url-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="https://example.com/search?q=hello&payload=%7B%22page%22%3A1%7D"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              wrap="off"
              rows={active ? 1 : 4}
              className="[&::-webkit-scrollbar]:hidden block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3.5 pr-12 text-base leading-6 whitespace-pre overflow-x-auto overflow-y-hidden text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-primary focus:ring-3 focus:ring-primary/10 transition-[height,border-color,box-shadow] duration-300 ease-in-out outline-none resize-none"
              style={{ fontFamily: MONOSPACE_FONT, scrollbarWidth: "none" }}
              aria-describedby={analysis.error ? "url-error" : undefined}
            />
            {input && (
              <button
                className="absolute top-4 right-4 inline-flex items-center justify-center w-8 h-8 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                type="button"
                onClick={() => setInput("")}
                aria-label="清空 URL"
                title="清空"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <AnimatePresence>
            {analysis.error && (
              <motion.p
                id="url-error"
                className="text-sm text-red-500 font-medium mt-2 flex items-center gap-2"
                role="alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 text-xs">
                  !
                </span>
                {analysis.error}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {analysis.result && (
            <motion.section
              className="mt-10 space-y-6"
              key={analysis.result.origin}
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.42, delay: 0.08 }}
              aria-live="polite"
            >
              {/* Origin */}
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Origin
                  </span>
                  <CopyButton value={analysis.result.origin} label="复制 origin" />
                </div>
                <code className="block font-mono text-base font-semibold break-all text-zinc-800 dark:text-zinc-200">
                  {analysis.result.origin}
                </code>
              </div>

              {/* Parameters heading */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">查询参数</h2>
                <span className="text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {analysis.result.parameters.length}
                </span>
              </div>

              {/* Parameter list */}
              {analysis.result.parameters.length > 0 ? (
                <div className="space-y-4">
                  {analysis.result.parameters.map((parameter, index) => (
                    <ParameterRow
                      parameter={parameter}
                      index={index}
                      key={`${parameter.rawKey}-${index}`}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-sm text-zinc-500 dark:text-zinc-400">
                  这个 URL 没有查询参数。
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}
