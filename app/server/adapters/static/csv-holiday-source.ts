import csvData from "../../../../public/data/holidays-2026.csv?raw";
import { parseHolidaysCsv } from "../../core/domain/holiday";
import type { HolidaySource } from "../../core/ports";

export function createCsvHolidaySource(
  csvText: string = csvData,
): HolidaySource {
  return { load: async () => parseHolidaysCsv(csvText) };
}
