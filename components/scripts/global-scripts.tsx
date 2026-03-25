"use client"
import { useEffect } from 'react'
import {registerWebMcp} from '@/web-mcp'

let initialized = false

export default function GlobalScripts() {
  useEffect(() => {
    if (initialized) return
    initialized = true
    registerWebMcp()
  }, []);

  return null
}