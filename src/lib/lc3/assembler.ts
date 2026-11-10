// LC3 assembler สองรอบ (pass 1 หา address ของ label, pass 2 แปลงเป็นภาษาเครื่อง)
import { type AsmError, hex, parseNumber } from "@/lib/format"

export type Lc3ListingRow = {
  addr: number
  value: number
  line: number
  label?: string
  source: string
  kind: "code" | "data"
}

export type Lc3Program = {
  memory: Map<number, number>
  listing: Lc3ListingRow[]
  labels: Map<string, number>
  addrToLine: Map<number, number>
  lineToAddr: Map<number, number>
  entry: number
  errors: AsmError[]
}

const OPCODES = new Set([
  "ADD", "AND", "NOT", "LD", "LDI", "LDR", "LEA", "ST", "STI", "STR",
  "JMP", "JSR", "JSRR", "RET", "RTI", "TRAP",
  "GETC", "OUT", "PUTS", "IN", "PUTSP", "HALT", "NOP",
])
const DIRECTIVES = new Set([".ORIG", ".FILL", ".BLKW", ".STRINGZ", ".END"])
const TRAPS: Record<string, number> = { GETC: 0x20, OUT: 0x21, PUTS: 0x22, IN: 0x23, PUTSP: 0x24, HALT: 0x25 }

const isBr = (t: string) => /^BR[NZP]*$/i.test(t)
const isOp = (t: string) => {
  const u = t.toUpperCase()
  return OPCODES.has(u) || DIRECTIVES.has(u) || isBr(u)
}

type Parsed = {
  line: number
  label?: string
  op?: string
  args: string[]
  str?: string
  source: string
}

/** ตัด comment โดยไม่ตัด ; ที่อยู่ใน "string" */
function stripComment(s: string): string {
  let inStr = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === "\\" && inStr) {
      i++
      continue
    }
    if (c === '"') inStr = !inStr
    else if (c === ";" && !inStr) return s.slice(0, i)
  }
  return s
}

function unescape(s: string): string {
  return s.replace(/\\(.)/g, (_, c: string) => ({ n: "\n", t: "\t", r: "\r", "0": "\0", e: "\x1b" })[c] ?? c)
}

function parseLine(raw: string, line: number): Parsed | { error: string } | null {
  const text = stripComment(raw).trim()
  if (!text) return null
  let rest = text
  let str: string | undefined
  const strMatch = /"((?:[^"\\]|\\.)*)"/.exec(rest)
  if (strMatch) {
    str = unescape(strMatch[1])
    rest = rest.slice(0, strMatch.index) + rest.slice(strMatch.index + strMatch[0].length)
  }
  const toks = rest.split(/[\s,]+/).filter(Boolean)
  const p: Parsed = { line, args: [], source: raw.trim() }
  let i = 0
  if (toks[0] && !isOp(toks[0])) {
    p.label = toks[0].replace(/:$/, "").toUpperCase()
    i = 1
  }
  if (i < toks.length) {
    p.op = toks[i].toUpperCase()
    if (!isOp(p.op)) {
      // "FOO R1" — ถ้าคำที่สองเป็น register/ตัวเลข แปลว่าคำแรกคือคำสั่งที่พิมพ์ผิด ไม่ใช่ label
      const blame = i === 1 && (/^R[0-7]$/i.test(toks[1]) || parseNumber(toks[1]) !== null) ? toks[0] : toks[i]
      return { error: `ไม่รู้จักคำสั่ง "${blame}"` }
    }
    p.args = toks.slice(i + 1)
  }
  if (str !== undefined) {
    if (p.op !== ".STRINGZ") return { error: 'ใช้ "ข้อความ" ได้กับ .STRINGZ เท่านั้น' }
    p.str = str
  }
  return p
}

function sizeOf(p: Parsed): number {
  if (!p.op) return 0
  if (p.op === ".BLKW") return Math.max(0, parseNumber(p.args[0] ?? "") ?? 0)
  if (p.op === ".STRINGZ") return (p.str?.length ?? 0) + 1
  if (p.op === ".ORIG" || p.op === ".END") return 0
  return 1
}

