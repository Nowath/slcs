"use client"

import { Info, Minus, Plus } from "lucide-react"
import { useEffect, useRef } from "react"
import { CodeEditor, FONT_MAX, FONT_MIN } from "@/components/sim/code-editor"
import { ErrorList } from "@/components/sim/parts"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AsmError } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * แถบควบคุมที่ติดใต้ header ตอนเลื่อน (จอ lg ขึ้นไป — มือถือแถบนี้สูงหลายชั้น ติดจอแล้วกินพื้นที่ครึ่งจอ)
 * ความสูงไม่ตายตัว (จอ 1024 แถบ Stack ขึ้นสองแถว) จึงวัดจริงแล้วส่งเป็น --toolbar-h ให้ editor ที่ sticky ต่อจากมัน
 */
export function StickyToolbar({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const h = e.borderBoxSize[0]?.blockSize ?? el.offsetHeight
      // แท็บเครื่องที่ซ่อนอยู่สูง 0 — อย่าให้ทับค่าของแท็บที่เปิดอยู่
      if (h > 0) document.documentElement.style.setProperty("--toolbar-h", `${h}px`)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    // -my-2 py-2 + พื้นหลัง: บังเนื้อหาที่เลื่อนผ่านใต้มุมโค้งของการ์ด โดย layout ไม่ขยับ
    <div ref={ref} className="lg:sticky lg:top-(--header-h) lg:z-10 lg:-my-2 lg:bg-background lg:py-2">
      {children}
    </div>
  )
}

/** ฝั่งซ้ายของ workbench — editor + รายการ error ใช้ร่วมกันทั้ง Stack และ LC3 */
export function CodePanel({
  title,
  fontSize,
  onFontSize,
  errors,
  note,
  ...editor
}: React.ComponentProps<typeof CodeEditor> & {
  title: string
  /** หมายเหตุวิธีเขียนที่มักพลาด โชว์ใต้ editor ตลอด */
  note?: React.ReactNode
  fontSize: number
  onFontSize: (n: number) => void
  errors: AsmError[]
}) {
  return (
    // sticky: แผงขวายาวกว่าเมื่อไหร่ เลื่อนลงไปดูแล้ว editor ยังอยู่ในจอ เห็นบรรทัดที่กำลังทำงานตลอด
    <section className="flex min-w-0 flex-col rounded-lg border bg-card lg:sticky lg:top-[calc(var(--header-h)+var(--toolbar-h)+0.5rem)]">
      <header className="flex min-h-11 items-center justify-between gap-2 px-4 pt-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">คลิกเลขบรรทัด = breakpoint</span>
          <FontSizeControl value={fontSize} onChange={onFontSize} />
        </div>
      </header>
      <div className="flex flex-col gap-2 px-4 pt-2 pb-4">
        <CodeEditor {...editor} errors={errors} fontSize={fontSize} onFontSize={onFontSize} />
        <ErrorList errors={errors} />
        {note && (
          <div className="flex gap-2 rounded-md bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <div className="min-w-0">{note}</div>
          </div>
        )}
      </div>
    </section>
  )
}

function FontSizeControl({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const step = (d: number) => onChange(Math.min(FONT_MAX, Math.max(FONT_MIN, value + d)))
  return (
    <div role="group" aria-label="ขนาดตัวอักษรในโค้ด" className="flex items-center rounded-md border">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="ตัวอักษรเล็กลง" disabled={value <= FONT_MIN} onClick={() => step(-1)}>
              <Minus />
            </Button>
          }
        />
        <TooltipContent>
          เล็กลง<kbd className="ml-2 font-mono opacity-70">Ctrl −</kbd>
        </TooltipContent>
      </Tooltip>
      {/* กดตัวเลข = กลับขนาดเริ่มต้น */}
      <button
        type="button"
        onClick={() => onChange(13)}
        title="กลับขนาดเริ่มต้น (13px)"
        aria-live="polite"
        className={cn(
          "h-7 min-w-8 rounded-sm px-1 font-mono text-xs tabular-nums text-muted-foreground",
          "transition-colors duration-(--dur-fast) hover:text-foreground",
          "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        )}
      >
        {value}
      </button>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="ตัวอักษรใหญ่ขึ้น" disabled={value >= FONT_MAX} onClick={() => step(1)}>
              <Plus />
            </Button>
          }
        />
        <TooltipContent>
          ใหญ่ขึ้น<kbd className="ml-2 font-mono opacity-70">Ctrl +</kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export type PanelTab<T extends string> = {
  value: T
  label: React.ReactNode
  /** ข้อมูลประกอบของแท็บที่เปิดอยู่ เช่นจำนวนคำสั่ง — โชว์มุมขวาของแถบแท็บ */
  aside?: React.ReactNode
  bodyClassName?: string
  content: React.ReactNode
}

/** การ์ดที่มีแท็บอยู่บนหัว — ใช้แทนการวางหลายการ์ดเรียงกันในฝั่งขวาของ workbench */
export function TabbedPanel<T extends string>({
  label,
  tabs,
  value,
  onValueChange,
}: {
  label: string
  tabs: PanelTab<T>[]
  value: T
  onValueChange: (v: T) => void
}) {
  const current = tabs.find((t) => t.value === value) ?? tabs[0]
  return (
    <Tabs
      value={current.value}
      onValueChange={(v) => onValueChange(v as T)}
      className="min-w-0 gap-0 rounded-lg border bg-card"
    >
      <div className="flex min-h-11 items-end justify-between gap-2 border-b px-2 pt-1.5">
        {/* แถบแท็บเลื่อนแนวนอนในกล่องตัวเอง จอแคบแล้วไม่ดันทั้งหน้าให้ล้น */}
        <div className="-mb-px min-w-0 overflow-x-auto">
          <TabsList variant="line" aria-label={label} className="h-10! gap-0">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="px-3">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {current.aside && <div className="hidden shrink-0 self-center px-2 sm:block">{current.aside}</div>}
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className={cn("min-w-0 px-4 pt-3 pb-4", t.bodyClassName)}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
