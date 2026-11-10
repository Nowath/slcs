"use client"

import { AlertTriangle, CircleAlert, CirclePause, CircleStop, Keyboard, Pause, Play, RotateCcw, StepBack, StepForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AsmError } from "@/lib/format"
import { cn } from "@/lib/utils"
import { SPEED_LABEL, type PauseReason, type Speed } from "@/hooks/use-runner"
import type { Example } from "@/config/examples"

export function Panel({
  title,
  aside,
  className,
  bodyClassName,
  children,
}: {
  title: React.ReactNode
  aside?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("flex min-h-0 min-w-0 flex-col rounded-lg border bg-card", className)}>
      {/* ไม่มีเส้นคั่นใต้หัว — ใช้ระยะกับน้ำหนักตัวอักษรแยกแทน หน้าจะได้ไม่เป็นตารางเส้นทั้งจอ */}
      <header className="flex min-h-11 items-center justify-between gap-2 px-4 pt-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside}
      </header>
      <div className={cn("min-h-0 flex-1 px-4 pt-2 pb-4", bodyClassName)}>{children}</div>
    </section>
  )
}

function IconAction({
  label,
  shortcut,
  onClick,
  disabled,
  variant = "outline",
  children,
}: {
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  variant?: "default" | "outline"
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant={variant} size="lg" onClick={onClick} disabled={disabled} className="min-w-11 sm:px-3">
            {children}
            <span className="hidden sm:inline">{label}</span>
          </Button>
        }
      />
      <TooltipContent>
        {label}
        {shortcut && <kbd className="ml-2 font-mono opacity-70">{shortcut}</kbd>}
      </TooltipContent>
    </Tooltip>
  )
}

