import { describe, expect, it } from "vitest";
import { createCsvHolidaySource } from "~/server/adapters/static/csv-holiday-source";

describe("csv holiday source", () => {
  it("loads the bundled holidays", async () => {
    const holidays = await createCsvHolidaySource().load();
    expect(holidays.length).toBeGreaterThan(5);
    for (const holiday of holidays) {
      expect(holiday.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(holiday.name).not.toBe("");
      expect(["solar", "lunar"]).toContain(holiday.type);
    }
  });

  it("parses the text it is given", async () => {
    const source = createCsvHolidaySource(
      "date,lunar,name,type\n02/09/2026,,Quốc khánh,solar",
    );
    expect(await source.load()).toEqual([
      { date: "02/09/2026", lunarDate: "", name: "Quốc khánh", type: "solar" },
    ]);
  });
});
