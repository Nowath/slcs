// ตัวจำลอง LC3 16 บิต ตามบทที่ 10–11 (TRAP ทำงานแบบ native ถ้าโปรแกรมไม่ได้ใส่ trap vector เอง)
import { hex, printable, toSigned } from "@/lib/format"
import type { Lc3Program } from "./assembler"
import { disassemble } from "./disasm"

export const KBSR = 0xfe00
export const KBDR = 0xfe02
export const DSR = 0xfe04
export const DDR = 0xfe06
export const MCR = 0xfffe

export type CC = "N" | "Z" | "P"

export type Lc3Trace = {
  n: number
  addr: number
  text: string
  note: string
  changed: string[]
}

type Undo = {
  pc: number
  r: number[]
  cc: CC
  mem: { addr: number; old: number }[]
  outLen: number
  inPos: number
  halted: boolean
  error: string | null
  promptShown: boolean
  trace: Lc3Trace
}

const MAX_HISTORY = 50_000

export class Lc3Machine {
  mem = new Uint16Array(0x10000)
  r = [0, 0, 0, 0, 0, 0, 0, 0]
  pc: number
  cc: CC = "Z"
  ir = 0
  halted = false
  error: string | null = null
  /** โปรแกรมกำลังรอ input จากคีย์บอร์ด (GETC/IN หรือวนอ่าน KBSR) */
  waitingInput = false
  output = ""
  input = ""
  inPos = 0
  steps = 0
  history: Undo[] = []
  labelAt = new Map<number, string>()
  lastWrites: number[] = []
  private promptShown = false
  private pendingMem: { addr: number; old: number }[] = []

  constructor(prog: Lc3Program) {
    for (const [a, v] of prog.memory) this.mem[a] = v
    for (const [k, v] of prog.labels) if (!this.labelAt.has(v)) this.labelAt.set(v, k)
    this.pc = prog.entry
  }

  get done() {
    return this.halted || this.error !== null
  }

  get inputAvailable() {
    return this.inPos < this.input.length
  }

  feed(text: string) {
    this.input += text
    this.waitingInput = false
  }

  private setCC(v: number) {
    const s = toSigned(v, 16)
    this.cc = s < 0 ? "N" : s === 0 ? "Z" : "P"
  }

  private read(a: number): number {
    if (a === KBSR) {
      if (!this.inputAvailable) this.waitingInput = true
      return this.inputAvailable ? 0x8000 : 0
    }
    if (a === KBDR) return this.inputAvailable ? this.input.charCodeAt(this.inPos++) & 0xff : 0
    if (a === DSR) return 0x8000 // จอพร้อมรับตัวอักษรเสมอ
    return this.mem[a]
  }

  private write(a: number, v: number) {
    v &= 0xffff
    if (a === DDR) {
      this.output += String.fromCharCode(v & 0xff)
      return
    }
    this.pendingMem.push({ addr: a, old: this.mem[a] })
    this.mem[a] = v
    this.lastWrites.push(a)
    if (a === MCR && !(v & 0x8000)) this.halted = true
  }

  private name(a: number) {
    const l = this.labelAt.get(a)
    return l ? `${l} (${hex(a, 4)})` : hex(a, 4)
  }

  private val(v: number) {
    const s = toSigned(v, 16)
    const c = printable(v)
    return `${hex(v, 4)} (${s}${c ? ` '${c}'` : ""})`
  }

