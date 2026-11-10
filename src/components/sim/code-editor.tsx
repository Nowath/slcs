"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { AsmError } from "@/lib/format"
import { highlightLine, TOK_CLASS, type Lang } from "@/lib/highlight"

const LINE_H = 22 // px — ต้องตายตัวเพื่อให้ชั้นสีตรงกับบรรทัดใน textarea
const PAD_Y = 10

export function CodeEditor({
  lang,
  value,
  onChange,
  currentLine,
  errors,
  breakpoints,
  onToggleBreakpoint,
  ariaLabel,
}: {
  lang: Lang
  value: string
  onChange: (v: string) => void
  currentLine: number | null
  errors: AsmError[]
  breakpoints: Set<number>
  onToggleBreakpoint: (line: number) => void
  ariaLabel: string
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const escRef = useRef(false)
  const [scroll, setScroll] = useState({ top: 0, left: 0, height: 0 })
  const lines = useMemo(() => value.split("\n"), [value])
  const errorAt = new Map<number, AsmError>()
  for (const e of errors) if (!errorAt.has(e.line) || e.severity === "error") errorAt.set(e.line, e)

  // เลื่อนให้เห็นบรรทัดที่กำลังทำงานเสมอตอน step
  useEffect(() => {
    const ta = taRef.current
    if (!ta || currentLine === null) return
    const y = (currentLine - 1) * LINE_H
    if (y < ta.scrollTop + LINE_H || y > ta.scrollTop + ta.clientHeight - LINE_H * 2) {
      ta.scrollTop = Math.max(0, y - ta.clientHeight / 3)
    }
  }, [currentLine])

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    const ro = new ResizeObserver(() => setScroll((s) => ({ ...s, height: ta.clientHeight })))
    ro.observe(ta)
    return () => ro.disconnect()
  }, [])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab ใส่ช่องว่างจัดคอลัมน์ได้ แต่กด Esc ก่อนแล้ว Tab จะออกจากช่องตามปกติ (คนใช้คีย์บอร์ดไม่ติดกับ)
    if (e.key === "Escape") {
      escRef.current = true
      return
    }
    if (e.key === "Tab" && !escRef.current && !e.shiftKey) {
      e.preventDefault()
      const ta = e.currentTarget
      const { selectionStart: s, selectionEnd: en } = ta
      onChange(value.slice(0, s) + "\t" + value.slice(en))
      requestAnimationFrame(() => ta.setSelectionRange(s + 1, s + 1))
    }
    escRef.current = false
  }

  // วาดเฉพาะบรรทัดที่มองเห็น (+ กันชน) โปรแกรมยาวหลายร้อยบรรทัดก็ไม่หน่วง
  const first = Math.max(0, Math.floor(scroll.top / LINE_H) - 5)
  const last = Math.min(lines.length, Math.ceil((scroll.top + (scroll.height || 600)) / LINE_H) + 5)
  const visible = Array.from({ length: Math.max(0, last - first) }, (_, i) => first + i + 1)
  const rowStyle = (ln: number) => ({ top: (ln - 1) * LINE_H + PAD_Y, height: LINE_H, lineHeight: `${LINE_H}px` })

  return (
    // สูงตามจำนวนบรรทัด (+ เผื่อ 2 บรรทัดให้พิมพ์ต่อ) อย่างน้อย 10 บรรทัด ยาวกว่าเพดานค่อยเลื่อนในกล่อง
    <div
      className="relative max-h-[24rem] min-h-0 overflow-hidden rounded-md bg-code font-mono text-[13px] ring-1 ring-border xl:max-h-[34rem]"
      style={{ height: Math.max(10, lines.length + 2) * LINE_H + PAD_Y * 2 }}
    >
      {/* ชั้นหลัง: แถบไฮไลต์เต็มความกว้าง เลื่อนตามแนวตั้งอย่างเดียว */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ transform: `translateY(${-scroll.top}px)` }}>
        {visible.map((ln) => {
          const err = errorAt.get(ln)
          if (ln !== currentLine && !err) return null
          return (
            <div
              key={ln}
              className={cn(
                "absolute inset-x-0",
                ln === currentLine && "bg-pc-soft",
                err?.severity === "error" && "bg-destructive/10",
                err?.severity === "warning" && ln !== currentLine && "bg-syn-num/10"
              )}
              style={rowStyle(ln)}
            >
              {ln === currentLine && <span className="absolute inset-y-0 left-0 w-[3px] bg-pc" />}
            </div>
          )
        })}
      </div>

      {/* ชั้นตัวอักษรสี วางตรงตำแหน่งเดียวกับข้อความใน textarea ทุกพิกเซล */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 left-12 overflow-hidden">
        <div className="tab-8 whitespace-pre" style={{ transform: `translate(${-scroll.left}px, ${-scroll.top}px)` }}>
          {visible.map((ln) => (
            <div key={ln} className="absolute pl-3" style={rowStyle(ln)}>
              {highlightLine(lines[ln - 1] ?? "", lang).map((t, i) => (
                <span key={i} className={TOK_CLASS[t.kind]}>
                  {t.text}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div aria-hidden className="absolute inset-y-0 left-0 w-12 bg-muted/40" />
      <div className="absolute inset-y-0 left-0 w-12 overflow-hidden">
        <div style={{ transform: `translateY(${-scroll.top}px)` }}>
          {visible.map((ln) => {
            const err = errorAt.get(ln)
            const bp = breakpoints.has(ln)
            return (
              <button
                key={ln}
                type="button"
                tabIndex={-1}
                onClick={() => onToggleBreakpoint(ln)}
                title={err ? err.message : bp ? "เอา breakpoint ออก" : "ตั้ง breakpoint"}
                className={cn(
                  "group absolute inset-x-0 flex items-center justify-end pr-2.5 text-[11px] tabular-nums",
                  "text-muted-foreground/60 transition-colors duration-(--dur-fast) hover:text-foreground",
                  ln === currentLine && "font-semibold text-pc",
                  err?.severity === "error" && "text-destructive"
                )}
                style={rowStyle(ln)}
              >
                <span
                  className={cn(
                    "absolute left-1.5 size-2.5 rounded-full transition-colors duration-(--dur-fast)",
                    bp ? "bg-bp" : "bg-transparent group-hover:bg-bp/30"
                  )}
                />
                {ln}
              </button>
            )
          })}
        </div>
      </div>

      <textarea
        ref={taRef}
        aria-label={ariaLabel}
        value={value}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        wrap="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={(e) => {
          const t = e.currentTarget
          setScroll({ top: t.scrollTop, left: t.scrollLeft, height: t.clientHeight })
        }}
        className={cn(
          "tab-8 absolute inset-y-0 right-0 left-12 h-full resize-none bg-transparent pr-3 pl-3 whitespace-pre",
          // ตัวอักษรจริงโปร่งใส ให้ชั้นสีข้างล่างโชว์แทน แต่ cursor กับ selection ยังเป็นของ textarea
          "text-transparent caret-pc selection:bg-pc/25",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
        )}
        style={{ lineHeight: `${LINE_H}px`, paddingTop: PAD_Y, paddingBottom: PAD_Y }}
      />
    </div>
  )
}
