"use client"

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'

const ReactJson = dynamic(() => import('react-json-view'), { ssr: false })

export default function JsonFormatPage() {
  const [iv, setIv] = useState('{"text":"abc"}')
  const [showInput, setShowInput] = useState(true)
  const [showOutput, setShowOutput] = useState(true)

  const jsonObj = useMemo(() => {
    try {
      return JSON.parse(iv)
    } catch (e) {
      return { error: '解析错误: 请检查 JSON 格式' }
    }
  }, [iv])

  const toggleInput = () => setShowOutput(!showOutput)
  const toggleOutput = () => setShowInput(!showInput)

  return (
    <div className={`json-format-lab ${!showInput || !showOutput ? 'single-mode' : ''}`}>
      <AnimatePresence mode="popLayout">
        {showInput && (
          <motion.div 
            className="json-input"
            key="input"
            initial={{ opacity: 0, x: -50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -50, scale: 0.95 }}
            transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
            layout
          >
            <h3 onClick={toggleInput} title="点击切换右侧视图显示">JSON 输入</h3>
            <textarea 
              value={iv} 
              onChange={(e) => setIv(e.target.value)}
              placeholder="请输入 JSON 数据..."
              spellCheck={false}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence mode="popLayout">
        {showOutput && (
          <motion.div 
            className="json-format-view"
            key="output"
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
            layout
          >
            <h3 onClick={toggleOutput} title="点击切换左侧输入显示">格式化视图</h3>
            <div className="json-view-container">
              <ReactJson 
                src={jsonObj} 
                name={false} 
                displayDataTypes={false}
                enableClipboard={true}
                displayObjectSize={true}
                collapsed={false}
                theme="rjv-default"
                style={{ backgroundColor: 'transparent' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
