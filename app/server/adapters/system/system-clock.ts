import type { Clock } from "../../core/ports";

export const systemClock: Clock = { now: () => new Date().toISOString() };
