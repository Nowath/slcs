// ตรวจ LC3 เทียบกับชีทบทที่ 10–11, Quiz 10 และ encoding มาตรฐาน
import { describe, expect, test } from "bun:test"
import { assembleLc3 } from "@/lib/lc3/assembler"
import { Lc3Machine } from "@/lib/lc3/cpu"
import { disassemble } from "@/lib/lc3/disasm"
import { LC3_EXAMPLES } from "@/config/examples"

function asm(src: string) {
  const p = assembleLc3(src)
  const errs = p.errors.filter((e) => e.severity === "error")
  if (errs.length) throw new Error(JSON.stringify(errs))
  return p
}
function run(src: string, input = "", limit = 1_000_000) {
  const m = new Lc3Machine(asm(src))
  m.feed(input)
  let n = 0
  while (!m.done && n++ < limit) {
    const t = m.step()
    if (!t && m.waitingInput) break
  }
  return m
}
const words = (src: string) => asm(src).listing.map((r) => r.value)
const prog = (body: string) => `.ORIG x3000\n${body}\nHALT\n.END`

describe("LC3: ภาษาเครื่องตรงกับชีท", () => {
  test("แบบฝึกหัดข้อ 1 บทที่ 10 (x2204 x2404 x1042 x3003 xF025)", () => {
    const p = asm(`.ORIG x3000
LD R1, OPER1
LD R2, OPER2
ADD R0, R1, R2
ST R0, RESULT
HALT
OPER1 .FILL x0001
OPER2 .FILL x0002
RESULT .FILL x0000
.END`)
    expect(p.listing.map((r) => r.value)).toEqual([0x2204, 0x2404, 0x1042, 0x3003, 0xf025, 1, 2, 0])
  })
  test("ภาพ simulator ในชีท: ADD R3, R1, R2 = x1642, ST R3 (offset 3) = x3603", () => {
    expect(words(".ORIG x3000\nADD R3, R1, R2\n.END")).toEqual([0x1642])
    expect(words(".ORIG x3003\nST R3, X\nNOP\nNOP\nNOP\nX .FILL 0\n.END")[0]).toBe(0x3603) // X = x3007
  })
  test("แบบฝึกหัด LEA/JMP: LEA R0, AAA (offset 1) = xE001, JMP R0 = xC000", () => {
    expect(words(".ORIG x3000\nLEA R0, AAA\nJMP R0\nAAA HALT\n.END").slice(0, 2)).toEqual([0xe001, 0xc000])
  })
  test("encoding มาตรฐานของทุกรูปแบบคำสั่ง", () => {
    const cases: [string, number][] = [
      ["ADD R1, R1, #-1", 0x127f],
      ["AND R3, R3, #0", 0x56e0],
      ["AND R0, R1, R2", 0x5042],
      ["NOT R4, R4", 0x993f],
      ["LDR R0, R6, #0", 0x6180],
      ["STR R7, R6, #-1", 0x7fbf],
      ["JMP R2", 0xc080],
      ["RET", 0xc1c0],
      ["JSRR R3", 0x40c0],
      ["RTI", 0x8000],
      ["TRAP x23", 0xf023],
      ["GETC", 0xf020],
      ["OUT", 0xf021],
      ["PUTS", 0xf022],
      ["IN", 0xf023],
      ["PUTSP", 0xf024],
      ["HALT", 0xf025],
    ]
    for (const [src, w] of cases) expect(words(`.ORIG x3000\n${src}\n.END`)[0]).toBe(w)
  })
  test("BR ทุก flag และ offset ย้อนหลัง", () => {
    const p = (br: string) => words(`.ORIG x3000\nL ${br} L\n.END`)[0]
    expect(p("BRn")).toBe(0x09ff)
    expect(p("BRz")).toBe(0x05ff)
    expect(p("BRp")).toBe(0x03ff)
    expect(p("BRzp")).toBe(0x07ff)
    expect(p("BRnp")).toBe(0x0bff)
    expect(p("BR")).toBe(0x0fff)
    expect(p("BRnzp")).toBe(0x0fff)
  })
  test("JSR offset 11 บิต", () => {
    expect(words(".ORIG x3000\nJSR F\nNOP\nF RET\n.END")[0]).toBe(0x4801)
  })
  test("assemble → disassemble → assemble ได้ค่าเดิม", () => {
    const src = `.ORIG x3000
L1 ADD R1, R2, #-16
AND R7, R0, #15
NOT R2, R5
LD R3, L1
LDI R4, L1
LEA R5, L1
ST R6, L1
STI R0, L1
LDR R1, R2, #-32
STR R1, R2, #31
BRnp L1
JSR L1
JSRR R4
JMP R6
RET
TRAP x25
.END`
    const p = asm(src)
    const labels = new Map([[0x3000, "L1"]])
    const back = p.listing.map((r) => disassemble(r.value, r.addr, labels))
    const p2 = asm(`.ORIG x3000\nL1 ${back.join("\n")}\n.END`)
    expect(p2.listing.map((r) => r.value)).toEqual(p.listing.map((r) => r.value))
  })
  test(".STRINGZ (มี null ปิดท้าย + escape) / .BLKW / .FILL label", () => {
    const p = asm('.ORIG x3000\nS .STRINGZ "Hi\\n"\nB .BLKW 2\nP .FILL S\n.END')
    expect(p.listing.map((r) => r.value)).toEqual([72, 105, 10, 0, 0, 0, 0x3000])
    expect(p.labels.get("B")).toBe(0x3004)
  })
  test("ค่าเกินช่วงต้องเป็น error", () => {
    expect(assembleLc3(".ORIG x3000\nADD R1, R1, #16\n.END").errors[0].message).toContain("เกินช่วง")
    expect(assembleLc3(".ORIG x3000\nADD R1, R1, #-17\n.END").errors.length).toBe(1)
    expect(assembleLc3(".ORIG x3000\nLD R1, FAR\n.BLKW 300\nFAR .FILL 0\n.END").errors[0].message).toContain("ไกลเกิน")
    expect(assembleLc3(".ORIG x3000\nADD R8, R1, R1\n.END").errors.length).toBe(1)
  })
})

