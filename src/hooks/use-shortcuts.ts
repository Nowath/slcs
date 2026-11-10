"use client"

import { useEffect, useRef } from "react"

/** F8 รัน/หยุด · F10 ทีละคำสั่ง · Shift+F10 ย้อน · F9 เริ่มใหม่ — ทำงานเฉพาะแท็บที่เปิดอยู่ */
export function useShortcuts(
  active: boolean,
  h: { toggleRun: () => void; step: () => void; back: () => void; reset: () => void }
) {
  const ref = useRef(h)
  useEffect(() => {
    ref.current = h
  })
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, (() => void) | undefined> = {
        F8: ref.current.toggleRun,
        F10: e.shiftKey ? ref.current.back : ref.current.step,
        F9: ref.current.reset,
      }
      const fn = map[e.key]
      if (!fn) return
      e.preventDefault()
      fn()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [active])
}
