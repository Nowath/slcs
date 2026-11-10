import { hex } from "@/lib/format"

const TRAP_NAMES: Record<number, string> = { 0x20: "GETC", 0x21: "OUT", 0x22: "PUTS", 0x23: "IN", 0x24: "PUTSP", 0x25: "HALT" }

/** แปลงภาษาเครื่อง 16 บิตกลับเป็น assembly (ใช้ label ถ้ารู้จัก) */
export function disassemble(ir: number, addr: number, labelAt: Map<number, string>): string {
  const op = ir >> 12
  const dr = (ir >> 9) & 7
  const sr1 = (ir >> 6) & 7
  const sx = (bits: number) => {
    const v = ir & ((1 << bits) - 1)
    return v & (1 << (bits - 1)) ? v - (1 << bits) : v
  }
  const target = (bits: number) => {
    const t = (addr + 1 + sx(bits)) & 0xffff
    return labelAt.get(t) ?? hex(t, 4)
  }
  switch (op) {
    case 0: {
      const f = `${(ir >> 11) & 1 ? "n" : ""}${(ir >> 10) & 1 ? "z" : ""}${(ir >> 9) & 1 ? "p" : ""}`
      if (!f) return "NOP"
      return `BR${f === "nzp" ? "" : f} ${target(9)}`
    }
    case 1:
    case 5: {
      const name = op === 1 ? "ADD" : "AND"
      return (ir >> 5) & 1 ? `${name} R${dr}, R${sr1}, #${sx(5)}` : `${name} R${dr}, R${sr1}, R${ir & 7}`
    }
    case 9:
      return `NOT R${dr}, R${sr1}`
    case 2:
      return `LD R${dr}, ${target(9)}`
    case 10:
      return `LDI R${dr}, ${target(9)}`
    case 14:
      return `LEA R${dr}, ${target(9)}`
    case 3:
      return `ST R${dr}, ${target(9)}`
    case 11:
      return `STI R${dr}, ${target(9)}`
    case 6:
      return `LDR R${dr}, R${sr1}, #${sx(6)}`
    case 7:
      return `STR R${dr}, R${sr1}, #${sx(6)}`
    case 12:
      return sr1 === 7 ? "RET" : `JMP R${sr1}`
    case 4:
      return (ir >> 11) & 1 ? `JSR ${target(11)}` : `JSRR R${sr1}`
    case 8:
      return "RTI"
    case 15:
      return TRAP_NAMES[ir & 0xff] ?? `TRAP ${hex(ir & 0xff, 2)}`
    default:
      return ".FILL " + hex(ir, 4)
  }
}
