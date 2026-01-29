"use client"
import { useState, useMemo, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'

// Custom hook for window size to replace useWindowSize
function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    function updateSize() {
      setSize({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', updateSize)
    updateSize()
    return () => window.removeEventListener('resize', updateSize)
  }, [])
  return size
}

// Custom hook for clipboard to replace useClipboard
function useClipboard() {
  const [copied, setCopied] = useState(false)
  
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const copy = async (text: string) => {
    try {
      if (navigator?.clipboard) {
        await navigator.clipboard.writeText(text)
        setCopied(true)
      } else {
        // Fallback
        const textarea = document.createElement('textarea')
        textarea.value = text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        setCopied(true)
      }
    } catch (e) {
      console.error('Failed to copy', e)
    }
  }

  return { copy, copied }
}

export default function TextSharePage() {
  const [inputText, setInputText] = useState('')
  const [isReceiverMode, setIsReceiverMode] = useState(false)
  const [receivedContent, setReceivedContent] = useState('')
  const [currentOrigin, setCurrentOrigin] = useState('')
  
  const { width } = useWindowSize()
  const { copy, copied } = useClipboard()

  const qrSize = useMemo(() => {
    const len = inputText.length
    let size = 200
    if (len > 800) size = 320
    else if (len > 400) size = 280
    else if (len > 150) size = 240
    
    // Server-side rendering safe-guard
    if (width === 0) return size 
    
    // Responsive constraint
    const maxScreenSize = Math.min(width - 60, 400)
    return Math.min(size, maxScreenSize)
  }, [inputText.length, width])

  const shareUrl = useMemo(() => {
    if (!inputText) return ''
    return `${currentOrigin}#share=${encodeURIComponent(inputText)}`
  }, [inputText, currentOrigin])

  // Initial check and hash change listener
  useEffect(() => {
    setCurrentOrigin(window.location.origin + window.location.pathname)

    const checkHash = () => {
      const hash = window.location.hash
      if (hash.startsWith('#share=')) {
        try {
          const content = decodeURIComponent(hash.substring(7))
          if (content) {
            setReceivedContent(content)
            setIsReceiverMode(true)
          }
        } catch (e) {
          console.error('Failed to decode content', e)
        }
      }
    }

    checkHash()
    window.addEventListener('hashchange', checkHash)
    return () => window.removeEventListener('hashchange', checkHash)
  }, [])

  const reset = () => {
    setIsReceiverMode(false)
    setReceivedContent('')
    setInputText('')
    if (typeof window !== 'undefined') {
      history.pushState("", document.title, window.location.pathname + window.location.search)
    }
  }

  const isUrl = (text: string) => {
    try {
      new URL(text)
      return true
    } catch {
      return false
    }
  }

  const openInNewTab = () => {
    if (isUrl(receivedContent)) {
      window.open(receivedContent, '_blank')
    }
  }

  return (
    <main className="text-share-container">
      <div className="text-share-card">
        {/* Header */}
        <div className="text-share-header">
          <h2 className="text-share-title">
            {isReceiverMode ? '📦 收到分享内容' : '🔗 文本/链接分享'}
          </h2>
          {isReceiverMode && (
            <button className="text-share-btn-text" onClick={reset}>
              ← 返回生成
            </button>
          )}
        </div>

        {/* Receiver Mode */}
        {isReceiverMode ? (
          <div className="text-share-section fade-in">
            <div className="text-share-result-box">
              <div className="text-share-content">{receivedContent}</div>
            </div>
            <div className="text-share-actions">
              <button 
                className={`text-share-btn primary ${copied ? 'success' : ''}`}
                onClick={() => copy(receivedContent)}
              >
                {copied ? '✅ 已复制' : '复制内容'}
              </button>
              {isUrl(receivedContent) && (
                <button className="text-share-btn outline" onClick={openInNewTab}>
                  打开链接
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Generator Mode */
          <div className="text-share-section fade-in">
            <div className="text-share-input-wrapper">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="text-share-input-area"
                placeholder="在此输入要分享的文本或长链接..."
                rows={5}
              ></textarea>
              <div className={`text-share-char-count ${inputText.length > 1000 ? 'warning' : ''}`}>
                {inputText.length} 字符
              </div>
            </div>

            {inputText ? (
              <div className="text-share-preview">
                <div className="text-share-qr-card">
                  <QRCodeSVG
                    value={shareUrl}
                    size={qrSize}
                    level="L"
                    className="text-share-qrcode"
                  />
                  <p className="text-share-hint">手机扫码查看</p>
                </div>
      
                <div className="text-share-actions">
                  <button 
                    className={`text-share-btn outline full-width ${copied ? 'success' : ''}`}
                    onClick={() => copy(shareUrl)}
                  >
                    {copied ? '✅ 链接已复制' : '复制分享链接'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-share-empty">
                <p>输入内容后自动生成二维码</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
