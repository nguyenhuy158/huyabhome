import { v4 as uuidv4 } from "uuid";
import type { IdGenerator } from "../../core/ports";

export const uuidIds: IdGenerator = { next: () => uuidv4() };