describe("LC3: ข้อความ error", () => {
  test("FOO R1 ชี้ที่ FOO และเรียงตามบรรทัด", () => {
    const e = assembleLc3(".ORIG x3000\nADD R1, R1, #20\nLD R2, NOWHERE\nFOO R1\nHALT\n.END").errors
    expect(e.map((x) => x.line)).toEqual([2, 3, 4])
    expect(e[2].message).toContain('"FOO"')
  })
  test("label + คำสั่งพิมพ์ผิด ยังชี้ที่คำสั่ง", () => {
    expect(assembleLc3(".ORIG x3000\nLOOP ADDD R1, R1, #1\n.END").errors[0].message).toContain('"ADDD"')
  })
})

describe("LC3: การทำงานของแต่ละคำสั่ง", () => {
  test("ADD/AND/NOT และ CC", () => {
    let m = run(prog("AND R0, R0, #0\nADD R0, R0, #-5"))
    expect(m.r[0]).toBe(0xfffb)
    m = run(prog("AND R0, R0, #0\nADD R0, R0, #-5\nNOT R1, R0"))
    expect(m.r[1]).toBe(4)
  })
  test("CC ตั้งตามค่าที่เขียน: N/Z/P", () => {
    const cc = (body: string) => {
      const mm = new Lc3Machine(asm(prog(body)))
      for (let i = 0; i < body.split("\n").length; i++) mm.step()
      return mm.cc
    }
    expect(cc("AND R0, R0, #0")).toBe("Z")
    expect(cc("AND R0, R0, #0\nADD R0, R0, #-1")).toBe("N")
    expect(cc("AND R0, R0, #0\nADD R0, R0, #1")).toBe("P")
  })
  test("ST/BR ไม่เปลี่ยน CC (Quiz 10: BR ติดกันได้)", () => {
    const mm = new Lc3Machine(asm(prog("AND R0, R0, #0\nADD R0, R0, #-1\nST R0, X\nBRz X\nX .FILL 0")))
    for (let i = 0; i < 4; i++) mm.step()
    expect(mm.cc).toBe("N")
  })
  test("LD / LDI / LDR / LEA", () => {
    const m = run(`.ORIG x3000
LD R0, A
LDI R1, PTR
LEA R2, A
LDR R3, R2, #1
HALT
A .FILL #7
B .FILL #9
PTR .FILL B
.END`)
    expect(m.r.slice(0, 4)).toEqual([7, 9, 0x3005, 9])
  })
  test("ST / STI / STR เขียนถูกที่", () => {
    const m = run(`.ORIG x3000
AND R0, R0, #0
ADD R0, R0, #5
ST R0, A
STI R0, PTR
LEA R1, C
STR R0, R1, #0
HALT
A .FILL 0
B .FILL 0
C .FILL 0
PTR .FILL B
.END`)
    expect([m.mem[0x3007], m.mem[0x3008], m.mem[0x3009]]).toEqual([5, 5, 5])
  })
  test("BR: กระโดดเมื่อ flag ตรง CC เท่านั้น", () => {
    for (const [setup, br, jumps] of [
      ["#-1", "BRn", true],
      ["#-1", "BRzp", false],
      ["#0", "BRz", true],
      ["#0", "BRnp", false],
      ["#1", "BRp", true],
      ["#1", "BRnz", false],
      ["#1", "BRnzp", true],
    ] as const) {
      // ล้าง R1 ก่อน เพราะ AND ก็ตั้ง CC — ต้องให้คำสั่งก่อน BR เป็นตัวที่กำหนด CC
      const m = run(`.ORIG x3000
AND R1, R1, #0
AND R0, R0, #0
ADD R0, R0, ${setup}
${br} SKIP
ADD R1, R1, #1
SKIP HALT
.END`)
      expect(m.r[1]).toBe(jumps ? 0 : 1)
    }
  })
  test("JSR เก็บ return address ใน R7 แล้ว RET กลับมา", () => {
    const m = run(`.ORIG x3000
JSR F
ADD R2, R2, #1
HALT
F ADD R1, R1, #3
RET
.END`)
    expect(m.r[1]).toBe(3)
    expect(m.r[2]).toBe(1)
  })
  test("JSRR / JMP", () => {
    const m = run(`.ORIG x3000
LEA R3, F
JSRR R3
HALT
F LEA R4, G
JMP R4
ADD R0, R0, #1
G ADD R5, R5, #2
RET
.END`)
    expect(m.r[5]).toBe(2)
    expect(m.r[0]).toBe(0)
  })
  test("TRAP ทับ R7 (ตามที่ชีทเตือน)", () => {
    const m = run(prog("OUT"))
    expect(m.r[7]).toBe(0x3002) // R7 ← PC หลัง HALT ที่ x3001
  })
  test("ADD ล้น 16 บิต: x7FFF + 1 = x8000 (CC=N)", () => {
    const m = run(".ORIG x3000\nLD R0, M\nADD R0, R0, #1\nHALT\nM .FILL x7FFF\n.END")
    expect(m.r[0]).toBe(0x8000)
    expect(m.cc).toBe("N")
  })
})