  step(): Lc3Trace | null {
    if (this.done) return null
    const before = {
      pc: this.pc,
      r: this.r.slice(),
      cc: this.cc,
      outLen: this.output.length,
      inPos: this.inPos,
      halted: this.halted,
      error: this.error,
      promptShown: this.promptShown,
    }
    this.pendingMem = []
    this.lastWrites = []
    const addr = this.pc
    const ir = this.mem[addr]
    this.ir = ir
    const text = disassemble(ir, addr, this.labelAt)
    let pc = (addr + 1) & 0xffff
    const op = ir >> 12
    const dr = (ir >> 9) & 7
    const sr1 = (ir >> 6) & 7
    const sx = (bits: number) => {
      const v = ir & ((1 << bits) - 1)
      return v & (1 << (bits - 1)) ? v - (1 << bits) : v
    }
    let note = ""
    const changed: string[] = []
    const setR = (i: number, v: number, cc = true) => {
      this.r[i] = v & 0xffff
      changed.push(`R${i}`)
      if (cc) this.setCC(v & 0xffff)
    }

    switch (op) {
      case 0: {
        const n = (ir >> 11) & 1, z = (ir >> 10) & 1, p = (ir >> 9) & 1
        const take = (n && this.cc === "N") || (z && this.cc === "Z") || (p && this.cc === "P")
        const flags = `${n ? "n" : ""}${z ? "z" : ""}${p ? "p" : ""}`
        if (!flags) note = "NOP (BR ที่ไม่มี n/z/p ไม่กระโดดเลย)"
        else if (take) {
          pc = (pc + sx(9)) & 0xffff
          note = n && z && p ? `กระโดดเสมอ → ${this.name(pc)}` : `CC = ${this.cc} ตรงกับ ${flags} → กระโดดไป ${this.name(pc)}`
        } else note = `CC = ${this.cc} ไม่ตรงกับ ${flags} → ไม่กระโดด`
        break
      }
      case 1:
      case 5: {
        const a = this.r[sr1]
        const immMode = (ir >> 5) & 1
        const b = immMode ? sx(5) & 0xffff : this.r[ir & 7]
        const bTxt = immMode ? `#${sx(5)}` : `R${ir & 7}`
        const res = op === 1 ? (a + b) & 0xffff : a & b
        setR(dr, res)
        note =
          op === 1
            ? `R${dr} = R${sr1} + ${bTxt} = ${toSigned(a, 16)} + ${toSigned(b, 16)} = ${toSigned(res, 16)}`
            : `R${dr} = R${sr1} AND ${bTxt} = ${hex(a, 4)} & ${hex(b, 4)} = ${hex(res, 4)}`
        note += ` · CC=${this.cc}`
        break
      }
      case 9: {
        const res = ~this.r[sr1] & 0xffff
        setR(dr, res)
        note = `R${dr} = NOT R${sr1} = ${this.val(res)} · CC=${this.cc}`
        break
      }
      case 2: {
        const ea = (pc + sx(9)) & 0xffff
        const v = this.read(ea)
        setR(dr, v)
        note = `R${dr} ← M[${this.name(ea)}] = ${this.val(v)} · CC=${this.cc}`
        break
      }
      case 10: {
        const p1 = (pc + sx(9)) & 0xffff
        const ea = this.read(p1)
        const v = this.read(ea)
        setR(dr, v)
        note = `M[${this.name(p1)}] = ${hex(ea, 4)} เป็น pointer → R${dr} ← M[${hex(ea, 4)}] = ${this.val(v)} · CC=${this.cc}`
        break
      }
      case 6: {
        const ea = (this.r[sr1] + sx(6)) & 0xffff
        const v = this.read(ea)
        setR(dr, v)
        note = `R${dr} ← M[R${sr1} + ${sx(6)}] = M[${hex(ea, 4)}] = ${this.val(v)} · CC=${this.cc}`
        break
      }
      case 14: {
        const ea = (pc + sx(9)) & 0xffff
        setR(dr, ea) // ตามชีท LEA+ ตั้ง condition code ด้วย
        note = `R${dr} ← address ของ ${this.name(ea)} (ไม่ได้อ่านหน่วยความจำ) · CC=${this.cc}`
        break
      }
      case 3: {
        const ea = (pc + sx(9)) & 0xffff
        this.write(ea, this.r[dr])
        note = `M[${this.name(ea)}] ← R${dr} = ${this.val(this.r[dr])}`
        break
      }
      case 11: {
        const p1 = (pc + sx(9)) & 0xffff
        const ea = this.read(p1)
        this.write(ea, this.r[dr])
        note = `M[${this.name(p1)}] = ${hex(ea, 4)} เป็น pointer → M[${hex(ea, 4)}] ← R${dr} = ${this.val(this.r[dr])}`
        break
      }
      case 7: {
        const ea = (this.r[sr1] + sx(6)) & 0xffff
        this.write(ea, this.r[dr])
        note = `M[R${sr1} + ${sx(6)}] = M[${hex(ea, 4)}] ← R${dr} = ${this.val(this.r[dr])}`
        break
      }
      case 12: {
        pc = this.r[sr1]
        note = sr1 === 7 ? `RET: PC ← R7 = ${this.name(pc)}` : `PC ← R${sr1} = ${this.name(pc)}`
        break
      }
      case 4: {
        const ret = pc
        pc = (ir >> 11) & 1 ? (pc + sx(11)) & 0xffff : this.r[sr1]
        setR(7, ret, false)
        note = `R7 ← ${hex(ret, 4)} (return address) แล้ว PC ← ${this.name(pc)}`
        break
      }
      case 8: {
        pc = this.r[7]
        note = `RTI: PC ← R7 = ${this.name(pc)}`
        break
      }
      case 15: {
        const vec = ir & 0xff
        const handler = this.mem[vec]
        if (handler !== 0) {
          // โปรแกรมใส่ trap vector table มาเอง → ทำแบบเครื่องจริง
          setR(7, pc, false)
          pc = handler
          note = `R7 ← ${hex(this.r[7], 4)}, PC ← M[${hex(vec, 2)}] = ${this.name(pc)}`
          break
        }
        const r = this.nativeTrap(vec, pc, changed)
        if (r === "wait") {
          // ยังไม่มี input → ไม่เปลี่ยน state ให้รันซ้ำเมื่อพิมพ์แล้ว
          this.r = before.r
          return null
        }
        note = r
        break
      }
      default:
        this.error = `${hex(ir, 4)} ที่ ${hex(addr, 4)} ไม่ใช่คำสั่งที่ถูกต้อง (opcode 1101 สงวนไว้)`
        note = this.error
    }
    if (!this.error) this.pc = pc
    this.steps++
    if (!this.halted) this.waitingInput = this.waitingInput && !this.inputAvailable
    const trace: Lc3Trace = { n: this.steps, addr, text, note, changed }
    this.history.push({ ...before, mem: this.pendingMem, trace })
    if (this.history.length > MAX_HISTORY) this.history.shift()
    return trace
  }

