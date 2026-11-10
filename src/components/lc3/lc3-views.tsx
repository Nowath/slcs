"use client"

import { useEffect, useRef, useState } from "react"
import { Crosshair } from "lucide-react"
import { Button } from "@/components/ui/button"
import { hex, parseNumber, printable, toSigned } from "@/lib/format"
import type { Lc3ListingRow } from "@/lib/lc3/assembler"
import type { CC, Lc3Machine } from "@/lib/lc3/cpu"
import { disassemble } from "@/lib/lc3/disasm"
import { highlightLine, TOK_CLASS } from "@/lib/highlight"
import { cn } from "@/lib/utils"

const REG_HINT: Record<number, string> = { 6: "stack pointer", 7: "return address" }

export function Registers({ m, changed }: { m: Lc3Machine | null; changed: string[] }) {
  const r = m?.r ?? [0, 0, 0, 0, 0, 0, 0, 0]
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-md border bg-pc-soft px-3 py-2">
          <dt className="text-xs text-muted-foreground">PC</dt>
          <dd className="font-mono text-lg font-semibold text-pc tabular-nums">{m ? hex(m.pc, 4) : "–"}</dd>
        </div>
        <div className="rounded-md border px-3 py-2">
          <dt className="text-xs text-muted-foreground">CC</dt>
          <dd className="flex gap-1 pt-0.5">
            {(["N", "Z", "P"] as CC[]).map((c) => (
              <span
                key={c}
                aria-label={`${c} ${m?.cc === c ? "เปิด" : "ปิด"}`}
                className={cn(
                  "grid size-7 place-items-center rounded-sm border font-mono text-sm font-semibold",
                  m?.cc === c ? "border-pc bg-pc text-primary-foreground" : "text-muted-foreground/60"
                )}
              >
                {c}
              </span>
            ))}
          </dd>
        </div>
        <div className="col-span-2 rounded-md border px-3 py-2">
          <dt className="text-xs text-muted-foreground">IR (คำสั่งล่าสุด)</dt>
          <dd className="flex flex-wrap items-baseline gap-x-3 font-mono tabular-nums">
            <span className="font-semibold">{m ? hex(m.ir, 4) : "–"}</span>
            <span className="text-xs text-muted-foreground">{m ? m.ir.toString(2).padStart(16, "0").replace(/(.{4})/g, "$1 ").trim() : ""}</span>
          </dd>
        </div>
      </dl>
      <dl className="grid grid-cols-2 gap-2">
        {r.map((v, i) => {
          const c = printable(v)
          const hot = changed.includes(`R${i}`)
          return (
            <div
              key={i}
              className={cn(
                "rounded-md border px-3 py-1.5 transition-colors duration-(--dur-med) ease-(--ease-out)",
                hot && "border-changed/50 bg-changed-soft"
              )}
            >
              <dt className="flex items-baseline justify-between gap-1 text-xs text-muted-foreground">
                <span className={cn("font-mono font-semibold", hot && "text-changed")}>R{i}</span>
                {REG_HINT[i] && <span className="truncate">{REG_HINT[i]}</span>}
              </dt>
              <dd className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
                <span className="font-semibold">{hex(v, 4)}</span>
                <span className="text-xs text-muted-foreground">
                  {toSigned(v, 16)}
                  {c && ` '${c}'`}
                </span>
              </dd>
            </div>
          )
        })}
      </dl>
      {m && !m.done && (
        <div className="rounded-md border border-dashed px-3 py-2.5">
          <p className="text-xs text-muted-foreground">คำสั่งถัดไป (ที่ PC ชี้อยู่)</p>
          <p className="font-mono text-sm">
            {highlightLine(disassemble(m.mem[m.pc], m.pc, m.labelAt), "lc3").map((t, k) => (
              <span key={k} className={TOK_CLASS[t.kind]}>
                {t.text}
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  )
}

const WINDOW = 48

/** หน่วยความจำรอบ PC: address · label · ค่า · คำสั่งที่ถอดกลับ — คลิกแถวเพื่อตั้ง breakpoint */
export function MemoryTable({
  m,
  listing,
  breakpoints,
  onToggleBreakpoint,
}: {
  m: Lc3Machine | null
  listing: Lc3ListingRow[]
  breakpoints: Set<number>
  onToggleBreakpoint: (addr: number) => void
}) {
  const [follow, setFollow] = useState(true)
  const [anchor, setAnchor] = useState(0x3000)
  const [goto, setGoto] = useState("")
  const boxRef = useRef<HTMLDivElement>(null)
  const rowInfo = new Map(listing.map((r) => [r.addr, r]))
  const pc = m?.pc ?? 0
  // ตาม PC: ถ้า PC ยังอยู่ในช่วงต้นโปรแกรม ให้หน้าต่างเริ่มที่ .ORIG จะได้เห็นโค้ดทั้งก้อนนิ่งๆ ไม่เลื่อนทุก step
  const progStart = listing[0]?.addr ?? pc
  const pcNearStart = pc >= progStart && pc - progStart < WINDOW - 8
  const clamp = (a: number) => Math.max(0, Math.min(0x10000 - WINDOW, a))
  const start = follow ? clamp(pcNearStart ? progStart : pc - 8) : anchor
  const writes = new Set(m?.lastWrites ?? [])

  // เลื่อนกล่องให้เห็นแถว PC (เฉพาะในกล่อง ไม่ลากทั้งหน้า)
  useEffect(() => {
    const box = boxRef.current
    const row = box?.querySelector<HTMLElement>("[data-pc=true]")
    if (!box || !row) return
    const top = row.offsetTop - box.clientHeight / 3
    if (row.offsetTop < box.scrollTop + 30 || row.offsetTop > box.scrollTop + box.clientHeight - 40) box.scrollTop = Math.max(0, top)
  }, [pc, start])

  const jump = () => {
    const v = parseNumber(goto.trim().replace(/^([0-9a-f]{4})$/i, "x$1"))
    if (v === null || v < 0 || v > 0xffff) return
    setFollow(false)
    setAnchor(Math.max(0, Math.min(0x10000 - WINDOW, v)))
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          jump()
        }}
      >
        <label className="sr-only" htmlFor="lc3-goto">
          ไปที่ address
        </label>
        <input
          id="lc3-goto"
          value={goto}
          onChange={(e) => setGoto(e.target.value)}
          placeholder="ไปที่ address เช่น x3000"
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2.5 font-mono text-sm outline-none placeholder:font-sans focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" variant="outline" size="lg">
          ไป
        </Button>
        <Button type="button" variant={follow ? "secondary" : "outline"} size="lg" onClick={() => setFollow(true)} aria-pressed={follow}>
          <Crosshair />
          ตาม PC
        </Button>
      </form>
      <div ref={boxRef} className="relative min-h-0 flex-1 overflow-auto rounded-md border">
        <table className="w-full min-w-[30rem] border-collapse font-mono text-xs tabular-nums">
          <thead className="sticky top-0 z-10 bg-card text-muted-foreground">
            <tr>
              <th className="w-6" />
              <th className="py-1 pr-2 text-left font-normal">addr</th>
              <th className="py-1 pr-2 text-left font-normal">label</th>
              <th className="py-1 pr-2 text-left font-normal">ค่า</th>
              <th className="py-1 pr-2 text-left font-normal">คำสั่ง / ข้อมูล</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: WINDOW }, (_, i) => {
              const a = start + i
              const v = m?.mem[a] ?? 0
              const info = rowInfo.get(a)
              const isPc = a === pc
              const bp = breakpoints.has(a)
              const c = printable(v)
              const decoded =
                info?.kind === "code" || (!info && v !== 0)
                  ? disassemble(v, a, m?.labelAt ?? new Map())
                  : `${toSigned(v, 16)}${c ? ` '${c}'` : ""}`
              return (
                <tr
                  key={a}
                  data-pc={isPc}
                  onClick={() => onToggleBreakpoint(a)}
                  className={cn(
                    "cursor-pointer border-t border-border/60 hover:bg-muted/60",
                    isPc && "bg-pc-soft hover:bg-pc-soft",
                    writes.has(a) && "bg-changed-soft"
                  )}
                >
                  <td className="relative py-1 text-center">
                    {isPc && <span className="absolute inset-y-0 left-0 w-0.5 bg-pc" />}
                    <span className={cn("inline-block size-2 rounded-full", bp ? "bg-bp" : "bg-transparent")} />
                  </td>
                  <td className={cn("py-1 pr-2", isPc ? "font-semibold text-pc" : "text-muted-foreground")}>{hex(a, 4)}</td>
                  <td className="max-w-24 truncate py-1 pr-2">{m?.labelAt.get(a) ?? ""}</td>
                  <td className={cn("py-1 pr-2", writes.has(a) && "font-semibold text-changed", v === 0 && "text-muted-foreground/60")}>
                    {hex(v, 4)}
                  </td>
                  <td className={cn("py-1 pr-2 whitespace-nowrap", !info && "opacity-60")}>
                    {info?.kind === "data"
                      ? decoded
                      : highlightLine(decoded, "lc3").map((t, k) => (
                          <span key={k} className={TOK_CLASS[t.kind]}>
                            {t.text}
                          </span>
                        ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">คลิกแถวเพื่อตั้ง/ลบ breakpoint · แถบเขียว = เพิ่งถูกเขียน</p>
    </div>
  )
}

export function Console({
  output,
  pending,
  waiting,
  onInput,
  onClear,
}: {
  output: string
  pending: string
  waiting: boolean
  onInput: (text: string) => void
  onClear: () => void
}) {
  const outRef = useRef<HTMLPreElement>(null)
  useEffect(() => {
    const o = outRef.current
    if (o) o.scrollTop = o.scrollHeight
  }, [output])
  return (
    <div className="flex flex-col gap-2">
      <pre
        ref={outRef}
        aria-label="ผลลัพธ์บนจอ"
        aria-live="polite"
        className="min-h-12 max-h-40 overflow-auto rounded-md border bg-code p-2.5 font-mono text-sm leading-relaxed whitespace-pre-wrap break-all"
      >
        {output || <span className="text-muted-foreground">(ยังไม่มีอะไรพิมพ์ออกจอ)</span>}
      </pre>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="lc3-kbd" className={cn("text-xs", waiting ? "font-semibold text-bp" : "text-muted-foreground")}>
          {waiting ? "โปรแกรมรอให้พิมพ์ →" : "คีย์บอร์ด"}
        </label>
        <input
          id="lc3-kbd"
          value=""
          onChange={() => {}}
          onKeyDown={(e) => {
            if (e.key === "Enter") onInput("\n")
            else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) onInput(e.key)
            else return
            e.preventDefault()
          }}
          onPaste={(e) => {
            e.preventDefault()
            onInput(e.clipboardData.getData("text"))
          }}
          placeholder="คลิกแล้วพิมพ์ ตัวอักษรจะส่งเข้าเครื่องทันที"
          className={cn(
            "h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2.5 font-mono text-sm outline-none placeholder:font-sans",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            waiting && "border-bp ring-3 ring-bp/25"
          )}
        />
        <Button variant="ghost" size="lg" onClick={onClear}>
          ล้างจอ
        </Button>
      </div>
      {pending && (
        <p className="text-xs text-muted-foreground">
          รอโปรแกรมอ่าน: <span className="font-mono text-foreground">{JSON.stringify(pending)}</span>
        </p>
      )}
    </div>
  )
}