describe("LC3: I/O และ TRAP", () => {
  test("PUTS / OUT / GETC / IN", () => {
    expect(run(LC3_EXAMPLES.find((e) => e.id === "hello")!.code).output).toBe("Hello, World!\n")
    const m = run(prog("GETC\nOUT\nGETC\nOUT"), "ok")
    expect(m.output).toBe("ok")
  })
  test("ตัวอย่างแปลงตัวพิมพ์: ABC แล้วจบด้วย 7", () => {
    const m = run(LC3_EXAMPLES.find((e) => e.id === "lower")!.code, "ABC7")
    expect(m.halted).toBe(true)
    expect(m.output.replace(/\nInput a character> .\n/g, "|")).toBe("|a|b|c|")
  })
  test("ไม่มี input → หยุดรอ ไม่วนค้าง และพิมพ์แล้วทำต่อได้", () => {
    const m = run(prog("GETC\nOUT"))
    expect(m.waitingInput).toBe(true)
    expect(m.halted).toBe(false)
    m.feed("Z")
    while (!m.done) m.step()
    expect(m.output).toBe("Z")
  })
  test("memory-mapped I/O (วนเช็ก KBSR/DSR)", () => {
    expect(run(LC3_EXAMPLES.find((e) => e.id === "poll")!.code, "Q").output).toBe("Q")
  })
  test("ใส่ trap vector table เอง → กระโดดไป routine จริง แล้ว RET กลับ", () => {
    const m = run(`.ORIG x3000
TRAP x21
HALT
.ORIG x0021
.FILL x0400
.ORIG x0400
ADD R1, R1, #9
RET
.END`)
    expect(m.r[1]).toBe(9)
    expect(m.output).toBe("") // ไม่ได้ใช้ OUT แบบ native
    expect(m.halted).toBe(true)
  })
})