export function Controls({
  running,
  canStep,
  canBack,
  onRun,
  onStop,
  onStep,
  onBack,
  onReset,
  speed,
  onSpeed,
}: {
  running: boolean
  canStep: boolean
  canBack: boolean
  onRun: () => void
  onStop: () => void
  onStep: () => void
  onBack: () => void
  onReset: () => void
  speed: Speed
  onSpeed: (s: Speed) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {running ? (
        <IconAction label="หยุด" shortcut="F8" onClick={onStop} variant="default">
          <Pause />
        </IconAction>
      ) : (
        <IconAction label="รัน" shortcut="F8" onClick={onRun} disabled={!canStep} variant="default">
          <Play />
        </IconAction>
      )}
      <IconAction label="ทีละคำสั่ง" shortcut="F10" onClick={onStep} disabled={running || !canStep}>
        <StepForward />
      </IconAction>
      <IconAction label="ย้อนกลับ" shortcut="Shift+F10" onClick={onBack} disabled={running || !canBack}>
        <StepBack />
      </IconAction>
      <IconAction label="เริ่มใหม่" shortcut="F9" onClick={onReset}>
        <RotateCcw />
      </IconAction>
      <Select value={speed} onValueChange={(v) => onSpeed(v as Speed)}>
        <SelectTrigger aria-label="ความเร็วตอนรัน" className="h-9 min-w-36">
          <SelectValue>{(v: Speed) => `ความเร็ว: ${SPEED_LABEL[v].split(" ")[0]}`}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SPEED_LABEL) as Speed[]).map((s) => (
            <SelectItem key={s} value={s}>
              {SPEED_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function ExamplePicker({ examples, value, onPick }: { examples: Example[]; value: string; onPick: (id: string) => void }) {
  return (
    <Select value={value} onValueChange={(v) => v && onPick(v as string)}>
      <SelectTrigger aria-label="เลือกตัวอย่างโปรแกรม" className="h-9 w-full sm:w-auto sm:min-w-64">
        <SelectValue>{(v: string) => examples.find((e) => e.id === v)?.title ?? "โปรแกรมของฉัน"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {examples.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export type Status = { kind: "ready" | "running" | "halted" | "error" | "paused" | "input" | "asm"; text: string }

export function statusOf(opts: {
  asmErrors: number
  running: boolean
  halted: boolean
  error: string | null
  pause: PauseReason
  waitingInput?: boolean
  steps: number
}): Status {
  if (opts.asmErrors) return { kind: "asm", text: `แปลโปรแกรมไม่ผ่าน ${opts.asmErrors} จุด` }
  if (opts.error) return { kind: "error", text: "เกิดข้อผิดพลาด" }
  if (opts.halted) return { kind: "halted", text: `HALT หลัง ${opts.steps.toLocaleString()} คำสั่ง` }
  if (opts.running) return { kind: "running", text: "กำลังรัน…" }
  if (opts.waitingInput || opts.pause === "input") return { kind: "input", text: "รอ input จากคีย์บอร์ด" }
  if (opts.pause === "breakpoint") return { kind: "paused", text: "หยุดที่ breakpoint" }
  if (opts.pause === "limit") return { kind: "paused", text: "รันเกิน 2 ล้านคำสั่ง — วนไม่จบหรือเปล่า?" }
  if (opts.steps > 0) return { kind: "paused", text: `หยุดชั่วคราว · ทำไป ${opts.steps.toLocaleString()} คำสั่ง` }
  return { kind: "ready", text: "พร้อมรัน" }
}

export function StatusLine({ status }: { status: Status }) {
  const Icon = {
    ready: CirclePause,
    running: Play,
    halted: CircleStop,
    error: CircleAlert,
    paused: CirclePause,
    input: Keyboard,
    asm: AlertTriangle,
  }[status.kind]
  return (
    <p
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        status.kind === "halted" && "text-changed",
        (status.kind === "error" || status.kind === "asm") && "text-destructive",
        status.kind === "input" && "text-bp",
        (status.kind === "running" || status.kind === "paused") && "text-pc",
        status.kind === "ready" && "text-muted-foreground"
      )}
    >
      <Icon className="size-3.5" />
      {status.text}
    </p>
  )
}

export function ErrorList({ errors, onJump }: { errors: AsmError[]; onJump?: (line: number) => void }) {
  if (!errors.length) return null
  return (
    <ul className="max-h-28 space-y-1 overflow-y-auto text-sm">
      {errors.map((e, i) => (
        <li key={i} className={cn("flex gap-2", e.severity === "error" ? "text-destructive" : "text-muted-foreground")}>
          {e.severity === "error" ? <CircleAlert className="mt-1 size-3.5 shrink-0" /> : <AlertTriangle className="mt-1 size-3.5 shrink-0" />}
          <span>
            <button type="button" onClick={() => onJump?.(e.line)} className="font-mono underline-offset-2 hover:underline">
              บรรทัด {e.line}
            </button>
            : {e.message}
          </span>
        </li>
      ))}
    </ul>
  )
}

const STATUS_BAR: Record<Status["kind"], string> = {
  ready: "bg-border",
  running: "bg-pc",
  paused: "bg-pc",
  halted: "bg-changed",
  error: "bg-destructive",
  asm: "bg-destructive",
  input: "bg-bp",
}

/**
 * การ์ด "เพิ่งทำอะไรไป" — สิ่งที่คนเรียนต้องอ่านทุกครั้งที่กด step จึงตัวใหญ่ที่สุดรองจากโค้ด
 * แถบสีซ้ายบอกสถานะเครื่อง (รัน/หยุด/HALT/error/รอ input) คู่กับข้อความ ไม่ได้สื่อด้วยสีอย่างเดียว
 */
export function StepCard({
  status,
  n,
  where,
  text,
  note,
  error,
  empty,
}: {
  status: Status
  n?: number
  where?: string
  text?: string
  note?: string
  error?: string | null
  empty: string
}) {
  return (
    <div aria-live="polite" className="flex overflow-hidden rounded-lg border bg-card">
      <span aria-hidden className={cn("w-1 shrink-0 transition-colors duration-(--dur-med)", STATUS_BAR[status.kind])} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3">
        <StatusLine status={status} />
        {n === undefined ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{empty}</p>
        ) : (
          <div className="flex flex-col gap-x-4 gap-y-0.5 md:flex-row md:items-baseline">
            <p className="shrink-0 font-mono">
              <span className="text-xs text-muted-foreground">
                #{n} · {where}
              </span>{" "}
              <span className="text-lg font-semibold text-pc">{text}</span>
            </p>
            <p className={cn("text-base leading-relaxed", error ? "text-destructive" : "text-foreground")}>{error ?? note}</p>
          </div>
        )}
      </div>
    </div>
  )
}
