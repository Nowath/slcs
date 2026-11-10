// แยกบรรทัดเป็น token สำหรับระบายสีใน editor (ไม่ต้องแม่นเท่า assembler แค่ให้อ่านง่าย)
import { STACK_OPS } from "@/lib/stack/cpu"

export type TokKind = "op" | "num" | "label" | "reg" | "dir" | "comment" | "str" | "plain"
export type Tok = { text: string; kind: TokKind }
export type Lang = "stack" | "lc3"

const STACK_WORDS = new Set(STACK_OPS.flatMap((o) => [o.name, ...o.aliases]))
const LC3_WORDS = new Set([
  "ADD", "AND", "NOT", "LD", "LDI", "LDR", "LEA", "ST", "STI", "STR", "JMP", "JSR", "JSRR",
  "RET", "RTI", "TRAP", "GETC", "OUT", "PUTS", "IN", "PUTSP", "HALT", "NOP",
])
const NUM = /^(#?[-+]?\d+|-?0?[xX][0-9a-fA-F]+|-?0?[bB][01]+|'.')$/

function classify(word: string, lang: Lang): TokKind {
  const u = word.toUpperCase()
  if (lang === "stack") {
    if (STACK_WORDS.has(u)) return "op"
    if (NUM.test(word)) return "num"
    return "label"
  }
  if (u.startsWith(".")) return "dir"
  if (LC3_WORDS.has(u) || /^BR[NZP]*$/.test(u)) return "op"
  if (/^R[0-7]$/.test(u)) return "reg"
  if (NUM.test(word)) return "num"
  return "label"
}

export function highlightLine(line: string, lang: Lang): Tok[] {
  const out: Tok[] = []
  let i = 0
  // รูปแบบ "Address 0:" จากชีท ให้จางลงเพราะเป็นแค่เลขกำกับ
  const addr = lang === "stack" ? /^\s*address\s+\d+\s*:/i.exec(line) : null
  if (addr) {
    out.push({ text: addr[0], kind: "comment" })
    i = addr[0].length
  }
  while (i < line.length) {
    const rest = line.slice(i)
    if (rest.startsWith(";") || (lang === "stack" && rest.startsWith("//"))) {
      out.push({ text: rest, kind: "comment" })
      break
    }
    if (lang === "lc3" && rest[0] === '"') {
      const m = /^"(?:[^"\\]|\\.)*"?/.exec(rest)!
      out.push({ text: m[0], kind: "str" })
      i += m[0].length
      continue
    }
    const ws = /^[\s,]+/.exec(rest)
    if (ws) {
      out.push({ text: ws[0], kind: "plain" })
      i += ws[0].length
      continue
    }
    const w = /^[^\s,;"]+/.exec(rest)
    const word = w ? w[0] : rest[0]
    // "//" ในโหมด stack ต้องตัด comment ออกจากคำที่ติดกัน
    const cut = lang === "stack" ? word.indexOf("//") : -1
    const text = cut > 0 ? word.slice(0, cut) : word
    out.push({ text, kind: classify(text, lang) })
    i += text.length
  }
  return out
}

export const TOK_CLASS: Record<TokKind, string> = {
  op: "text-syn-op font-semibold",
  num: "text-syn-num",
  label: "text-syn-label",
  reg: "text-syn-reg",
  dir: "text-syn-dir",
  comment: "text-syn-comment", // ไม่ใช้ italic — ไทยไม่มีตัวเอนจริง เบราว์เซอร์เอียงเองแล้วดูเบี้ยว
  str: "text-syn-num",
  plain: "",
}
