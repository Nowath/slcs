// Stack CPU ตามบทที่ 8–9 วิชา 2301274 — assembler + ตัวจำลองทีละคำสั่ง
import { type AsmError, parseNumber } from "@/lib/format"

export type StackOp = {
  code: number
  name: string
  aliases: string[]
  operand: boolean
  /** ผลต่อ data stack เขียนแบบในชีท */
  effect: string
  extra?: boolean
}

export const STACK_OPS: StackOp[] = [
  { code: 0x00, name: "LIT", aliases: [], operand: true, effect: "… → … n" },
  { code: 0x01, name: "LOAD", aliases: ["@"], operand: false, effect: "… addr → … mem[addr]" },
  { code: 0x02, name: "STORE", aliases: ["!"], operand: false, effect: "… value addr → …" },
  { code: 0x03, name: "DROP", aliases: [], operand: false, effect: "… a b → … a" },
  { code: 0x04, name: "DUP", aliases: [], operand: false, effect: "… b → … b b" },
  { code: 0x05, name: "OVER", aliases: [], operand: false, effect: "… a b → … a b a" },
  { code: 0x06, name: "SWAP", aliases: [], operand: false, effect: "… a b → … b a" },
  { code: 0x07, name: "ADD", aliases: ["+"], operand: false, effect: "… a b → … a+b" },
  { code: 0x08, name: "SUB", aliases: ["-"], operand: false, effect: "… a b → … a−b" },
  { code: 0x09, name: "AND", aliases: [], operand: false, effect: "… a b → … a&b" },
  { code: 0x0a, name: "OR", aliases: [], operand: false, effect: "… a b → … a|b" },
  { code: 0x0b, name: "XOR", aliases: [], operand: false, effect: "… a b → … a^b" },
  { code: 0x0c, name: "IF", aliases: [], operand: true, effect: "… b → … (กระโดดถ้า b = 0)" },
  { code: 0x0d, name: "CALL", aliases: [], operand: true, effect: "RS ← pc+2, pc ← L" },
  { code: 0x0e, name: "EXIT", aliases: ["RET"], operand: false, effect: "pc ← RS.pop()" },
  { code: 0x0f, name: "HALT", aliases: [], operand: false, effect: "หยุด" },
  // คำสั่งของ simulator ในชีท (โปรแกรมทั่วไปไม่ต้องใช้)
  { code: 0x10, name: ">R", aliases: [], operand: false, effect: "DS → RS", extra: true },
  { code: 0x11, name: "R>", aliases: [], operand: false, effect: "RS → DS", extra: true },
  // คำสั่งสมมติจากแบบฝึกหัดท้ายบท 9 ข้อ ง / จ
  { code: 0x12, name: "POW", aliases: [], operand: false, effect: "… x → … x²", extra: true },
  { code: 0x13, name: "DIV2", aliases: [], operand: false, effect: "… x → … ⌊x/2⌋", extra: true },
]

const BY_NAME = new Map<string, StackOp>()
for (const op of STACK_OPS) {
  BY_NAME.set(op.name, op)
  for (const a of op.aliases) BY_NAME.set(a, op)
}
export const OP_BY_CODE = new Map(STACK_OPS.map((o) => [o.code, o]))

export type StackListingRow = {
  addr: number
  /** ค่าในหน่วยความจำของแถวนี้ (1 ช่อง หรือ 2 ช่องถ้ามี operand) */
  words: number[]
  text: string
  line: number
  label?: string
}

export type StackProgram = {
  bits: 8 | 16
  memory: number[]
  listing: StackListingRow[]
  labels: Map<string, number>
  addrToLine: Map<number, number>
  lineToAddr: Map<number, number>
  errors: AsmError[]
}

const LABEL_RE = /^:?[A-Za-z_][\w.]*:?$/
const cleanLabel = (t: string) => t.replace(/^:/, "").replace(/:$/, "").toUpperCase()

