"use client"

import { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { CodeEditor } from "@/components/sim/code-editor"
import { Controls, ErrorList, ExamplePicker, Panel, StepCard, statusOf } from "@/components/sim/parts"
import { Segmented } from "@/components/sim/segmented"
import { TraceLog, type TraceRow } from "@/components/sim/trace-log"
import { STACK_EXAMPLES } from "@/config/examples"
import { useRunner } from "@/hooks/use-runner"
import { useShortcuts } from "@/hooks/use-shortcuts"
import { useStored } from "@/hooks/use-stored"
import { fmt, type NumFormat } from "@/lib/format"
import { assembleStack, OP_BY_CODE, STACK_OPS, StackMachine } from "@/lib/stack/cpu"
import { MemoryGrid, StackColumn } from "./stack-views"

const FORMATS: { value: NumFormat; label: string }[] = [
  { value: "dec", label: "ฐาน 10" },
  { value: "signed", label: "±" },
  { value: "hex", label: "hex" },
]

export function StackSim({ active }: { active: boolean }) {
  const [exampleId, setExampleId] = useStored("stack.example", STACK_EXAMPLES[0].id)
  const [code, setCode] = useStored("stack.code", STACK_EXAMPLES[0].code)
  const [bits, setBits] = useStored<8 | 16>("stack.bits", 8)
  const [format, setFormat] = useStored<NumFormat>("stack.format", "dec")
  const [bps, setBps] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(0)
  const [, bump] = useReducer((x: number) => x + 1, 0)

  const program = useMemo(() => assembleStack(code, bits), [code, bits])
  const hardErrors = program.errors.filter((e) => e.severity === "error")
  const [machine, setMachine] = useState<StackMachine | null>(null)

  const runner = useRunner({
    machine,
    isBreakpoint: (pc) => {
      const line = program.addrToLine.get(pc)
      return line !== undefined && bps.has(line) && program.lineToAddr.get(line) === pc
    },
    onChange: bump,
  })
  const { clearPause } = runner

  const reset = useCallback(() => {
    clearPause()
    setMachine(program.errors.some((e) => e.severity === "error") ? null : new StackMachine(program))
    setPage(0)
    bump()
  }, [program, clearPause])

  // โค้ดเปลี่ยน = เริ่มเครื่องใหม่ด้วยโปรแกรมใหม่
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- สร้างเครื่องใหม่ทุกครั้งที่โปรแกรมเปลี่ยน
    reset()
  }, [reset])

  const m = machine
  const followPage = m ? Math.floor(m.pc / 256) : 0
  // ตอนรัน/step ให้ตาราง memory ตามไปหน้าที่ PC อยู่
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ตาม PC เฉพาะตอนมันข้ามหน้า
    setPage(followPage)
  }, [followPage])

  useShortcuts(active, {
    toggleRun: () => (runner.running ? runner.stop() : runner.run()),
    step: runner.step,
    back: runner.back,
    reset,
  })

  const last = m?.history[m.history.length - 1]
  const prevDs = last?.ds ?? m?.ds ?? []
  let freshFrom = 0
  if (m) {
    while (freshFrom < prevDs.length && freshFrom < m.ds.length && prevDs[freshFrom] === m.ds[freshFrom]) freshFrom++
    if (!last) freshFrom = m.ds.length
  }
  const prevRs = last?.rs ?? m?.rs ?? []
  let rsFresh = 0
  if (m) {
    while (rsFresh < prevRs.length && rsFresh < m.rs.length && prevRs[rsFresh] === m.rs[rsFresh]) rsFresh++
    if (!last) rsFresh = m.rs.length
  }

  const nextOp = m && !m.done ? OP_BY_CODE.get(m.mem[m.pc]) : undefined
  const currentLine = m && !m.error ? (program.addrToLine.get(m.pc) ?? null) : null
  const programEnd = program.listing.reduce((e, r) => Math.max(e, r.addr + r.words.length), 0)
  const example = STACK_EXAMPLES.find((e) => e.id === exampleId)

  const rows: TraceRow[] = (m?.history.slice(-300) ?? []).map(({ trace: t }) => ({
    n: t.n,
    where: String(t.addr),
    text: t.text,
    error: t.note === m?.error && !!m?.error && t.n === m.steps,
    detail: (
      <>
        {t.note}
        <span className="ml-2 font-mono text-muted-foreground">DS [{t.ds.map((v) => fmt(v, bits, format)).join(" ")}]</span>
      </>
    ),
  }))

  const status = statusOf({
    asmErrors: hardErrors.length,
    running: runner.running,
    halted: !!m?.halted,
    error: m?.error ?? null,
    pause: runner.pause,
    steps: m?.steps ?? 0,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <ExamplePicker
            examples={STACK_EXAMPLES}
            value={exampleId}
            onPick={(id) => {
              const ex = STACK_EXAMPLES.find((e) => e.id === id)!
              setExampleId(id)
              setCode(ex.code)
              setBps(new Set())
            }}
          />
          <div className="flex flex-wrap items-center gap-4">
            <Segmented
              label="ขนาดข้อมูล"
              value={String(bits) as "8" | "16"}
              options={[
                { value: "8", label: "8 บิต" },
                { value: "16", label: "16 บิต" },
              ]}
              onChange={(v) => setBits(v === "8" ? 8 : 16)}
            />
            <Segmented label="แสดงเลข" value={format} options={FORMATS} onChange={setFormat} />
          </div>
        </div>
        <Controls
          running={runner.running}
          canStep={!!m && !m.done}
          canBack={!!m && m.history.length > 0}
          onRun={runner.run}
          onStop={runner.stop}
          onStep={runner.step}
          onBack={runner.back}
          onReset={reset}
          speed={runner.speed}
          onSpeed={runner.setSpeed}
        />
      </div>

      <StepCard
          status={status}
          n={last?.trace.n}
          where={last ? `addr ${last.trace.addr}` : undefined}
          text={last?.trace.text}
          note={last?.trace.note}
          error={m?.error && last?.trace.n === m.steps ? m.error : null}
          empty={
            hardErrors.length
              ? "แก้ error ในโค้ดก่อน แล้วเครื่องจะพร้อมรันเอง"
              : `กด "ทีละคำสั่ง" (F10) เพื่อดูการทำงานทีละขั้น หรือ "รัน" (F8) เพื่อดูผลลัพธ์${example?.hint ? ` · ${example.hint}` : ""}`
          }
        />

      <div className="mt-2 grid items-start gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:grid-cols-[minmax(0,4fr)_minmax(0,3fr)_minmax(0,5fr)]">
        <Panel
          title="โค้ด"
          aside={<span className="text-xs text-muted-foreground">คลิกเลขบรรทัด = breakpoint</span>}
          bodyClassName="flex flex-col gap-2"
        >
          <div>
            <CodeEditor
              lang="stack"
              ariaLabel="โค้ด Stack CPU"
              value={code}
              onChange={(v) => {
                setCode(v)
                setExampleId("")
              }}
              currentLine={currentLine}
              errors={program.errors}
              breakpoints={bps}
              onToggleBreakpoint={(ln) =>
                setBps((s) => {
                  const n = new Set(s)
                  if (n.has(ln)) n.delete(ln)
                  else n.add(ln)
                  return n
                })
              }
            />
          </div>
          <ErrorList errors={program.errors} />
        </Panel>

        <Panel title="สถานะ CPU" bodyClassName="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-md border bg-pc-soft px-3 py-2">
              <dt className="text-xs text-muted-foreground">PC</dt>
              <dd className="font-mono text-xl font-semibold text-pc tabular-nums">{m?.pc ?? "–"}</dd>
            </div>
            <div className="rounded-md border px-3 py-2">
              <dt className="text-xs text-muted-foreground">ทำไปแล้ว</dt>
              <dd className="font-mono text-xl font-semibold tabular-nums">{m?.steps.toLocaleString() ?? 0}</dd>
            </div>
          </dl>
          <div className="grid grid-cols-2 gap-3">
            <StackColumn
              title="Data Stack"
              values={m?.ds ?? []}
              freshFrom={freshFrom}
              bits={bits}
              format={format}
              emptyText="ว่าง"
            />
            <StackColumn
              title="Return Stack"
              values={m?.rs ?? []}
              freshFrom={rsFresh}
              bits={bits}
              format="dec"
              emptyText="ว่าง"
            />
          </div>
          {nextOp && (
            <div className="rounded-md border border-dashed px-3 py-2.5">
              <p className="text-xs text-muted-foreground">คำสั่งถัดไป (ที่ PC ชี้อยู่)</p>
              <p className="font-mono text-sm">
                <span className="font-semibold text-syn-op">{nextOp.name}</span>
                {nextOp.operand && <span className="text-syn-num"> {m!.mem[m!.pc + 1]}</span>}
                <span className="ml-2 text-xs text-muted-foreground">{nextOp.effect}</span>
              </p>
            </div>
          )}
        </Panel>

        <div className="flex min-w-0 flex-col gap-4 md:col-span-2 xl:col-span-1">
          <Panel
            title="ลำดับการทำงาน"
            aside={<span className="text-xs text-muted-foreground tabular-nums">{(m?.steps ?? 0).toLocaleString()} คำสั่ง</span>}
            bodyClassName="flex-none px-2 pt-0 pb-2"
          >
            <TraceLog rows={rows} empty="ยังไม่ได้รันคำสั่งไหนเลย — กด ทีละคำสั่ง (F10) แล้วประวัติจะขึ้นที่นี่" />
          </Panel>
          <Panel title={`หน่วยความจำ (${(1 << bits).toLocaleString()} ช่อง × ${bits} บิต)`}>
            {m ? (
              <MemoryGrid
                mem={m.mem}
                bits={bits}
                pc={m.pc}
                programEnd={programEnd}
                lastWrite={m.lastWrite}
                format={format}
                page={page}
                onPage={setPage}
              />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีโปรแกรมที่แปลผ่าน</p>
            )}
          </Panel>
        </div>
      </div>

      <Panel title="ชุดคำสั่ง Stack CPU" aside={<span className="text-xs text-muted-foreground">a = ตัวรอง, b = TOS</span>}>
        <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {STACK_OPS.map((op) => (
            <li key={op.code} className="flex items-baseline gap-2">
              <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">{op.code.toString(16).padStart(2, "0")}</span>
              <span className="w-20 shrink-0 font-mono font-semibold">
                {op.name}
                {op.operand && <span className="font-normal text-muted-foreground"> n</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                {op.effect}
                {op.aliases.length > 0 && ` · เขียน ${op.aliases.join(" ")} ได้`}
                {op.extra && " · คำสั่งเสริม"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          label เขียนได้ทั้ง <code className="font-mono">:LOOP</code> หรือ <code className="font-mono">LOOP:</code> · comment ใช้{" "}
          <code className="font-mono">{"//"}</code> หรือ <code className="font-mono">;</code> · ตัวเลข 10, -5, x80, 0x80 · วางโค้ดแบบ{" "}
          <code className="font-mono">Address 0: LIT</code> จากชีทได้ตรงๆ
        </p>
      </Panel>
    </div>
  )
}
