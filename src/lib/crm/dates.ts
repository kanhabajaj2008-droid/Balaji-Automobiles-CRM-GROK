import { addDaysIso, todayIso } from "@/lib/utils";
import type { DatePreset } from "./constants";

export function rangeForPreset(preset: DatePreset, customFrom?: string, customTo?: string) {
  const today = todayIso();
  const d = new Date(`${today}T00:00:00`);
  const day = d.getDay(); // 0 Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "week":
      return { from: addDaysIso(today, mondayOffset), to: today };
    case "month": {
      const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      return { from, to: today };
    }
    case "last_month": {
      const firstThis = new Date(d.getFullYear(), d.getMonth(), 1);
      const lastPrev = new Date(firstThis.getTime() - 86400000);
      const from = `${lastPrev.getFullYear()}-${String(lastPrev.getMonth() + 1).padStart(2, "0")}-01`;
      const to = `${lastPrev.getFullYear()}-${String(lastPrev.getMonth() + 1).padStart(2, "0")}-${String(lastPrev.getDate()).padStart(2, "0")}`;
      return { from, to };
    }
    case "year":
      return { from: `${d.getFullYear()}-01-01`, to: today };
    case "custom":
      return { from: customFrom || today, to: customTo || today };
  }
}
