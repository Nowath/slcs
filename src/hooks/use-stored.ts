"use client"

import { useEffect, useRef, useState } from "react"

/** state ที่จำไว้ใน localStorage (เช่นโค้ดที่พิมพ์ค้างไว้) — อ่านไม่ได้ก็ใช้ค่าเริ่มต้นตามปกติ */
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial)
  const loaded = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- อ่าน storage ได้หลัง hydrate เท่านั้น
      if (raw !== null) setValue(JSON.parse(raw) as T)
    } catch {}
    loaded.current = true
  }, [key])

  useEffect(() => {
    if (!loaded.current) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [key, value])

  return [value, setValue] as const
}
