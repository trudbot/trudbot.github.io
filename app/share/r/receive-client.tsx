"use client"
import { useState, useEffect, useMemo } from 'react'
import LZString from 'lz-string'

// Custom hook for clipboard
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

export default function ReceiveClient() {
  const [receivedContent, setReceivedContent] = useState('')
  const [isUrl, setIsUrl] = useState(false)
  const [currentOrigin, setCurrentOrigin] = useState('')
  const { copy, copied } = useClipboard()

  const content = useMemo(() => {
    if (typeof window === 'undefined') return ''

    const searchParams = new URLSearchParams(window.location.search)
    const compressed = searchParams.get('compressed')
    if (compressed) return LZString.decompressFromEncodedURIComponent(compressed) || ''
    return searchParams.get('content') || ''
  }, [])

  useEffect(() => {
    setCurrentOrigin(window.location.origin + window.location.pathname.replace('/r', ''))

    if (content) {
      setReceivedContent(content)

      try {
        new URL(content)
        setIsUrl(true)
      } catch {
        setIsUrl(false)
      }
    }
  }, [content])

  const openInNewTab = () => {
    if (isUrl && receivedContent) {
      window.open(receivedContent, '_blank')
    }
  }

  const goToShare = () => {
    window.location.href = currentOrigin || '/share'
  }

  // Show content as soon as it's available (even before hydration complete)
  if (!receivedContent) {
    return (
      <main className="text-share-container">
        <div className="text-share-card">
          <div className="text-share-header">
            <h2 className="text-share-title">📦 收到的内容</h2>
          </div>
          <div className="text-share-section">
            <div className="text-share-empty">
              <p>未找到分享内容</p>
              <button className="text-share-btn outline" onClick={goToShare}>
                去分享
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="text-share-container">
      <div className="text-share-card">
        {/* Header */}
        <div className="text-share-header">
          <h2 className="text-share-title">📦 收到分享内容</h2>
          <button className="text-share-btn-text" onClick={goToShare}>
            ← 去分享
          </button>
        </div>

        {/* Receiver Mode - Content visible immediately */}
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
            {isUrl && (
              <button className="text-share-btn outline" onClick={openInNewTab}>
                打开链接
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
