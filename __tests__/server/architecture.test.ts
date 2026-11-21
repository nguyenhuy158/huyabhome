import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP = join(__dirname, "../../app");
const SERVER = join(APP, "server");
const CORE = join(SERVER, "core");
const ADAPTERS = join(SERVER, "adapters");
const COMPOSE = join(SERVER, "compose.ts");
const ADAPTER_KINDS = ["kv", "http", "system"];
const MIGRATED_ROUTES = ["api.notes.tsx", "api.notes_.$id.tsx"];
const ALLOWED_ROUTE_IMPORTS = ["react-router", COMPOSE.replace(/\.ts$/, "")];
const IMPORT = /\bfrom\s+"([^"]+)"|\bimport\("([^"]+)"\)/g;
const IO = new RegExp(
  [
    String.raw`\bfetch\(`,
    String.raw`\bprocess\.`,
    String.raw`\bnew Date\(`,
    String.raw`\bDate\.now\(`,
    String.raw`\bconsole\.`,
    String.raw`\bcrypto\.`,
    String.raw`\bKVNamespace\b`,
    String.raw`\bD1Database\b`,
    String.raw`\bnew (Request|Response)\b`,
    String.raw`\bFormData\b`,
  ].join("|"),
);

const files = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));

const importsOf = (file: string): string[] =>
  [...readFileSync(file, "utf8").matchAll(IMPORT)].map((match) => {
    const specifier = match[1] ?? match[2];
    if (specifier.startsWith("~/")) return join(APP, specifier.slice(2));
    if (specifier.startsWith(".")) return resolve(dirname(file), specifier);
    return specifier;
  });

const inside = (dir: string, target: string) =>
  target.startsWith("/") && !relative(dir, target).startsWith("..");

const show = (file: string, target: string) =>
  `${relative(APP, file)} -> ${target.startsWith("/") ? relative(APP, target) : target}`;

const offenders = (
  dir: string,
  allowed: (target: string, file: string) => boolean,
) =>
  files(dir).flatMap((file) =>
    importsOf(file)
      .filter((target) => !allowed(target, file))
      .map((target) => show(file, target)),
  );

describe("server hexagon boundaries", () => {
  it("has the layers", () => {
    for (const dir of [CORE, ADAPTERS])
      expect(files(dir).length).toBeGreaterThan(0);
    for (const kind of ADAPTER_KINDS) {
      expect(files(join(ADAPTERS, kind)).length).toBeGreaterThan(0);
    }
  });

  it("core imports only core files: no adapters, no framework, no packages", () => {
    expect(offenders(CORE, (target) => inside(CORE, target))).toEqual([]);
  });

  it("core does no IO and reads no clock: it uses ports", () => {
    const found = files(CORE).filter((file) =>
      IO.test(readFileSync(file, "utf8")),
    );
    expect(found.map((file) => relative(APP, file))).toEqual([]);
  });

  it.each(ADAPTER_KINDS)(
    "adapters/%s imports core and its own files only, never another adapter or compose",
    (kind) => {
      const own = join(ADAPTERS, kind);
      expect(
        offenders(
          own,
          (target) =>
            inside(own, target) ||
            inside(CORE, target) ||
            (!target.startsWith("/") && !target.startsWith("react-router")),
        ),
      ).toEqual([]);
    },
  );

  it("only compose.ts imports adapters", () => {
    const importers = files(APP)
      .filter((file) => !inside(ADAPTERS, file) && file !== COMPOSE)
      .filter((file) =>
        importsOf(file).some((target) => inside(ADAPTERS, target)),
      );
    expect(importers.map((file) => relative(APP, file))).toEqual([]);
  });

  it("the migrated routes import only react-router and compose", () => {
    const routes = files(join(APP, "routes")).filter((file) =>
      MIGRATED_ROUTES.includes(relative(join(APP, "routes"), file)),
    );
    expect(routes).toHaveLength(MIGRATED_ROUTES.length);
    const found = routes.flatMap((file) =>
      importsOf(file)
        .filter((target) => !ALLOWED_ROUTE_IMPORTS.includes(target))
        .map((target) => show(file, target)),
    );
    expect(found).toEqual([]);
  });
});
