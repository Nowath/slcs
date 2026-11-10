"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fmt, hex, printable, type NumFormat } from "@/lib/format"
import { OP_BY_CODE } from "@/lib/stack/cpu"
import { cn } from "@/lib/utils"

/** วาด stack แนวตั้ง TOS อยู่บนสุด เหมือนรูปในชีท ค่าที่เพิ่ง push ขึ้นสีเขียว */
export function StackColumn({
  title,
  values,
  freshFrom,
  bits,
  format,
  emptyText,
}: {
  title: string
  values: number[]
  /** index แรกที่เป็นค่าใหม่จากคำสั่งล่าสุด */
  freshFrom: number
  bits: number
  format: NumFormat
  emptyText: string
}) {
  const shown = values.slice(-64)
  const hidden = values.length - shown.length
  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2">
        <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{values.length} ค่า</span>
      </div>
      {/* "บ่อ" ที่มีพื้นหนาข้างล่าง ให้อ่านออกทันทีว่าค่าซ้อนขึ้นจากก้น */}
      <div className="flex min-h-28 flex-col justify-end rounded-t-md border-b-2 border-foreground/25 bg-muted/50 p-1.5">
        {values.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          <ol className="flex flex-col-reverse gap-1" aria-label={`${title} จากก้นถึงบนสุด`}>
            {hidden > 0 && <li className="text-center text-xs text-muted-foreground">… อีก {hidden} ค่าข้างล่าง</li>}
            {shown.map((v, i) => {
              const idx = hidden + i
              const top = idx === values.length - 1
              const fresh = idx >= freshFrom
              const c = printable(v)
              return (
                <li
                  key={idx}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 font-mono text-sm tabular-nums ring-1",
                    "animate-in fade-in-0 slide-in-from-top-1 transition-colors duration-(--dur-med) ease-(--ease-out)",
                    fresh ? "bg-changed-soft ring-changed/50" : "bg-surface ring-border",
                    top && !fresh && "ring-pc/50"
                  )}
                >
                  <span className="font-semibold">{fmt(v, bits, format)}</span>
                  <span className={cn("truncate text-xs", top ? "font-semibold text-pc" : "text-muted-foreground")}>
                    {top ? "TOS" : format === "hex" ? v : hex(v, bits / 4)}
                    {c && !top && ` '${c}'`}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}

const PAGE = 256

/** หน่วยความจำแบบตาราง 16 × 16 ช่อง — 8 บิตเห็นครบในหน้าเดียว 16 บิตเลื่อนทีละ 256 ช่อง */
export function MemoryGrid({
  mem,
  bits,
  pc,
  programEnd,
  lastWrite,
  format,
  page,
  onPage,
}: {
  mem: number[]
  bits: number
  pc: number
  programEnd: number
  lastWrite: number | null
  format: NumFormat
  page: number
  onPage: (p: number) => void
}) {
  const pages = Math.ceil(mem.length / PAGE)
  const base = page * PAGE
  const pcOp = OP_BY_CODE.get(mem[pc])
  const cols = Array.from({ length: 16 }, (_, i) => i)
  // โชว์ครบ 16 แถวเสมอ — เห็นภาพหน่วยความจำทั้งก้อน ช่องว่างจางลงด้วยสีอยู่แล้ว
  const rows = Array.from({ length: PAGE / 16 }, (_, r) => base + r * 16)
  return (
    <div className="flex flex-col gap-2">
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <Button variant="outline" size="icon-sm" aria-label="หน้าก่อน" disabled={page === 0} onClick={() => onPage(page - 1)}>
            <ChevronLeft />
          </Button>
          <span className="font-mono tabular-nums text-muted-foreground">
            {base}–{base + PAGE - 1} ({hex(base, 4)}) · หน้า {page + 1}/{pages}
          </span>
          <Button variant="outline" size="icon-sm" aria-label="หน้าถัดไป" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
            <ChevronRight />
          </Button>
        </div>
      )}
      {/* ตารางกว้างตายตัว ให้เลื่อนในกล่องตัวเองบนมือถือ ไม่ดันทั้งหน้า */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] table-fixed border-separate border-spacing-0.5 font-mono text-[11px] tabular-nums">
          <thead>
            <tr className="text-muted-foreground">
              <th className="w-10 pb-1 text-left font-normal">+</th>
              {cols.map((c) => (
                <th key={c} className="pb-1 font-normal">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((rowBase) => {
              return (
                <tr key={rowBase}>
                  <th className="pr-1 text-left font-normal text-muted-foreground/70">{rowBase}</th>
                  {cols.map((c) => {
                    const a = rowBase + c
                    const v = mem[a]
                    const isPc = a === pc
                    const isOperand = pcOp?.operand && a === pc + 1
                    const op = a < programEnd ? OP_BY_CODE.get(v) : undefined
                    return (
                      <td
                        key={c}
                        title={`mem[${a}] = ${v} (${hex(v, bits / 4)})${isPc && pcOp ? ` · ${pcOp.name}` : ""}`}
                        className={cn(
                          "h-6 truncate rounded-sm px-0.5 text-center",
                          a < programEnd ? "bg-muted" : "bg-muted/30",
                          v === 0 && !isPc && "text-muted-foreground/35",
                          isOperand && "bg-pc-soft",
                          isPc && "bg-pc font-semibold text-primary-foreground",
                          a === lastWrite && "bg-changed-soft font-semibold text-changed ring-1 ring-changed ring-inset"
                        )}
                      >
                        {isPc && op ? op.name : fmt(v, bits, format)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-pc" /> PC
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-muted ring-1 ring-border" /> โค้ดโปรแกรม
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-changed-soft ring-1 ring-changed" /> เพิ่งถูกเขียน (STORE)
        </li>
      </ul>
    </div>
  )
}
