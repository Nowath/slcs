"use client";

import { Binary, Cpu, Layers } from "lucide-react";
import { Lc3Sim } from "@/components/lc3/lc3-sim";
import { StackSim } from "@/components/stack/stack-sim";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStored } from "@/hooks/use-stored";

export function Simulator() {
  const [tab, setTab] = useStored<"stack" | "lc3">("tab", "stack");
  // ขนาดตัวอักษรใน editor ใช้ค่าเดียวทั้งสองเครื่อง สลับแท็บแล้วไม่เด้งกลับ
  const [fontSize, setFontSize] = useStored("editor.fontSize", 13);
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as "stack" | "lc3")}
      className="gap-0"
    >
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"
            >
              <Binary className="size-5" />
            </span>
            <div className="min-w-0">
              {/* มือถือเหลือแค่โลโก้ เพราะแท็บต้องการที่มากกว่า ชื่อยังอยู่ให้ screen reader */}
              <h1 className="sr-only truncate text-base leading-snug font-semibold sm:not-sr-only">
                Stack CPU + LC3 Simulator
              </h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                2301274 Computer Systems · บทที่ 8–11
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <TabsList className="h-10!">
              <TabsTrigger value="stack" className="px-3">
                <Layers />
                Stack CPU
              </TabsTrigger>
              <TabsTrigger value="lc3" className="px-3">
                <Cpu />
                LC3
              </TabsTrigger>
            </TabsList>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] px-4 pt-6 pb-12">
        {/* keepMounted: สลับแท็บแล้วสถานะเครื่องอีกฝั่งยังอยู่ */}
        <TabsContent value="stack" keepMounted>
          <StackSim active={tab === "stack"} fontSize={fontSize} onFontSize={setFontSize} />
        </TabsContent>
        <TabsContent value="lc3" keepMounted>
          <Lc3Sim active={tab === "lc3"} fontSize={fontSize} onFontSize={setFontSize} />
        </TabsContent>
      </main>
    </Tabs>
  );
}
