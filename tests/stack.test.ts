// ตรวจ Stack CPU เทียบกับตาราง ISA บทที่ 8 และโจทย์บทที่ 9 / Quiz 9
import { describe, expect, test } from "bun:test"
import { assembleStack, StackMachine } from "@/lib/stack/cpu"
import { STACK_EXAMPLES } from "@/config/examples"

function run(src: string, bits: 8 | 16 = 8, limit = 1_000_000) {
  const p = assembleStack(src, bits)
  const errs = p.errors.filter((e) => e.severity === "error")
  if (errs.length) throw new Error(JSON.stringify(errs))
  const m = new StackMachine(p)
  let n = 0
  while (!m.done && n++ < limit) m.step()
  return m
}

describe("Stack CPU: แต่ละคำสั่งตามตาราง ISA", () => {
  test("LIT push operand, pc += 2", () => {
    const m = new StackMachine(assembleStack("LIT 10\nHALT", 8))
    m.step()
    expect(m.ds).toEqual([10])
    expect(m.pc).toBe(2)
  })
  test("LOAD: pop addr แล้ว push mem[addr]", () => {
    expect(run("LIT 5\nLOAD\nHALT\n77\n99").ds).toEqual([99]) // mem[5] = 99 (LIT 5=0,1 LOAD=2 HALT=3 77=4 99=5)
  })
  test("STORE: addr อยู่บน value อยู่ล่าง", () => {
    const m = run("LIT 10\nLIT 50\nSTORE\nHALT")
    expect(m.mem[50]).toBe(10)
    expect(m.ds).toEqual([])
  })
  test("DROP / DUP / OVER / SWAP", () => {
    expect(run("LIT 10\nLIT 20\nDROP\nHALT").ds).toEqual([10])
    expect(run("LIT 10\nDUP\nHALT").ds).toEqual([10, 10])
    expect(run("LIT 10\nLIT 20\nOVER\nHALT").ds).toEqual([10, 20, 10])
    expect(run("LIT 10\nLIT 20\nSWAP\nHALT").ds).toEqual([20, 10])
  })
  test("ADD/SUB ลำดับ = ตัวล่าง op TOS, 10 - 20 = -10 (246 ใน 8 บิต)", () => {
    expect(run("LIT 10\nLIT 20\nADD\nHALT").ds).toEqual([30])
    expect(run("LIT 10\nLIT 20\nSUB\nHALT").ds).toEqual([246])
    expect(run("LIT 10\nLIT 20\nSUB\nHALT", 16).ds).toEqual([65526])
  })
  test("AND / OR / XOR", () => {
    expect(run("LIT x0C\nLIT x0A\nAND\nHALT").ds).toEqual([0x08])
    expect(run("LIT x0C\nLIT x0A\nOR\nHALT").ds).toEqual([0x0e])
    expect(run("LIT x0C\nLIT x0A\nXOR\nHALT").ds).toEqual([0x06])
  })
  test("ADD ล้น 8 บิต wrap รอบ", () => {
    expect(run("LIT 200\nLIT 100\nADD\nHALT").ds).toEqual([44])
  })
  test("IF taken เมื่อ 0 / not taken เมื่อไม่ใช่ 0 และ pop ทั้งสองกรณี", () => {
    const taken = new StackMachine(assembleStack("LIT 0\nIF 9\nHALT", 8))
    taken.step()
    taken.step()
    expect(taken.pc).toBe(9)
    expect(taken.ds).toEqual([])
    const not = new StackMachine(assembleStack("LIT 3\nIF 9\nHALT", 8))
    not.step()
    not.step()
    expect(not.pc).toBe(4)
    expect(not.ds).toEqual([])
  })
  test("CALL push pc+2 ลง RS แล้วกระโดด / EXIT กลับ (ตัวอย่างชีท CALL 5)", () => {
    const m = new StackMachine(assembleStack("CALL 5\nHALT\n0\n0\nEXIT", 8))
    m.step()
    expect(m.pc).toBe(5)
    expect(m.rs).toEqual([2])
    m.step()
    expect(m.pc).toBe(2)
    expect(m.rs).toEqual([])
  })
  test(">R / R>", () => {
    expect(run("LIT 7\n>R\nLIT 1\nR>\nHALT").ds).toEqual([1, 7])
  })
  test("stack underflow เป็น error ไม่ใช่ค่ามั่ว", () => {
    const m = run("DROP\nHALT")
    expect(m.error).toContain("underflow")
  })
  test("ไม่มี HALT → หยุดที่ท้ายโปรแกรม ไม่ push 0 จากช่องว่างไปเรื่อยๆ", () => {
    const m = run("LIT 30")
    expect(m.ds).toEqual([30])
    expect(m.error).toContain("เลยท้ายโปรแกรม")
  })
  test("กระโดดไปข้อมูลที่อยู่ในโปรแกรมยังทำงานได้", () => {
    const m = run("LIT 0\nIF 5\nHALT\n0\n0\n15") // addr 5 = 15 = HALT
    expect(m.halted).toBe(true)
  })
  test("รัน opcode ที่ไม่มีอยู่ → error", () => {
    const m = run("LIT 0\nIF 6\nHALT\n0\n0\n0\n200")
    expect(m.error).toContain("ไม่ใช่ opcode")
  })
})

