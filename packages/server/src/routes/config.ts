import type { FastifyInstance } from "fastify";
import { configNameParamSchema, configSchemas, type ConfigName } from "@gatefold/shared";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { AppError } from "../errors.js";
import { readConfig, writeConfig } from "../store/config.js";

const isConfigName = (v: string): v is ConfigName => v in configSchemas;

function nameParam(params: unknown): ConfigName {
  const name = (params as { name?: string }).name ?? "";
  if (!isConfigName(name)) {
    throw new AppError("unknown_config", `No config named "${name}"`, 404);
  }
  return name;
}

/** `:name` picks one of 4 differently-shaped config files at runtime — not a
 *  good fit for a single static Fastify response/body schema (a Zod union
 *  here would risk a body/response actually shaped like one config silently
 *  parsing — and losing fields — under the wrong config's schema, since
 *  every field in every one of these schemas has a `.default()`). Params
 *  get typed for docs; body/response validation stays exactly as it was:
 *  `writeConfig`/`readConfig` already validate against the *specific*
 *  schema for whichever name was requested. */
export async function configRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/config/:name",
    { schema: { params: configNameParamSchema } },
    async (req) => readConfig(nameParam(req.params)),
  );

  typed.put(
    "/config/:name",
    { schema: { params: configNameParamSchema } },
    async (req) => writeConfig(nameParam(req.params), req.body ?? {}),
  );
}