  private nativeTrap(vec: number, pc: number, changed: string[]): string | "wait" {
    const setR0 = (v: number) => {
      this.r[0] = v & 0xffff
      changed.push("R0")
    }
    switch (vec) {
      case 0x20: {
        if (!this.inputAvailable) {
          this.waitingInput = true
          return "wait"
        }
        const c = this.input.charCodeAt(this.inPos++) & 0xff
        setR0(c)
        this.r[7] = pc
        changed.push("R7")
        return `GETC: R0 ← ${this.val(c)} จากคีย์บอร์ด (R7 ← ${hex(pc, 4)})`
      }
      case 0x21: {
        const c = this.r[0] & 0xff
        this.output += String.fromCharCode(c)
        this.r[7] = pc
        changed.push("R7")
        return `OUT: พิมพ์ R0 = ${this.val(c)} ออกจอ`
      }
      case 0x22:
      case 0x24: {
        let a = this.r[0]
        let s = ""
        for (let guard = 0; guard < 0x10000 && this.mem[a] !== 0; guard++, a = (a + 1) & 0xffff) {
          const w = this.mem[a]
          if (vec === 0x22) s += String.fromCharCode(w & 0xff)
          else {
            s += String.fromCharCode(w & 0xff)
            if (w >> 8) s += String.fromCharCode(w >> 8)
            else break
          }
        }
        this.output += s
        this.r[7] = pc
        changed.push("R7")
        return `${vec === 0x22 ? "PUTS" : "PUTSP"}: พิมพ์ string ที่ ${this.name(this.r[0])} = "${s.replace(/\n/g, "\\n")}"`
      }
      case 0x23: {
        if (!this.promptShown) {
          this.output += "\nInput a character> "
          this.promptShown = true
        }
        if (!this.inputAvailable) {
          this.waitingInput = true
          return "wait"
        }
        this.promptShown = false
        const c = this.input.charCodeAt(this.inPos++) & 0xff
        this.output += String.fromCharCode(c) + "\n"
        setR0(c)
        this.r[7] = pc
        changed.push("R7")
        return `IN: R0 ← ${this.val(c)} (แสดง prompt และ echo ตัวที่พิมพ์)`
      }
      case 0x25:
        this.halted = true
        this.r[7] = pc
        changed.push("R7")
        return "HALT: หยุดการทำงาน"
      default:
        this.error = `TRAP ${hex(vec, 2)} ไม่มี routine (รองรับ x20–x25)`
        return this.error
    }
  }

  back(): boolean {
    const u = this.history.pop()
    if (!u) return false
    this.pc = u.pc
    this.r = u.r
    this.cc = u.cc
    for (let i = u.mem.length - 1; i >= 0; i--) this.mem[u.mem[i].addr] = u.mem[i].old
    this.output = this.output.slice(0, u.outLen)
    this.inPos = u.inPos
    this.halted = u.halted
    this.error = u.error
    this.promptShown = u.promptShown
    this.waitingInput = false
    this.steps--
    this.lastWrites = []
    return true
  }
}
