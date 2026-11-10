// ตัวช่วยแปลงตัวเลขให้อ่านง่าย ใช้ร่วมกันทั้ง Stack CPU และ LC3

export type NumFormat = "dec" | "signed" | "hex"

export function toSigned(v: number, bits: number): number {
  const sign = 1 << (bits - 1)
  return v & sign ? v - (1 << bits) : v
}

export function hex(v: number, digits: number): string {
  return "x" + (v >>> 0).toString(16).toUpperCase().padStart(digits, "0")
}

export function fmt(v: number, bits: number, f: NumFormat): string {
  if (f === "hex") return hex(v, bits / 4)
  if (f === "signed") return String(toSigned(v, bits))
  return String(v)
}

/** ตัวอักษรที่พิมพ์ได้ ใช้แสดงคู่กับค่า เช่น x41 → 'A' */
export function printable(v: number): string | null {
  return v >= 32 && v < 127 ? String.fromCharCode(v) : null
}

/**
 * อ่านตัวเลขรูปแบบที่ใช้ในวิชา: 10, -5, #10, x80, 0x80, b1010, 'A'
 * คืน null ถ้าไม่ใช่ตัวเลข
 */
export function parseNumber(tok: string): number | null {
  const t = tok.trim()
  if (/^[-+]?\d+$/.test(t)) return parseInt(t, 10)
  if (/^#[-+]?\d+$/.test(t)) return parseInt(t.slice(1), 10)
  let m = /^(-?)0?[xX]([0-9a-fA-F]+)$/.exec(t)
  if (m) return (m[1] ? -1 : 1) * parseInt(m[2], 16)
  m = /^(-?)0?[bB]([01]+)$/.exec(t)
  if (m) return (m[1] ? -1 : 1) * parseInt(m[2], 2)
  m = /^'(.)'$/.exec(t)
  if (m) return m[1].charCodeAt(0)
  return null
}

export type AsmError = { line: number; message: string; severity: "error" | "warning" }
