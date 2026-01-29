"use client"

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Sparkles, ArrowRight, Check, Link2, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

export default function BlueLinkPage() {
  const [displayText, setDisplayText] = useState('马年红包');
  const [scheme, setScheme] = useState('');
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);

  const generateResult = () => {
    if (!scheme.trim()) {
      toast.error('请输入 Scheme');
      return;
    }

    if (!scheme.startsWith('baidu')) {
      toast.error('Scheme 必须以 baidu 开头');
      return;
    }

    const obj = {
      scheme: scheme
    };

    const encodedData = encodeURIComponent(JSON.stringify(obj));
    const finalResult = `:ml-chat-function[${displayText}]{action='scheme' data='${encodedData}'}`;
    
    setResult(finalResult);
    toast.success('生成成功');
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
        setCopied(true);
        toast.success('已复制到剪贴板');
        setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] w-full flex flex-col items-center justify-center overflow-hidden bg-white dark:bg-black selection:bg-blue-500/30">
        <Toaster />
        
        {/* Subtle Grid Background instead of blobs for a cleaner look */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="w-full max-w-xl px-6 py-12 z-10"
        >
            {/* Minimal Header */}
            <div className="mb-12 text-left">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-600/10 rounded-lg">
                        <Link2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-semibold tracking-wide uppercase text-blue-600 dark:text-blue-400">
                        created by gemini 3 pro
                    </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
                    助手蓝链生成工具
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-lg">
                   将 Scheme 转换为可交互的聊天链接。
                </p>
            </div>

            {/* Inputs - Floating directly on page, no container card */}
            <div className="space-y-8">
                
                {/* Input Group 1 */}
                <div className="group">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 pl-1">
                        显示文本
                    </label>
                    <div className="relative transition-all duration-300 focus-within:scale-[1.01]">
                        <input
                            type="text"
                            value={displayText}
                            onChange={(e) => setDisplayText(e.target.value)}
                            className="block w-full rounded-2xl border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 px-5 py-5 text-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-slate-950 transition-all outline-none"
                            placeholder="输入显示文本..."
                        />
                        <Sparkles className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 dark:text-slate-600 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
                    </div>
                </div>

                {/* Input Group 2 */}
                <div className="group">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 pl-1">
                        Scheme 协议
                    </label>
                    <div className="relative transition-all duration-300 focus-within:scale-[1.01]">
                        <textarea
                            value={scheme}
                            onChange={(e) => setScheme(e.target.value)}
                            className="block w-full rounded-2xl border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 px-5 py-5 font-mono text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-slate-950 transition-all outline-none min-h-[140px] resize-none"
                            placeholder="baiduboxapp://..."
                            spellCheck={false}
                        />
                        <Terminal className="absolute right-5 top-5 w-5 h-5 text-slate-300 dark:text-slate-600 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
                    </div>
                </div>

                {/* Action - Full width pill */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={generateResult}
                    className="w-full flex items-center justify-between bg-zinc-900 dark:bg-white text-white dark:text-black rounded-full px-2 pl-8 py-2 font-medium text-lg hover:shadow-2xl hover:shadow-zinc-900/20 dark:hover:shadow-white/10 transition-all duration-300"
                >
                    生成链接
                    <span className="bg-white/20 dark:bg-black/10 rounded-full w-12 h-12 flex items-center justify-center ml-4">
                        <ArrowRight className="w-5 h-5" />
                    </span>
                </motion.button>
            </div>

            {/* Result Area - Only appears when needed, minimalist reveal */}
            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.4 }}
                        className="mt-12"
                    >
                        <div 
                            onClick={copyToClipboard}
                            className="group cursor-pointer"
                        >
                            <div className="flex items-center justify-between mb-2 px-1">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">生成结果</span>
                                <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    {copied ? '已复制' : '点击复制'}
                                </span>
                            </div>
                            
                            <div className="relative rounded-xl bg-slate-100 dark:bg-zinc-900/50 p-6 border-l-4 border-blue-500 hover:bg-blue-50 dark:hover:bg-zinc-800 transition-colors duration-300">
                                <code className="font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200 break-all">
                                    {result}
                                </code>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    </div>
  );
}
