import type { Holiday } from "../domain/holiday";
import type { HolidaySource } from "../ports";

export function createHolidayService({ source }: { source: HolidaySource }) {
  async function list(): Promise<Holiday[]> {
    return source.load();
  }

  return { list };
}

export type HolidayService = ReturnType<typeof createHolidayService>;