export function assembleStack(source: string, bits: 8 | 16): StackProgram {
  const mask = bits === 8 ? 0xff : 0xffff
  const memSize = 1 << bits
  const errors: AsmError[] = []
  const labels = new Map<string, number>()
  const labelLine = new Map<string, number>()
  const bareLabels = new Set<string>()
  type Item = { addr: number; line: number; op?: StackOp; operand?: string; data?: number; tok: string }
  const items: Item[] = []
  let addr = 0
  let pending: Item | null = null // คำสั่งที่ยังรอ operand (operand อาจอยู่บรรทัดถัดไป แบบ "Address 2: IF / Address 3: 12")

  source.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1
    let text = raw.replace(/\/\/.*$/, "").replace(/;.*$/, "")
    text = text.replace(/^\s*address\s+\d+\s*:/i, "") // รองรับรูปแบบ "Address 0: LIT" ในชีท
    const toks = text.split(/[\s,]+/).filter(Boolean)
    toks.forEach((tok, ti) => {
      if (pending) {
        pending.operand = tok
        pending = null
        return
      }
      const op = BY_NAME.get(tok.toUpperCase())
      if (op) {
        const it: Item = { addr, line, op, tok }
        items.push(it)
        addr += op.operand ? 2 : 1
        if (op.operand) pending = it
        return
      }
      const n = parseNumber(tok)
      if (n !== null) {
        items.push({ addr, line, data: n, tok })
        addr += 1
        return
      }
      if (LABEL_RE.test(tok)) {
        const hasColon = tok.startsWith(":") || tok.endsWith(":")
        if (!hasColon && ti !== 0) {
          errors.push({ line, message: `ไม่รู้จักคำสั่ง "${tok}"`, severity: "error" })
          return
        }
        const name = cleanLabel(tok)
        if (labels.has(name)) {
          errors.push({ line, message: `label "${name}" ซ้ำกับบรรทัด ${labelLine.get(name)}`, severity: "error" })
          return
        }
        labels.set(name, addr)
        labelLine.set(name, line)
        if (!hasColon) bareLabels.add(name)
        return
      }
      errors.push({ line, message: `อ่านไม่ออก: "${tok}"`, severity: "error" })
    })
  })
  if (pending) {
    const p = pending as Item
    errors.push({ line: p.line, message: `${p.op!.name} ต้องมี operand ตามหลัง`, severity: "error" })
  }

  const memory = new Array<number>(memSize).fill(0)
  const listing: StackListingRow[] = []
  const addrToLine = new Map<number, number>()
  const lineToAddr = new Map<number, number>()
  const addrLabel = new Map<number, string>()
  for (const [k, v] of labels) if (!addrLabel.has(v)) addrLabel.set(v, k)
  const used = new Set<string>()

  for (const it of items) {
    if (it.addr >= memSize) {
      errors.push({ line: it.line, message: `โปรแกรมยาวเกินหน่วยความจำ ${memSize} ช่อง`, severity: "error" })
      break
    }
    addrToLine.set(it.addr, it.line)
    if (!lineToAddr.has(it.line)) lineToAddr.set(it.line, it.addr)
    if (it.op) {
      memory[it.addr] = it.op.code
      let text = it.op.name
      const words = [it.op.code]
      if (it.op.operand && it.operand !== undefined) {
        let v = parseNumber(it.operand)
        if (v === null) {
          const name = cleanLabel(it.operand)
          used.add(name)
          if (labels.has(name)) v = labels.get(name)!
          else errors.push({ line: it.line, message: `ไม่พบ label "${name}"`, severity: "error" })
          text += ` :${name}`
        } else {
          text += ` ${v}`
        }
        const val = (v ?? 0) & mask
        if (it.addr + 1 < memSize) memory[it.addr + 1] = val
        words.push(val)
        addrToLine.set(it.addr + 1, it.line)
      }
      listing.push({ addr: it.addr, words, text, line: it.line, label: addrLabel.get(it.addr) })
    } else {
      const v = it.data! & mask
      memory[it.addr] = v
      listing.push({ addr: it.addr, words: [v], text: `${it.data}`, line: it.line, label: addrLabel.get(it.addr) })
    }
  }

  for (const name of bareLabels) {
    if (!used.has(name)) {
      errors.push({
        line: labelLine.get(name)!,
        message: `"${name}" ถูกมองเป็น label แต่ไม่มีที่ใช้ — พิมพ์ชื่อคำสั่งผิดหรือเปล่า?`,
        severity: "warning",
      })
    }
  }
  if (!items.some((it) => it.op?.name === "HALT") && items.length > 0) {
    errors.push({ line: items[items.length - 1].line, message: "ไม่มี HALT — CPU จะทำต่อไปเรื่อยๆ จนเจอข้อมูลที่ไม่ใช่คำสั่ง", severity: "warning" })
  }

  errors.sort((x, y) => x.line - y.line)
  return { bits, memory, listing, labels, addrToLine, lineToAddr, errors }
}

