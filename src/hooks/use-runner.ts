"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export interface Steppable {
  step(): unknown
  back(): boolean
  readonly done: boolean
  pc: number
  waitingInput?: boolean
}

export type Speed = "instant" | "fast" | "slow"
export const SPEED_RATE: Record<Speed, number> = { instant: Infinity, fast: 25, slow: 3 }
export const SPEED_LABEL: Record<Speed, string> = { instant: "ทันที", fast: "เร็ว (25/วินาที)", slow: "ช้า (3/วินาที)" }

export type PauseReason = "breakpoint" | "input" | "limit" | "user" | null

/** กันโปรแกรมที่วนไม่จบไม่ให้เบราว์เซอร์ค้าง */
const STEP_LIMIT = 2_000_000
const STEPS_PER_FRAME = 20_000

export function useRunner<M extends Steppable>(opts: {
  machine: M | null
  isBreakpoint: (pc: number) => boolean
  onChange: () => void
}) {
  const [running, setRunning] = useState(false)
  const [pause, setPause] = useState<PauseReason>(null)
  const [speed, setSpeed] = useState<Speed>("fast")
  const speedRef = useRef(speed)
  const raf = useRef<number | null>(null)
  const optsRef = useRef(opts)

  useEffect(() => {
    speedRef.current = speed
    optsRef.current = opts
  })

  const halt = useCallback((reason: PauseReason) => {
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    raf.current = null
    setRunning(false)
    setPause(reason)
  }, [])

  const run = useCallback(() => {
    const m = optsRef.current.machine
    if (!m || m.done || raf.current !== null) return
    setRunning(true)
    setPause(null)
    let last = performance.now()
    let acc = 0
    let executed = 0
    let first = true

    const tick = (now: number) => {
      const { machine, isBreakpoint, onChange } = optsRef.current
      const mm = machine
      if (!mm) return halt(null)
      const rate = SPEED_RATE[speedRef.current]
      let budget: number
      if (rate === Infinity) budget = STEPS_PER_FRAME
      else {
        acc += ((now - last) / 1000) * rate
        budget = Math.floor(acc)
        acc -= budget
        if (first) budget = Math.max(budget, 1) // ให้คำสั่งแรกทำทันทีที่กด ไม่ต้องรอรอบเวลา
      }
      last = now
      for (let i = 0; i < budget; i++) {
        if (mm.done) break
        // หยุดก่อนทำคำสั่งที่มี breakpoint (ยกเว้นคำสั่งแรกที่เพิ่งกดรันต่อจาก breakpoint นั้น)
        if (!first && isBreakpoint(mm.pc)) {
          onChange()
          return halt("breakpoint")
        }
        first = false
        mm.step()
        executed++
        if (mm.waitingInput) {
          onChange()
          return halt("input")
        }
        if (executed >= STEP_LIMIT) {
          onChange()
          return halt("limit")
        }
      }
      onChange()
      if (mm.done) return halt(null)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [halt])

  const stop = useCallback(() => halt("user"), [halt])

  const step = useCallback(() => {
    const m = optsRef.current.machine
    if (!m || m.done || raf.current !== null) return
    m.step()
    setPause(m.waitingInput ? "input" : null)
    optsRef.current.onChange()
  }, [])

  const back = useCallback(() => {
    const m = optsRef.current.machine
    if (!m || raf.current !== null) return
    m.back()
    setPause(null)
    optsRef.current.onChange()
  }, [])

  const clearPause = useCallback(() => halt(null), [halt])

  useEffect(() => () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current)
  }, [])

  return { running, pause, speed, setSpeed, run, stop, step, back, clearPause }
}
