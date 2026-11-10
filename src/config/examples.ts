// ตัวอย่างโปรแกรมจากชีทบทที่ 9 (Stack) และบทที่ 10–11 (LC3)

export type Example = { id: string; title: string; hint: string; code: string }

export const STACK_EXAMPLES: Example[] = [
  {
    id: "sub",
    title: "(10 − 3) เก็บลง mem[20]",
    hint: "ผลคือ mem[20] = 7",
    code: `// คำนวณ 10 - 3 แล้วเก็บลง mem[20]
LIT 10
LIT 3
SUB        // ตัวล่าง - TOS = 10 - 3
LIT 20
STORE      // mem[20] = 7
HALT
`,
  },
  {
    id: "var",
    title: "ตัวแปร C = A + B",
    hint: "ใช้รูปแบบ Address ในชีทได้ตรงๆ · ผล mem[13] = 3",
    code: `Address 0:  LIT
Address 1:  11
Address 2:  LOAD    // load (push) A
Address 3:  LIT
Address 4:  12
Address 5:  LOAD    // load (push) B
Address 6:  ADD
Address 7:  LIT
Address 8:  13
Address 9:  STORE   // write C
Address 10: HALT
Address 11: 1       // variable A = 1
Address 12: 2       // variable B = 2
Address 13: 0       // variable C
`,
  },
  {
    id: "for",
    title: "for (i = 0; i < 10; i++)",
    hint: "i อยู่ที่ mem[100] · จบลูป mem[100] = 10",
    code: `      LIT 0
      LIT 100
      STORE        // i = 0
:LOOP LIT 100
      LOAD         // push i
      DUP
      LIT 10
      SUB          // i - 10
      IF :END      // i == 10 -> ออกจากลูป
      // (Code Segment A — ตอนนี้มี i อยู่บน stack)
      LIT 1
      ADD          // i + 1
      LIT 100
      STORE        // i = i + 1
      LIT 0
      IF :LOOP     // กระโดดกลับแบบไม่มีเงื่อนไข
:END  DROP         // ทิ้งสำเนา i ที่ค้างอยู่
      HALT
`,
  },
  {
    id: "gt0",
    title: "เงื่อนไข A > 0",
    hint: "ลองเปลี่ยน 5 เป็น 0 หรือ -3 · DS = 0 แปลว่า A > 0 (IF จะ taken)",
    code: `LIT 5        // A (ลองเปลี่ยนเป็น 0, -3, 127, 200)
DUP DUP ADD
DUP DUP ADD
DUP DUP ADD
DUP DUP ADD
DUP DUP ADD
DUP DUP ADD
DUP DUP ADD  // 7 ชุด: A 2A 4A ... 128A
OR OR OR OR OR OR
LIT x80
XOR
OR
LIT x80
AND          // TOS = 0 ก็ต่อเมื่อ A > 0
HALT
`,
  },
  {
    id: "add-fn",
    title: "ฟังก์ชัน f(a, b) = a + b",
    hint: "ดู Return Stack ตอน CALL / EXIT · ผล DS = 3",
    code: `LIT 1       // the first argument
LIT 2       // the second argument
CALL :F
HALT
:F  ADD     // function starts here
    EXIT    // return from function
`,
  },
  {
    id: "sum",
    title: "sum(n) แบบเรียกซ้ำ",
    hint: "sum(10) = 55 · สังเกต RS โตตามความลึกของการเรียกซ้ำ",
    code: `      LIT 10       // argument = 10
      CALL :SUM
      HALT
:SUM  DUP
      IF :RET      // n == 0 -> คืน n (= 0) ไปเลย
      DUP
      LIT 1
      SUB
      CALL :SUM    // n sum(n-1)
      ADD
:RET  EXIT
`,
  },
  {
    id: "fac",
    title: "factorial (เรียก mul)",
    hint: "fac(5) = 120 · ถ้าใช้ fac(10) ผลจะล้น 8 บิต",
    code: `      LIT 5
      CALL :FAC
      HALT

:FAC  DUP
      IF :FEND
      DUP
      LIT 1
      SUB
      CALL :FAC
      CALL :MUL
      EXIT
:FEND DROP
      LIT 1
      EXIT

:MUL  DUP          // mul(m, n)
      IF :MEND
      OVER
      SWAP
      LIT 1
      SUB
      CALL :MUL
      ADD
      EXIT
:MEND DROP
      DROP
      LIT 0
      EXIT
`,
  },
  {
    id: "empty",
    title: "หน้าว่าง",
    hint: "",
    code: `// เขียนโปรแกรมของคุณที่นี่
LIT 1
HALT
`,
  },
]