export function assembleLc3(source: string): Lc3Program {
  const errors: AsmError[] = []
  const err = (line: number, message: string) => errors.push({ line, message, severity: "error" })
  const lines: Parsed[] = []
  source.split(/\r?\n/).forEach((raw, i) => {
    const r = parseLine(raw, i + 1)
    if (!r) return
    if ("error" in r) err(i + 1, r.error)
    else lines.push(r)
  })

  // pass 1 — หา address ของทุก label
  const labels = new Map<string, number>()
  const addrOf = new Map<Parsed, number>()
  let lc = -1
  let entry = -1
  let ended = false
  for (const p of lines) {
    if (ended) break
    if (p.op === ".ORIG") {
      const v = parseNumber(p.args[0] ?? "")
      if (v === null || v < 0 || v > 0xffff) err(p.line, ".ORIG ต้องตามด้วย address เช่น .ORIG x3000")
      else {
        lc = v
        if (entry < 0) entry = v
      }
      continue
    }
    if (p.op === ".END") {
      ended = true
      continue
    }
    if (lc < 0) {
      errors.push({ line: p.line, message: "ไม่มี .ORIG ก่อนเริ่มโค้ด — ใช้ x3000 ให้", severity: "warning" })
      lc = entry = 0x3000
    }
    if (p.label) {
      if (labels.has(p.label)) err(p.line, `label "${p.label}" ซ้ำ`)
      else labels.set(p.label, lc)
    }
    addrOf.set(p, lc)
    lc += sizeOf(p)
    if (lc > 0x10000) err(p.line, "โปรแกรมเลยหน่วยความจำ xFFFF")
  }
  if (entry < 0) entry = 0x3000

  // pass 2 — แปลงเป็นภาษาเครื่อง
  const memory = new Map<number, number>()
  const listing: Lc3ListingRow[] = []
  const addrToLine = new Map<number, number>()
  const lineToAddr = new Map<number, number>()

  for (const p of lines) {
    const base = addrOf.get(p)
    if (base === undefined || !p.op) continue
    const fail = (m: string) => err(p.line, `${p.op}: ${m}`)
    const reg = (t: string | undefined): number => {
      const m = /^R([0-7])$/i.exec(t ?? "")
      if (!m) {
        fail(`ต้องเป็นเรจิสเตอร์ R0–R7 แต่ได้ "${t ?? ""}"`)
        return 0
      }
      return +m[1]
    }
    const imm = (t: string | undefined, bits: number, signed = true): number => {
      const v = parseNumber(t ?? "")
      if (v === null) {
        fail(`ต้องเป็นตัวเลข เช่น #5 หรือ x1F แต่ได้ "${t ?? ""}"`)
        return 0
      }
      const lo = signed ? -(1 << (bits - 1)) : 0
      const hi = signed ? (1 << (bits - 1)) - 1 : (1 << bits) - 1
      if (v < lo || v > hi) fail(`ค่า ${v} เกินช่วง ${bits} บิต (${lo} ถึง ${hi})`)
      return v & ((1 << bits) - 1)
    }
    const pcoff = (t: string | undefined, bits: number): number => {
      if (!t) {
        fail("ขาด label ปลายทาง")
        return 0
      }
      const n = parseNumber(t)
      let off: number
      if (n !== null) off = n
      else {
        const target = labels.get(t.replace(/^:/, "").toUpperCase())
        if (target === undefined) {
          fail(`ไม่พบ label "${t}"`)
          return 0
        }
        off = target - (base + 1) // PC ตอน execute คือ address ของคำสั่ง + 1
      }
      const lo = -(1 << (bits - 1))
      const hi = (1 << (bits - 1)) - 1
      if (off < lo || off > hi) fail(`"${t}" อยู่ไกลเกิน (offset ${off}, PCoffset${bits} รับได้ ${lo} ถึง ${hi})`)
      return off & ((1 << bits) - 1)
    }
    const emit = (addr: number, value: number, first: boolean) => {
      memory.set(addr, value & 0xffff)
      addrToLine.set(addr, p.line)
      if (!lineToAddr.has(p.line)) lineToAddr.set(p.line, addr)
      listing.push({
        addr,
        value: value & 0xffff,
        line: p.line,
        label: first ? p.label : undefined,
        source: first ? p.source : "",
        kind: p.op!.startsWith(".") ? "data" : "code",
      })
    }
    const a = p.args
    const op = p.op
    let w: number | null = null
    if (isBr(op)) {
      const flags = op.slice(2)
      const nzp = flags ? (flags.includes("N") ? 4 : 0) | (flags.includes("Z") ? 2 : 0) | (flags.includes("P") ? 1 : 0) : 7
      w = (nzp << 9) | pcoff(a[0], 9)
    } else
      switch (op) {
        case "ADD":
        case "AND": {
          const opc = op === "ADD" ? 1 : 5
          const dr = reg(a[0])
          const sr1 = reg(a[1])
          w = /^R[0-7]$/i.test(a[2] ?? "")
            ? (opc << 12) | (dr << 9) | (sr1 << 6) | reg(a[2])
            : (opc << 12) | (dr << 9) | (sr1 << 6) | 0x20 | imm(a[2], 5)
          break
        }
        case "NOT":
          w = (9 << 12) | (reg(a[0]) << 9) | (reg(a[1]) << 6) | 0x3f
          break
        case "LD":
          w = (2 << 12) | (reg(a[0]) << 9) | pcoff(a[1], 9)
          break
        case "LDI":
          w = (10 << 12) | (reg(a[0]) << 9) | pcoff(a[1], 9)
          break
        case "LEA":
          w = (14 << 12) | (reg(a[0]) << 9) | pcoff(a[1], 9)
          break
        case "ST":
          w = (3 << 12) | (reg(a[0]) << 9) | pcoff(a[1], 9)
          break
        case "STI":
          w = (11 << 12) | (reg(a[0]) << 9) | pcoff(a[1], 9)
          break
        case "LDR":
          w = (6 << 12) | (reg(a[0]) << 9) | (reg(a[1]) << 6) | imm(a[2], 6)
          break
        case "STR":
          w = (7 << 12) | (reg(a[0]) << 9) | (reg(a[1]) << 6) | imm(a[2], 6)
          break
        case "JMP":
          w = (12 << 12) | (reg(a[0]) << 6)
          break
        case "RET":
          w = 0xc1c0
          break
        case "JSR":
          w = (4 << 12) | 0x800 | pcoff(a[0], 11)
          break
        case "JSRR":
          w = (4 << 12) | (reg(a[0]) << 6)
          break
        case "RTI":
          w = 0x8000
          break
        case "NOP":
          w = 0
          break
        case "TRAP":
          w = 0xf000 | imm(a[0], 8, false)
          break
        case ".FILL": {
          const n = parseNumber(a[0] ?? "")
          if (n !== null) {
            if (n < -32768 || n > 0xffff) fail(`ค่า ${n} เกิน 16 บิต`)
            w = n & 0xffff
          } else {
            const l = labels.get((a[0] ?? "").toUpperCase())
            if (l === undefined) fail(`ต้องเป็นตัวเลขหรือ label แต่ได้ "${a[0] ?? ""}"`)
            w = l ?? 0
          }
          break
        }
        case ".BLKW": {
          const n = parseNumber(a[0] ?? "")
          if (n === null || n <= 0) fail("ต้องบอกจำนวนช่อง เช่น .BLKW 3")
          const fill = a[1] !== undefined ? (parseNumber(a[1]) ?? 0) & 0xffff : 0
          for (let k = 0; k < (n ?? 0); k++) emit(base + k, fill, k === 0)
          break
        }
        case ".STRINGZ": {
          if (p.str === undefined) {
            fail('ต้องตามด้วยข้อความในเครื่องหมายคำพูด เช่น .STRINGZ "Hello"')
            break
          }
          const s = p.str
          for (let k = 0; k < s.length; k++) emit(base + k, s.charCodeAt(k), k === 0)
          emit(base + s.length, 0, s.length === 0)
          break
        }
        default:
          if (op in TRAPS) w = 0xf000 | TRAPS[op]
      }
    if (w !== null) emit(base, w, true)
  }

  listing.sort((x, y) => x.addr - y.addr)
  errors.sort((x, y) => x.line - y.line)
  return { memory, listing, labels, addrToLine, lineToAddr, entry, errors }
}

export function describeAddr(addr: number, labelAt: Map<number, string>): string {
  const l = labelAt.get(addr)
  return l ? `${l} (${hex(addr, 4)})` : hex(addr, 4)
}
