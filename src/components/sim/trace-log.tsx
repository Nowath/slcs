"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

export type TraceRow = { n: number; where: string; text: string; detail: React.ReactNode; error?: boolean }

/** ประวัติการทำงาน แสดงล่าสุดไม่เกิน 300 แถว (history จริงเก็บได้ถึง 50,000 สำหรับปุ่มย้อนกลับ) */
export function TraceLog({ rows, empty }: { rows: TraceRow[]; empty: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const last = rows[rows.length - 1]?.n
  // เลื่อนเฉพาะกล่องตัวเองไปแถวล่าสุด (scrollIntoView จะลากทั้งหน้าไปด้วย)
  useEffect(() => {
    const b = boxRef.current
    if (b) b.scrollTop = b.scrollHeight
  }, [last])
  if (!rows.length) return <p className="px-2 py-4 text-sm text-muted-foreground">{empty}</p>
  return (
    <div ref={boxRef} className="max-h-[26rem] overflow-auto">
      <table className="w-full border-collapse text-sm sm:min-w-[28rem]">
        <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
          <tr>
            <th className="w-12 py-1 pr-2 text-right font-normal">#</th>
            <th className="w-16 py-1 pr-2 text-left font-normal">addr</th>
            <th className="w-36 py-1 pr-2 text-left font-normal">คำสั่ง</th>
            <th className="hidden py-1 text-left font-normal sm:table-cell">ผล</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.n}
              className={cn(
                "border-t align-top",
                i === rows.length - 1 && "bg-pc-soft",
                r.error && "bg-destructive/10 text-destructive"
              )}
            >
              <td className="py-1 pr-2 text-right font-mono text-xs text-muted-foreground tabular-nums">{r.n}</td>
              <td className="py-1 pr-2 font-mono text-xs tabular-nums">{r.where}</td>
              <td className="py-1 pr-2 font-mono text-xs font-medium whitespace-nowrap">
                {r.text}
                {/* จอแคบ: ย้ายผลมาไว้ใต้คำสั่ง แทนที่จะเป็นคอลัมน์ที่ถูกตัด */}
                <div className="mt-0.5 font-sans text-xs leading-relaxed font-normal whitespace-normal text-muted-foreground sm:hidden">
                  {r.detail}
                </div>
              </td>
              <td className="hidden py-1 text-xs leading-relaxed sm:table-cell">{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