/* ---------------- ตัวจำลอง ---------------- */

export type StackTrace = {
  n: number
  addr: number
  text: string
  note: string
  ds: number[]
  rs: number[]
  jumped: boolean
}

type Undo = {
  pc: number
  ds: number[]
  rs: number[]
  mem?: { addr: number; old: number }
  halted: boolean
  error: string | null
  trace: StackTrace
}

export const MAX_STACK = 4096
const MAX_HISTORY = 50_000

export class StackMachine {
  bits: 8 | 16
  mask: number
  memSize: number
  mem: number[]
  ds: number[] = []
  rs: number[] = []
  pc = 0
  halted = false
  error: string | null = null
  steps = 0
  history: Undo[] = []
  /** address ที่เพิ่งถูกเขียน ใช้ไฮไลต์ใน memory grid */
  lastWrite: number | null = null
  labelAt: Map<number, string>

  constructor(prog: StackProgram) {
    this.bits = prog.bits
    this.mask = prog.bits === 8 ? 0xff : 0xffff
    this.memSize = 1 << prog.bits
    this.mem = prog.memory.slice()
    this.labelAt = new Map()
    for (const [k, v] of prog.labels) if (!this.labelAt.has(v)) this.labelAt.set(v, k)
  }

  get done() {
    return this.halted || this.error !== null
  }

  private fail(msg: string): never {
    throw new StackFault(msg)
  }

  private pop(stack: number[], name: "DS" | "RS"): number {
    if (stack.length === 0) this.fail(`${name} ว่าง แต่คำสั่งต้อง pop ค่า (stack underflow)`)
    return stack.pop()!
  }

  private push(stack: number[], v: number, name: "DS" | "RS") {
    if (stack.length >= MAX_STACK) this.fail(`${name} ล้น (เกิน ${MAX_STACK} ค่า) — เรียกซ้ำไม่มีจุดจบหรือเปล่า?`)
    stack.push(v & this.mask)
  }

  private read(a: number): number {
    if (a < 0 || a >= this.memSize) this.fail(`อ่าน mem[${a}] นอกหน่วยความจำ`)
    return this.mem[a]
  }

  private target(v: number) {
    const l = this.labelAt.get(v)
    return l ? `${v} (:${l})` : `${v}`
  }