describe("Stack CPU: assembler", () => {
  test("LIT n บรรทัดเดียวหรือแยกบรรทัดได้ผลเหมือนกัน", () => {
    expect(assembleStack("LIT 30\nHALT", 8).memory.slice(0, 3)).toEqual(assembleStack("LIT\n30\nHALT", 8).memory.slice(0, 3))
  })
  test("เตือนเลขเกินมาหลัง operand และค่าเกินขนาดบิต", () => {
    expect(assembleStack("LIT 10 3\nHALT", 8).errors.map((e) => e.message).join()).toContain("เกินมา")
    expect(assembleStack("HALT 5", 8).errors.map((e) => e.message).join()).toContain("เกินมา")
    // ข้อมูลล้วนตามหลัง label หรือหลายค่าในบรรทัดเดียว เขียนถูกแล้ว ห้ามเตือน
    expect(assembleStack("LIT A\nLOAD\nHALT\nA: 5", 8).errors).toEqual([])
    expect(assembleStack("HALT\n1 2 3", 8).errors).toEqual([])
    expect(assembleStack("LIT 300\nHALT", 8).errors.map((e) => e.message).join()).toContain("เก็บเป็น 44")
    expect(assembleStack("LIT 300\nHALT", 16).errors).toEqual([])
    expect(assembleStack("LIT -5\nHALT", 8).errors).toEqual([])
  })
  test("ภาษาเครื่องของตัวอย่างตัวแปร A + B ตรงกับ address ในชีท", () => {
    const p = assembleStack(STACK_EXAMPLES.find((e) => e.id === "var")!.code, 8)
    expect(p.memory.slice(0, 13)).toEqual([0x00, 11, 0x01, 0x00, 12, 0x01, 0x07, 0x00, 13, 0x02, 0x0f, 1, 2])
  })
  test("label ทุกแบบ (:L, L:, L ต้นบรรทัด) ให้ address เดียวกัน", () => {
    for (const src of ["LIT 0\nIF :L\nHALT\n:L LIT 9\nHALT", "LIT 0\nIF L\nHALT\nL: LIT 9\nHALT", "LIT 0\nIF L\nHALT\nL LIT 9\nHALT"]) {
      expect(run(src).ds).toEqual([9])
    }
  })
  test("operand อยู่คนละบรรทัดกับคำสั่งได้ (รูปแบบ Address)", () => {
    expect(run("Address 0: LIT\nAddress 1: 42\nAddress 2: HALT").ds).toEqual([42])
  })
  test("พิมพ์คำสั่งผิดกลางบรรทัด → error, ต้นบรรทัด → warning", () => {
    expect(assembleStack("LIT 1 DUPP\nHALT", 8).errors[0].severity).toBe("error")
    expect(assembleStack("DUPP\nHALT", 8).errors[0].severity).toBe("warning")
  })
  test("label ไม่มีจริง → error", () => {
    expect(assembleStack("IF :NOPE\nHALT", 8).errors.some((e) => e.message.includes("NOPE"))).toBe(true)
  })
})

