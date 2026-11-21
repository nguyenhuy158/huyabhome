import { describe, expect, it } from "vitest";
import { createHolidayService } from "~/server/core/application/holiday-service";
import { parseHolidaysCsv } from "~/server/core/domain/holiday";

const HEADER = "date,lunar,name,type";

describe("parseHolidaysCsv", () => {
  it("skips the header and reads the four fields, trimmed", () => {
    expect(
      parseHolidaysCsv(`${HEADER}\n 01/01/2026 , ,Tết Dương lịch, solar \n`),
    ).toEqual([
      {
        date: "01/01/2026",
        lunarDate: "",
        name: "Tết Dương lịch",
        type: "solar",
      },
    ]);
  });

  it("keeps a comma inside a quoted field", () => {
    const [holiday] = parseHolidaysCsv(
      `${HEADER}\n17/02/2026,01/01/2026,"Tết, Nguyên Đán",lunar`,
    );
    expect(holiday.name).toBe("Tết, Nguyên Đán");
    expect(holiday.type).toBe("lunar");
  });

  it("skips blank lines and rows with fewer than four fields", () => {
    expect(parseHolidaysCsv(`${HEADER}\n\n01/01/2026,x\n  \n`)).toEqual([]);
  });

  it("returns nothing for a header-only file", () => {
    expect(parseHolidaysCsv(HEADER)).toEqual([]);
  });
});

describe("holiday service", () => {
  it("lists what the source loads", async () => {
    const holidays = [
      { date: "01/01/2026", name: "x", type: "solar" as const },
    ];
    const service = createHolidayService({
      source: { load: async () => holidays },
    });
    expect(await service.list()).toEqual(holidays);
  });
});
