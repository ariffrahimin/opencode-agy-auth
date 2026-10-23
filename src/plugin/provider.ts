import { existsSync, readFileSync } from "node:fs";
import type { Config } from "./types";

import { AGY_PROVIDER_ID } from "../constants";
import type { PluginClient, Provider } from "./types";

interface ResolveConfiguredProjectIdInput {
  provider?: Provider | null;
  config?: Config | null;
  configProjectId?: string;
  env?: NodeJS.ProcessEnv;
}

export function resolveConfiguredProjectId(
  input: ResolveConfiguredProjectIdInput = {},
): string | undefined {
  const env = input.env ?? process.env;
  let gcpProjectFromFile: string | undefined;
  const isTestEnv =
    (process.env.VITEST || process.env.NODE_ENV === "test") &&
    process.env.OPENCODE_AGY_TEST_ENTERPRISE !== "1";
  if (!isTestEnv) {
    try {
      const homeDir = env.HOME || env.USERPROFILE || "";
      if (homeDir) {
        const p = `${homeDir}/.gemini/antigravity-cli/settings.json`;
        if (existsSync(p)) {
          const data = JSON.parse(readFileSync(p, "utf8"));
          gcpProjectFromFile = data?.gcp?.project;
        }
      }
    } catch {
      // Ignore file read errors
    }
  }

  return (
    normalizeProjectId(env.OPENCODE_AGY_PROJECT_ID) ??
    resolveConfiguredProjectIdFromProvider(input.provider) ??
    normalizeProjectId(input.configProjectId) ??
    resolveConfiguredProjectIdFromConfig(input.config) ??
    normalizeProjectId(gcpProjectFromFile) ??
    normalizeProjectId(env.GOOGLE_CLOUD_PROJECT) ??
    normalizeProjectId(env.GOOGLE_CLOUD_PROJECT_ID)
  );
}

function resolveConfiguredProjectIdFromProvider(
  provider: Provider | null | undefined,
): string | undefined {
  if (!provider || typeof provider !== "object") {
    return undefined;
  }
  const anyProvider = provider as any;
  return (
    normalizeProjectId(provider.options?.projectId) ??
    normalizeProjectId(anyProvider.settings?.projectId)
  );
}

export function resolveConfiguredProjectIdFromConfig(
  config: Config | null | undefined,
): string | undefined {
  if (!config || typeof config !== "object") {
    return undefined;
  }
  const anyConfig = config as any;
  const providerConfig =
    config.provider?.[AGY_PROVIDER_ID] || anyConfig.providers?.[AGY_PROVIDER_ID];
  return (
    normalizeProjectId(providerConfig?.options?.projectId) ??
    normalizeProjectId(providerConfig?.settings?.projectId)
  );
}

export async function resolveConfiguredProjectIdFromClient(
  client: PluginClient | null | undefined,
): Promise<string | undefined> {
  if (!client?.config?.get) {
    return undefined;
  }

  try {
    const result = await client.config.get();
    return resolveConfiguredProjectIdFromConfig(result?.data);
  } catch {
    return undefined;
  }
}

function normalizeProjectId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}
