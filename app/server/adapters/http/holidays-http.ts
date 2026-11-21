import type { HolidayService } from "../../core/application/holiday-service";

export function createHolidaysHttp(service: HolidayService) {
  async function list(): Promise<Response> {
    try {
      return Response.json({ holidays: await service.list() });
    } catch (error) {
      console.error("Error loading holidays:", error);
      return Response.json(
        { holidays: [], error: "Failed to load holidays" },
        { status: 500 },
      );
    }
  }

  return { list };
}

export type HolidaysHttp = ReturnType<typeof createHolidaysHttp>;