export const LC3_EXAMPLES: Example[] = [
  {
    id: "mul6",
    title: "คูณหก (×6) ด้วยลูปบวกซ้ำ",
    hint: "ผล R3 = 123 × 6 = 738",
    code: `; โปรแกรมคูณ NUMBER ด้วย 6
        .ORIG x3050
        LD   R1, SIX
        LD   R2, NUMBER
        AND  R3, R3, #0     ; ล้าง R3 = 0
AGAIN   ADD  R3, R3, R2     ; R3 += NUMBER
        ADD  R1, R1, #-1    ; ตัวนับ - 1
        BRp  AGAIN          ; ยังเป็นบวก -> วนต่อ
        HALT
NUMBER  .FILL #123
SIX     .FILL x0006
        .END
`,
  },
  {
    id: "add",
    title: "บวกเลขในหน่วยความจำ",
    hint: "RESULT = 1 + 2 · ดู M[x3007] เปลี่ยน",
    code: `        .ORIG x3000
        LD   R1, OPER1
        LD   R2, OPER2
        ADD  R0, R1, R2
        ST   R0, RESULT
        HALT
OPER1   .FILL x0001
OPER2   .FILL x0002
RESULT  .FILL x0000
        .END
`,
  },
  {
    id: "sum-loop",
    title: "for-loop: 1 + 2 + … + N",
    hint: "N = 5 → R0 = 15",
    code: `        .ORIG x3000
        AND  R0, R0, #0     ; sum = 0
        LD   R1, N          ; i = N
LOOP    BRz  DONE           ; i == 0 -> จบ
        ADD  R0, R0, R1     ; sum += i
        ADD  R1, R1, #-1    ; i--
        BR   LOOP
DONE    HALT
N       .FILL #5            ; ได้ R0 = 15
        .END
`,
  },
  {
    id: "hello",
    title: "Hello, World! (PUTS)",
    hint: "ดูผลที่ช่อง Console",
    code: `        .ORIG x3000
        LEA  R0, MSG        ; R0 = address ของ string
        PUTS                ; TRAP x22
        HALT
MSG     .STRINGZ "Hello, World!\\n"
        .END
`,
  },
  {
    id: "lower",
    title: "แปลงตัวพิมพ์ใหญ่เป็นเล็ก (TRAP)",
    hint: "พิมพ์ตัวอักษรใหญ่ลงช่อง input · กด 7 เพื่อจบ",
    code: `        .ORIG x3000
        LD   R2, TERM       ; R2 = -'7'
        LD   R3, ASCII      ; R3 = x20
START   TRAP x23            ; R0 <- keyboard
        ADD  R1, R2, R0     ; R0 == '7' ?
        BRz  EXIT
        ADD  R0, R0, R3     ; ตัวใหญ่ -> ตัวเล็ก
        TRAP x21            ; monitor <- R0
        BRnzp START
TERM    .FILL xFFC9         ; -'7' (two's complement ของ x37)
ASCII   .FILL x0020         ; ใช้แปลงตัวใหญ่เป็นตัวเล็ก
EXIT    TRAP x25            ; HALT
        .END
`,
  },
  {
    id: "poll",
    title: "Memory-mapped I/O (วนเช็ก KBSR/DSR)",
    hint: "พิมพ์ตัวอักษร แล้วโปรแกรมจะ echo ออกจอเอง",
    code: `        .ORIG x3000
POLL    LDI  R1, KBSR       ; บิต 15 = มีตัวอักษรรออยู่
        BRzp POLL
        LDI  R0, KBDR       ; อ่านตัวอักษร
WAITD   LDI  R1, DSR        ; รอจอพร้อม
        BRzp WAITD
        STI  R0, DDR        ; เขียนออกจอ
        HALT
KBSR    .FILL xFE00
KBDR    .FILL xFE02
DSR     .FILL xFE04
DDR     .FILL xFE06
        .END
`,
  },
  {
    id: "sum-fn",
    title: "ฟังก์ชัน + stack frame: sum(1, 2)",
    hint: "ใช้ R6 เป็น stack pointer, R7 เก็บ return address",
    code: `; x = sum(a, b) โดยส่ง argument ผ่าน stack (R6 = stack pointer)
        .ORIG x3000
        LD   R6, TOS        ; R6 = ยอด stack
        LD   R0, ONE
        ADD  R6, R6, #-1
        STR  R0, R6, #0     ; push a = 1
        LD   R0, TWO
        ADD  R6, R6, #-1
        STR  R0, R6, #0     ; push b = 2
        JSR  SUM
        LDR  R0, R6, #0     ; pop ผลลัพธ์
        ADD  R6, R6, #1
        ST   R0, X
        HALT

SUM     LDR  R1, R6, #0     ; b
        LDR  R2, R6, #1     ; a
        ADD  R0, R1, R2
        ADD  R6, R6, #2     ; pop argument 2 ตัว
        ADD  R6, R6, #-1
        STR  R0, R6, #0     ; push ผลลัพธ์
        RET

X       .FILL x0000
ONE     .FILL x0001
TWO     .FILL x0002
TOS     .FILL xFE00
        .END
`,
  },
  {
    id: "empty",
    title: "หน้าว่าง",
    hint: "",
    code: `        .ORIG x3000
        ; เขียนโปรแกรมของคุณที่นี่
        HALT
        .END
`,
  },
]