describe("LC3: Quiz 10 GCD", () => {
  const main = (a: number, b: number) => `        .ORIG x3000
        LD   R6, STK
        LD   R0, A1
        ADD  R6, R6, #-1
        STR  R0, R6, #0
        LD   R0, A2
        ADD  R6, R6, #-1
        STR  R0, R6, #0
        JSR  GCD
        LDR  R0, R6, #0
        ADD  R6, R6, #3
        ST   R0, RES
        HALT
A1      .FILL #${a}
A2      .FILL #${b}
RES     .FILL #0
STK     .FILL xFE00
GCD     ADD  R6, R6, #-1
        ADD  R6, R6, #-1
        STR  R7, R6, #0
        ADD  R6, R6, #-1
        STR  R5, R6, #0
        ADD  R5, R6, #0
        LDR  R1, R5, #4
        LDR  R2, R5, #3
`
  const epilogue = `        ADD  R6, R5, #0
        LDR  R5, R6, #0
        LDR  R7, R6, #1
        ADD  R6, R6, #2
        RET
        .END`
  const iterative = (a: number, b: number) =>
    main(a, b) +
    `WHILE NOT   R3, R2
      ADD   R3, R3, #1
      ADD   R3, R1, R3
      BRz   END
      BRn   ELSE
IF    NOT   R3, R2
      ADD   R3, R3, #1
      ADD   R1, R1, R3
      BRnzp WHILE
ELSE  NOT   R3, R1
      ADD   R3, R3, #1
      ADD   R2, R2, R3
      BRnzp WHILE
END   STR   R1, R5, #2
` + epilogue
  const recursive = (a: number, b: number) =>
    main(a, b) +
    `      ADD   R2, R2, #0
      BRz   END
      NOT   R3, R2
      ADD   R3, R3, #1
      ADD   R3, R1, R3
      BRnz  ELSE
      ADD   R6, R6, #-1
      STR   R3, R6, #0
      ADD   R6, R6, #-1
      STR   R2, R6, #0
      JSR   GCD
      LDR   R1, R6, #0
      ADD   R6, R6, #3
      BRnzp END
ELSE  NOT   R3, R3
      ADD   R3, R3, #1
      ADD   R6, R6, #-1
      STR   R3, R6, #0
      ADD   R6, R6, #-1
      STR   R1, R6, #0
      JSR   GCD
      LDR   R1, R6, #0
      ADD   R6, R6, #3
END   STR   R1, R5, #2
` + epilogue
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

  test("gcd(24, 30) = 6 ทั้งสองแบบ", () => {
    expect(run(iterative(24, 30)).mem[0x300e]).toBe(6)
    expect(run(recursive(24, 30)).mem[0x300e]).toBe(6)
  })
  test("ทุกคู่ 1–40 ตรงกับ gcd จริง และ stack pointer กลับที่เดิม", () => {
    for (let a = 1; a <= 40; a++)
      for (let b = 1; b <= 40; b++) {
        const g = gcd(a, b)
        const mi = run(iterative(a, b))
        expect(mi.mem[0x300e]).toBe(g)
        expect(mi.r[6]).toBe(0xfe00)
        const mr = run(recursive(a, b))
        expect(mr.mem[0x300e]).toBe(g)
        expect(mr.r[6]).toBe(0xfe00)
      }
  })
})

describe("LC3: ตัวอย่างในเว็บ + undo", () => {
  test("ผลตามที่ hint บอก", () => {
    const ex = (id: string) => run(LC3_EXAMPLES.find((e) => e.id === id)!.code)
    expect(ex("mul6").r[3]).toBe(738)
    expect(ex("add").mem[0x3007]).toBe(3)
    expect(ex("sum-loop").r[0]).toBe(15)
    expect(ex("sum-fn").mem[asm(LC3_EXAMPLES.find((e) => e.id === "sum-fn")!.code).labels.get("X")!]).toBe(3)
  })
  test("ย้อนทีละคำสั่งได้สถานะตรงกับตอนเดินหน้าทุกจุด (รวม output/input)", () => {
    const m = new Lc3Machine(asm(LC3_EXAMPLES.find((e) => e.id === "lower")!.code))
    m.feed("AB7")
    const snap = () => JSON.stringify([m.pc, m.r, m.cc, Array.from(m.mem.slice(0x3000, 0x3010)), m.output, m.inPos, m.halted])
    const states = [snap()]
    while (!m.done) {
      m.step()
      states.push(snap())
    }
    for (let i = states.length - 2; i >= 0; i--) {
      m.back()
      expect(snap()).toBe(states[i])
    }
  })
})
