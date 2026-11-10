"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

/** ตัวเลือกแบบปุ่มกลุ่ม เลือกได้ค่าเดียวและห้ามว่าง */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <ToggleGroup
        aria-label={label}
        variant="outline"
        size="sm"
        value={[value]}
        onValueChange={(v) => v[0] && onChange(v[0] as T)}
      >
        {options.map((o) => (
          <ToggleGroupItem key={o.value} value={o.value} className="px-2.5 font-mono text-xs">
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
