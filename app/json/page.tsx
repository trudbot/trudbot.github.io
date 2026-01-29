"use client"

import { useState, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Trash2, FileJson, Columns, PanelLeft, PanelRight } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

const ReactJson = dynamic(() => import('react-json-view'), { ssr: false })

export default function JsonFormatPage() {
  const [iv, setIv] = useState('{"text":"hello world","features":["json","format","modern"]}')
  const [layout, setLayout] = useState<'split' | 'input' | 'output'>('split')
  const [mounted, setMounted] = useState(false)
  const [jsonTheme, setJsonTheme] = useState('rjv-default')

  useEffect(() => {
    setMounted(true)
    // Simple check for dark mode to set theme
    const isDark = document.documentElement.classList.contains('dark')
    setJsonTheme(isDark ? 'monokai' : 'rjv-default')
  }, [])

  const jsonObj = useMemo(() => {
    try {
      return JSON.parse(iv)
    } catch (e) {
      return null
    }
  }, [iv])

  const handleCopy = () => {
    if (!jsonObj) {
        toast.error('无效的 JSON，无法复制')
        return
    }
    navigator.clipboard.writeText(JSON.stringify(jsonObj, null, 2))
    toast.success('已格式化并复制到剪贴板')
  }

  const handleClear = () => {
      setIv('')
      toast('内容已清空')
  }

  return (
    <div className="relative min-h-[calc(100vh-64px)] w-full bg-stone-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-500/20">
        <Toaster />
        
        <div className="relative z-10 flex flex-col h-[calc(100vh-64px)] p-4 md:p-6 gap-6">
            
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between px-2 py-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600/10 rounded-xl">
                        <FileJson className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">JSON 实验室</h1>
                        <span className="text-xs text-slate-500 font-medium">Validation & Formatting</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Layout Toggles - Desktop Only */}
                    <div className="hidden md:flex items-center p-1 bg-stone-200/50 dark:bg-zinc-800/50 rounded-lg mr-4">
                        <button 
                            onClick={() => setLayout('input')}
                            className={`p-2 rounded-md transition-all ${layout === 'input' ? 'bg-white dark:bg-zinc-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            title="仅输入"
                        >
                            <PanelLeft className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setLayout('split')}
                            className={`p-2 rounded-md transition-all ${layout === 'split' ? 'bg-white dark:bg-zinc-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            title="分栏"
                        >
                            <Columns className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setLayout('output')}
                            className={`p-2 rounded-md transition-all ${layout === 'output' ? 'bg-white dark:bg-zinc-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            title="仅结果"
                        >
                            <PanelRight className="w-4 h-4" />
                        </button>
                    </div>

                    <button 
                        onClick={handleClear}
                        className="p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-500 transition-colors"
                        title="清空"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-black rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-slate-900/10"
                    >
                        <Copy className="w-4 h-4" />
                        <span className="hidden sm:inline">复制结果</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
                <AnimatePresence mode="popLayout" initial={false}>
                    {/* Input Panel */}
                    {(layout === 'split' || layout === 'input') && (
                        <motion.div 
                            key="input-panel"
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className={`flex flex-col h-full overflow-hidden ${layout === 'split' ? 'w-full md:w-1/2' : 'w-full'}`}
                        >
                            <div className="flex-1 relative">
                                <textarea 
                                    value={iv} 
                                    onChange={(e) => setIv(e.target.value)}
                                    placeholder="在此输入或粘贴 JSON..."
                                    spellCheck={false}
                                    className="w-full h-full p-6 bg-transparent resize-none focus:outline-none font-mono text-base leading-relaxed text-slate-700 dark:text-slate-300"
                                />
                                <div className="absolute bottom-4 right-6 text-xs font-mono text-slate-400 pointer-events-none px-2 py-1 rounded opacity-50">
                                    Input
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Output Panel */}
                    {(layout === 'split' || layout === 'output') && (
                        <motion.div 
                            key="output-panel"
                            layout
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className={`flex flex-col h-full overflow-hidden ${layout === 'split' ? 'w-full md:w-1/2' : 'w-full'}`}
                        >
                            <div className="flex-1 relative overflow-auto p-6 scrollbar-thin scrollbar-thumb-stone-200 dark:scrollbar-thumb-zinc-700">
                                {mounted && jsonObj ? (
                                    <ReactJson 
                                        src={jsonObj} 
                                        name={false} 
                                        displayDataTypes={false}
                                        enableClipboard={true}
                                        displayObjectSize={true}
                                        collapsed={false}
                                        theme={jsonTheme}
                                        style={{ backgroundColor: 'transparent', fontSize: '15px', fontFamily: 'monospace' }}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <div className="p-4 rounded-full bg-stone-100 dark:bg-zinc-800 mb-4 opacity-50">
                                            <FileJson className="w-8 h-8" />
                                        </div>
                                        <p className="text-sm font-medium">{iv.trim() ? 'JSON 格式错误' : '等待输入...'}</p>
                                    </div>
                                )}
                                <div className="absolute bottom-4 right-6 text-xs font-mono text-slate-400 pointer-events-none px-2 py-1 rounded z-10 opacity-50">
                                    Preview
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    </div>
  )
}