  step(): StackTrace | null {
    if (this.done) return null
    const before: Omit<Undo, "trace"> = {
      pc: this.pc,
      ds: this.ds.slice(),
      rs: this.rs.slice(),
      halted: this.halted,
      error: this.error,
    }
    const addr = this.pc
    let text = "?"
    let note = ""
    let jumped = false
    this.lastWrite = null
    try {
      const code = this.read(addr)
      const op = OP_BY_CODE.get(code)
      if (!op) this.fail(`mem[${addr}] = ${code} ไม่ใช่ opcode — ลืม HALT หรือกระโดดผิดที่?`)
      const oper = op.operand ? this.read(addr + 1) : 0
      const lbl = op.name !== "LIT" ? this.labelAt.get(oper) : undefined
      text = op.operand ? `${op.name} ${lbl ? `:${lbl}` : oper}` : op.name
      let next = addr + (op.operand ? 2 : 1)
      const m = this.mask
      switch (op.name) {
        case "LIT":
          this.push(this.ds, oper, "DS")
          note = `push ${oper} ลง DS`
          break
        case "LOAD": {
          const a = this.pop(this.ds, "DS")
          const v = this.read(a)
          this.push(this.ds, v, "DS")
          note = `pop address ${a} แล้ว push mem[${a}] = ${v}`
          break
        }
        case "STORE": {
          const a = this.pop(this.ds, "DS")
          const v = this.pop(this.ds, "DS")
          if (a >= this.memSize) this.fail(`เขียน mem[${a}] นอกหน่วยความจำ`)
          before.mem = { addr: a, old: this.mem[a] }
          this.mem[a] = v
          this.lastWrite = a
          note = `pop address ${a} แล้ว pop ค่า ${v} ไปเขียน mem[${a}] = ${v}`
          break
        }
        case "DROP":
          note = `ทิ้ง ${this.pop(this.ds, "DS")}`
          break
        case "DUP": {
          const v = this.pop(this.ds, "DS")
          this.push(this.ds, v, "DS")
          this.push(this.ds, v, "DS")
          note = `คัดลอก TOS (${v})`
          break
        }
        case "OVER": {
          if (this.ds.length < 2) this.fail("OVER ต้องมีอย่างน้อย 2 ค่าใน DS")
          const v = this.ds[this.ds.length - 2]
          this.push(this.ds, v, "DS")
          note = `คัดลอกตัวรอง (${v}) ขึ้นบนสุด`
          break
        }
        case "SWAP": {
          const b = this.pop(this.ds, "DS")
          const a = this.pop(this.ds, "DS")
          this.push(this.ds, b, "DS")
          this.push(this.ds, a, "DS")
          note = `สลับ ${a} กับ ${b}`
          break
        }
        case "ADD":
        case "SUB":
        case "AND":
        case "OR":
        case "XOR": {
          const b = this.pop(this.ds, "DS")
          const a = this.pop(this.ds, "DS")
          const sym = { ADD: "+", SUB: "−", AND: "&", OR: "|", XOR: "^" }[op.name]!
          const raw =
            op.name === "ADD" ? a + b : op.name === "SUB" ? a - b : op.name === "AND" ? a & b : op.name === "OR" ? a | b : a ^ b
          const r = raw & m
          this.push(this.ds, r, "DS")
          note = `${a} ${sym} ${b} = ${r}`
          if (raw !== r) note += ` (ล้น ${this.bits} บิต จากค่าจริง ${raw})`
          break
        }
        case "IF": {
          const v = this.pop(this.ds, "DS")
          if (v === 0) {
            next = oper
            jumped = true
            note = `TOS = 0 → กระโดดไป ${this.target(oper)}`
          } else {
            note = `TOS = ${v} ≠ 0 → ไม่กระโดด ทำคำสั่งถัดไป`
          }
          break
        }
        case "CALL":
          this.push(this.rs, addr + 2, "RS")
          next = oper
          jumped = true
          note = `เก็บ return address ${addr + 2} ลง RS แล้วกระโดดไป ${this.target(oper)}`
          break
        case "EXIT": {
          const r = this.pop(this.rs, "RS")
          next = r
          jumped = true
          note = `pop RS ได้ ${r} → กลับไปทำต่อที่ address ${r}`
          break
        }
        case "HALT":
          this.halted = true
          next = addr
          note = "หยุดทำงาน"
          break
        case ">R": {
          const v = this.pop(this.ds, "DS")
          this.push(this.rs, v, "RS")
          note = `ย้าย ${v} จาก DS ไป RS`
          break
        }
        case "R>": {
          const v = this.pop(this.rs, "RS")
          this.push(this.ds, v, "DS")
          note = `ย้าย ${v} จาก RS มา DS`
          break
        }
        case "POW": {
          const v = this.pop(this.ds, "DS")
          this.push(this.ds, v * v, "DS")
          note = `${v}² = ${(v * v) & m}`
          break
        }
        case "DIV2": {
          const v = this.pop(this.ds, "DS")
          this.push(this.ds, v >>> 1, "DS")
          note = `⌊${v} / 2⌋ = ${v >>> 1}`
          break
        }
      }
      this.pc = next
    } catch (e) {
      if (!(e instanceof StackFault)) throw e
      this.error = e.message
      note = e.message
    }
    this.steps++
    const trace: StackTrace = {
      n: this.steps,
      addr,
      text,
      note,
      ds: this.ds.slice(),
      rs: this.rs.slice(),
      jumped,
    }
    this.history.push({ ...before, trace })
    if (this.history.length > MAX_HISTORY) this.history.shift()
    return trace
  }

  /** ย้อนกลับ 1 คำสั่ง */
  back(): boolean {
    const u = this.history.pop()
    if (!u) return false
    this.pc = u.pc
    this.ds = u.ds
    this.rs = u.rs
    if (u.mem) this.mem[u.mem.addr] = u.mem.old
    this.halted = u.halted
    this.error = u.error
    this.steps--
    this.lastWrite = null
    return true
  }
}

class StackFault extends Error {}
