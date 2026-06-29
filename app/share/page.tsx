import './styles.css'
import { useState, useMemo, useEffect } from 'react'
import LZString from 'lz-string'
import qrcode from 'qrcode-generator'

const COMPRESSION_MIN_LENGTH = 200

// Custom hook for window size
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

// Lightweight QR Image component
function QRCodeImg({ value, size }: { value: string; size: number }) {
  const qrSvg = useMemo(() => {
    try {
      const qr = qrcode(0, 'L')
      qr.addData(value)
      qr.make()
      return qr.createSvgTag({ cellSize: 6, margin: 2 })
    } catch {
      return ''
    }
  }, [value])

  return (
    <div className="text-share-qr-card">
      {qrSvg ? (
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`}
          alt="QR Code"
          width={size}
          height={size}
          className="text-share-qrcode"
        />
      ) : (
        <div className="text-share-qr-error">生成失败</div>
      )}
      {qrSvg && <p className="text-share-hint">手机扫码查看</p>}
    </div>
  )
}

export default function SharePage() {
  const [inputText, setInputText] = useState('')
  const [currentOrigin, setCurrentOrigin] = useState('')

  const { width } = useWindowSize()
  const { copy, copied } = useClipboard()

  const qrSize = useMemo(() => {
    const len = inputText.length
    let size = 200
    if (len > 800) size = 320
    else if (len > 400) size = 280
    else if (len > 150) size = 240

    if (width === 0) return size

    const maxScreenSize = Math.min(width - 60, 400)
    return Math.min(size, maxScreenSize)
  }, [inputText.length, width])

  const shareUrl = useMemo(() => {
    if (!inputText) return ''

    const encoded = encodeURIComponent(inputText)
    if (inputText.length < COMPRESSION_MIN_LENGTH) {
      return `${currentOrigin}/r?content=${encoded}`
    }

    const compressed = LZString.compressToEncodedURIComponent(inputText)
    if (compressed.length >= encoded.length) {
      return `${currentOrigin}/r?content=${encoded}`
    }
    return `${currentOrigin}/r?compressed=${compressed}`
  }, [inputText, currentOrigin])

  useEffect(() => {
    setCurrentOrigin(window.location.origin + window.location.pathname)
  }, [])

  return (
    <main className="text-share-container">
      <div className="text-share-card">
        <div className="text-share-header">
          <h2 className="text-share-title">🔗 文本/链接分享</h2>
        </div>

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
              <QRCodeImg value={shareUrl} size={qrSize} />

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
      </div>
    </main>
  )
}
