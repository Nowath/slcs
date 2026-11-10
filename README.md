# Stack CPU + LC3 Simulator

เว็บสำหรับรันและไล่ทีละคำสั่งโปรแกรม **Stack CPU** และ **LC3** ของวิชา 2301274 Computer Systems (บทที่ 8–11)

- เขียนโค้ดแล้วแปลให้ทันที พร้อม syntax highlight และ error เป็นภาษาไทยบอกเลขบรรทัด
- รัน (3 ความเร็ว) · ทีละคำสั่ง · ย้อนกลับได้ · breakpoint
- อธิบายทุก step ว่าคำสั่งทำอะไร เช่น `IF :END — TOS = 3 ≠ 0 → ไม่กระโดด`
- Stack CPU: Data/Return Stack, หน่วยความจำ 8/16 บิต, รองรับรูปแบบ `Address 0: LIT` จากชีท
- LC3: R0–R7, PC, IR, CC, Console (OUT/PUTS/GETC/IN, memory-mapped I/O xFE00–xFE06), ตารางหน่วยความจำถอดเป็นคำสั่ง

## เริ่มใช้

```bash
bun install
bun dev        # http://localhost:3000
bun run test   # ทดสอบ engine เทียบกับชีทและ Quiz 9–10
```

ปุ่มลัด: `F8` รัน/หยุด · `F10` ทีละคำสั่ง · `Shift+F10` ย้อน · `F9` เริ่มใหม่

## หมายเหตุการตีความ

- `AND` แบบ imm5 ใช้ sign-extend ตาม LC3 มาตรฐาน (ชีทเขียนว่าเติม 0)
- `LEA` ตั้ง condition code ตามที่ชีทเขียน `LEA+`
- `TRAP x20–x25` ทำงานในตัว simulator ถ้าโปรแกรมไม่ได้ใส่ trap vector table เอง
- `POW` / `DIV2` เป็นคำสั่งเสริมจากแบบฝึกหัดท้ายบท 9

Next.js · Tailwind v4 · shadcn/ui · IBM Plex Sans Thai