describe("Stack CPU: โปรแกรมจากชีทและ quiz", () => {
  const mul = (a: number, b: number) => `LIT ${a}\nLIT ${b}\nCALL F\nHALT
F   DUP
    IF END
    OVER
    SWAP
    LIT 1
    SUB
    CALL F
    ADD
    EXIT
END DROP
    DROP
    LIT 0
    EXIT`
  test("Quiz 9 ข้อ 1: F(5,7) = 35 และคูณทุกคู่ที่ไม่ล้น", () => {
    expect(run(mul(5, 7)).ds).toEqual([35])
    for (let a = 0; a <= 15; a++) for (let b = 0; b <= 15; b++) expect(run(mul(a, b)).ds).toEqual([(a * b) & 0xff])
  })

  const q2 = (a: number, b: number) => `      LIT   ${a}
      LIT   ${b}
      CALL  F
      HALT
F     DUP
      IF    END
      OVER
      IF    END
      OVER
      OVER
      LIT   1
      SUB
      CALL  F
      ADD
      ADD
      EXIT
END   DROP
      DROP
      LIT   0
      EXIT`
  test("Quiz 9 ข้อ 2: f(5,3)=21, f(2,4)=18, f(7,2)=17", () => {
    expect(run(q2(5, 3)).ds).toEqual([21])
    expect(run(q2(2, 4)).ds).toEqual([18])
    expect(run(q2(7, 2)).ds).toEqual([17])
  })

  test("ตัวอย่างในเว็บทุกตัวได้ผลตามที่เขียนไว้", () => {
    const ex = (id: string) => run(STACK_EXAMPLES.find((e) => e.id === id)!.code)
    expect(ex("sub").mem[20]).toBe(7)
    expect(ex("var").mem[13]).toBe(3)
    expect(ex("for").mem[100]).toBe(10)
    expect(ex("add-fn").ds).toEqual([3])
    expect(ex("sum").ds).toEqual([55])
    expect(ex("fac").ds).toEqual([120])
  })

  test("เงื่อนไข A > 0: TOS = 0 ก็ต่อเมื่อ A อยู่ใน 1..127 (ทุกค่า 0–255)", () => {
    const code = STACK_EXAMPLES.find((e) => e.id === "gt0")!.code
    for (let a = 0; a < 256; a++) {
      const m = run(code.replace("LIT 5", `LIT ${a}`))
      expect(m.ds.length).toBe(1)
      expect(m.ds[0] === 0).toBe(a >= 1 && a <= 127)
    }
  })

  test("sum(n) ทุก n ที่ไม่ล้น (16 บิต)", () => {
    const code = STACK_EXAMPLES.find((e) => e.id === "sum")!.code
    for (let n = 0; n <= 100; n++) expect(run(code.replace("LIT 10", `LIT ${n}`), 16).ds).toEqual([(n * (n + 1)) / 2])
  })
})

describe("Stack CPU: ย้อนกลับ (undo)", () => {
  test("ย้อนทีละคำสั่งได้สถานะตรงกับตอนเดินหน้าทุกจุด", () => {
    const p = assembleStack(STACK_EXAMPLES.find((e) => e.id === "fac")!.code, 8)
    const m = new StackMachine(p)
    const snap = () => JSON.stringify([m.pc, m.ds, m.rs, m.mem, m.halted, m.error])
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
  test("ย้อน STORE คืนค่าหน่วยความจำเดิม", () => {
    const m = new StackMachine(assembleStack("LIT 9\nLIT 4\nSTORE\nHALT", 8))
    const before = m.mem[4]
    m.step()
    m.step()
    m.step()
    expect(m.mem[4]).toBe(9)
    m.back()
    expect(m.mem[4]).toBe(before)
  })
})
