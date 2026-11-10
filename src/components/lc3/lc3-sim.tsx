"use client"

import { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { CodeEditor } from "@/components/sim/code-editor"
import { Controls, ErrorList, ExamplePicker, Panel, StepCard, statusOf } from "@/components/sim/parts"
import { TraceLog, type TraceRow } from "@/components/sim/trace-log"
import { LC3_EXAMPLES } from "@/config/examples"
import { useRunner } from "@/hooks/use-runner"
import { useShortcuts } from "@/hooks/use-shortcuts"
import { useStored } from "@/hooks/use-stored"
import { hex } from "@/lib/format"
import { assembleLc3 } from "@/lib/lc3/assembler"
import { Lc3Machine } from "@/lib/lc3/cpu"
import { Console, MemoryTable, Registers } from "./lc3-views"

export function Lc3Sim({ active }: { active: boolean }) {
  const [exampleId, setExampleId] = useStored("lc3.example", LC3_EXAMPLES[0].id)
  const [code, setCode] = useStored("lc3.code", LC3_EXAMPLES[0].code)
  /** breakpoint เก็บเป็น address ใช้ร่วมกันทั้งเลขบรรทัดในโค้ดและแถวในตาราง memory */
  const [bps, setBps] = useState<Set<number>>(new Set())
  const [clearedAt, setClearedAt] = useState(0)
  const [, bump] = useReducer((x: number) => x + 1, 0)

  const program = useMemo(() => assembleLc3(code), [code])
  const hardErrors = program.errors.filter((e) => e.severity === "error")
  const [machine, setMachine] = useState<Lc3Machine | null>(null)

  const runner = useRunner({
    machine,
    isBreakpoint: (pc) => bps.has(pc),
    onChange: bump,
  })
  const { clearPause } = runner

  const reset = useCallback(() => {
    clearPause()
    setMachine(program.errors.some((e) => e.severity === "error") ? null : new Lc3Machine(program))
    setClearedAt(0)
    bump()
  }, [program, clearPause])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- สร้างเครื่องใหม่ทุกครั้งที่โปรแกรมเปลี่ยน
    reset()
  }, [reset])

  const toggleBp = (addr: number) =>
    setBps((s) => {
      const n = new Set(s)
      if (n.has(addr)) n.delete(addr)
      else n.add(addr)
      return n
    })

  useShortcuts(active, {
    toggleRun: () => (runner.running ? runner.stop() : runner.run()),
    step: runner.step,
    back: runner.back,
    reset,
  })

  const m = machine
  const last = m?.history[m.history.length - 1]
  const currentLine = m && !m.error ? (program.addrToLine.get(m.pc) ?? null) : null
  const bpLines = new Set<number>()
  for (const a of bps) {
    const l = program.addrToLine.get(a)
    if (l !== undefined) bpLines.add(l)
  }
  const example = LC3_EXAMPLES.find((e) => e.id === exampleId)
  const waiting = !!m?.waitingInput && !m.done

  const onInput = (text: string) => {
    if (!m) return
    const resume = runner.pause === "input" || m.waitingInput
    m.feed(text)
    bump()
    // โปรแกรมหยุดรอ input อยู่ระหว่างรัน → พิมพ์แล้วรันต่อให้เลย
    if (resume && runner.pause === "input") runner.run()
  }

  const rows: TraceRow[] = (m?.history.slice(-300) ?? []).map(({ trace: t }) => ({
    n: t.n,
    where: hex(t.addr, 4),
    text: t.text,
    error: !!m?.error && t.n === m.steps,
    detail: t.note,
  }))

  const status = statusOf({
    asmErrors: hardErrors.length,
    running: runner.running,
    halted: !!m?.halted,
    error: m?.error ?? null,
    pause: runner.pause,
    waitingInput: waiting,
    steps: m?.steps ?? 0,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
        <ExamplePicker
          examples={LC3_EXAMPLES}
          value={exampleId}
          onPick={(id) => {
            const ex = LC3_EXAMPLES.find((e) => e.id === id)!
            setExampleId(id)
            setCode(ex.code)
            setBps(new Set())
          }}
        />
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
          where={last ? hex(last.trace.addr, 4) : undefined}
          text={last?.trace.text}
          note={last?.trace.note}
          error={m?.error && last?.trace.n === m.steps ? m.error : null}
          empty={
            hardErrors.length
              ? "แก้ error ในโค้ดก่อน แล้วเครื่องจะพร้อมรันเอง"
              : `เริ่มที่ PC = ${hex(program.entry, 4)} · กด "ทีละคำสั่ง" (F10) หรือ "รัน" (F8)${example?.hint ? ` · ${example.hint}` : ""}`
          }
        />

      <div className="mt-2 grid items-start gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:grid-cols-[minmax(0,4fr)_minmax(0,3fr)_minmax(0,4fr)]">
        <Panel
          title="โค้ด LC3"
          aside={<span className="text-xs text-muted-foreground">คลิกเลขบรรทัด = breakpoint</span>}
          bodyClassName="flex flex-col gap-2"
        >
          <div>
            <CodeEditor
              lang="lc3"
              ariaLabel="โค้ด LC3 assembly"
              value={code}
              onChange={(v) => {
                setCode(v)
                setExampleId("")
              }}
              currentLine={currentLine}
              errors={program.errors}
              breakpoints={bpLines}
              onToggleBreakpoint={(ln) => {
                const a = program.lineToAddr.get(ln)
                if (a !== undefined) toggleBp(a)
              }}
            />
          </div>
          <ErrorList errors={program.errors} />
        </Panel>

        <Panel title="เรจิสเตอร์">
          <Registers m={m} changed={last?.trace.changed ?? []} />
        </Panel>

        <div className="flex min-w-0 flex-col gap-4 md:col-span-2 xl:col-span-1">
          <Panel title="Console" aside={<span className="text-xs text-muted-foreground">OUT · PUTS · GETC · IN · xFE00–xFE06</span>}>
            <Console
              output={(m?.output ?? "").slice(clearedAt)}
              pending={m ? m.input.slice(m.inPos) : ""}
              waiting={waiting}
              onInput={onInput}
              onClear={() => setClearedAt(m?.output.length ?? 0)}
            />
          </Panel>
          <Panel title="หน่วยความจำ" bodyClassName="h-80 flex-none">
            <MemoryTable m={m} listing={program.listing} breakpoints={bps} onToggleBreakpoint={toggleBp} />
          </Panel>
          <Panel
            title="ลำดับการทำงาน"
            aside={<span className="text-xs text-muted-foreground tabular-nums">{(m?.steps ?? 0).toLocaleString()} คำสั่ง</span>}
            bodyClassName="flex-none px-2 pt-0 pb-2"
          >
            <TraceLog rows={rows} empty="ยังไม่ได้รันคำสั่งไหนเลย — กด ทีละคำสั่ง (F10) แล้วประวัติจะขึ้นที่นี่" />
          </Panel>
        </div>
      </div>
    </div>
  )
}
