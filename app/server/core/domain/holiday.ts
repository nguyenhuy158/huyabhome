export interface Holiday {
  date: string; // DD/MM/YYYY
  lunarDate?: string; // DD/MM/YYYY
  name: string;
  type: "solar" | "lunar";
}

export function parseHolidaysCsv(csvText: string): Holiday[] {
  const lines = csvText.trim().split("\n");
  const holidays: Holiday[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line, handling quoted fields
    const fields: string[] = [];
    let currentField = "";
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        fields.push(currentField);
        currentField = "";
      } else {
        currentField += char;
      }
    }
    fields.push(currentField); // Add last field

    if (fields.length >= 4) {
      holidays.push({
        date: fields[0].trim(),
        lunarDate: fields[1].trim(),
        name: fields[2].trim(),
        type: fields[3].trim() as "solar" | "lunar",
      });
    }
  }

  return holidays;
}
