"use client"
import { useEffect } from 'react'
import {registerWebMcp} from '../../web-mcp'
// Global scripts that run on every page
export default function GlobalScripts() {
  useEffect(() => {
    // 在这里添加每个页面都会运行的 JS 代码
    // 例如：性能监控、埋点、全局状态初始化等
    registerWebMcp()
    console.log('全局脚本执行')
  }, [])

  return null
}