import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { configSchemas, type ConfigName } from "@spotify-companion/shared";
import { CONFIG_DIR } from "../paths.js";

type ConfigValue<N extends ConfigName> = z.infer<(typeof configSchemas)[N]>;

const fileFor = (name: ConfigName): string =>
  path.join(CONFIG_DIR, `${name}.json`);

export async function readConfig<N extends ConfigName>(
  name: N,
): Promise<ConfigValue<N>> {
  const schema = configSchemas[name] as z.ZodType<ConfigValue<N>>;
  let raw: unknown = {};
  try {
    raw = JSON.parse(await readFile(fileFor(name), "utf8"));
  } catch {
    // missing / unreadable -> defaults from the schema
  }
  return schema.parse(raw);
}

export async function writeConfig<N extends ConfigName>(
  name: N,
  value: unknown,
): Promise<ConfigValue<N>> {
  const schema = configSchemas[name] as z.ZodType<ConfigValue<N>>;
  const parsed = schema.parse(value);
  await writeFile(
    fileFor(name),
    `${JSON.stringify(parsed, null, 2)}\n`,
    "utf8",
  );
  return parsed;
}
