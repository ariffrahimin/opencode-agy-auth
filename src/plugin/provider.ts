import { execFileSync } from "node:child_process";
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

let cachedKeychainProjectId: string | null | undefined = undefined;

function readProjectFromDiskConfigs(homeDir: string): string | undefined {
  const candidates = [
    `${process.cwd()}/.opencode/opencode.json`,
    `${process.cwd()}/.opencode/opencode.jsonc`,
    `${process.cwd()}/opencode.json`,
    `${process.cwd()}/opencode.jsonc`,
    ...(homeDir
      ? [
          `${homeDir}/.config/opencode/opencode.json`,
          `${homeDir}/.config/opencode/opencode.jsonc`,
        ]
      : []),
  ];

  for (const filePath of candidates) {
    try {
      if (!existsSync(filePath)) continue;
      const raw = readFileSync(filePath, "utf8")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/,(\s*[}\]])/g, "$1");
      const parsed = JSON.parse(raw);
      const fromAgy = resolveConfiguredProjectIdFromConfig(parsed);
      if (fromAgy) return fromAgy;
      const googleCfg = parsed?.providers?.google || parsed?.provider?.google;
      const fromGoogle =
        normalizeProjectId(googleCfg?.settings?.projectId) ??
        normalizeProjectId(googleCfg?.options?.projectId);
      if (fromGoogle) return fromGoogle;
    } catch {
      // Ignore parse/read errors
    }
  }
  return undefined;
}

function readProjectFromAgyKeychain(): string | undefined {
  if (cachedKeychainProjectId !== undefined) {
    return cachedKeychainProjectId ?? undefined;
  }
  cachedKeychainProjectId = null;
  if (process.platform !== "darwin") {
    return undefined;
  }
  try {
    const out = execFileSync(
      "security",
      ["find-generic-password", "-s", "gemini", "-a", "antigravity", "-w"],
      { encoding: "utf8", timeout: 1500, stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    const jsonStr = out.startsWith("go-keyring-base64:")
      ? Buffer.from(out.slice("go-keyring-base64:".length), "base64").toString("utf8")
      : out;
    const data = JSON.parse(jsonStr);
    const proj = normalizeProjectId(data?.project_id);
    if (proj) {
      cachedKeychainProjectId = proj;
      return proj;
    }
  } catch {
    // Ignore keychain lookup errors
  }
  return undefined;
}

export function resolveConfiguredProjectId(
  input: ResolveConfiguredProjectIdInput = {},
): string | undefined {
  const env = input.env ?? process.env;
  let diskConfigProject: string | undefined;
  let gcpProjectFromFile: string | undefined;
  let keychainProject: string | undefined;
  const isTestEnv =
    (process.env.VITEST || process.env.NODE_ENV === "test") &&
    process.env.OPENCODE_AGY_TEST_ENTERPRISE !== "1";
  if (!isTestEnv) {
    const homeDir = env.HOME || env.USERPROFILE || "";
    diskConfigProject = readProjectFromDiskConfigs(homeDir);
    try {
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
    if (!diskConfigProject && !gcpProjectFromFile) {
      keychainProject = readProjectFromAgyKeychain();
    }
  }

  return (
    normalizeProjectId(env.OPENCODE_AGY_PROJECT_ID) ??
    resolveConfiguredProjectIdFromProvider(input.provider) ??
    normalizeProjectId(input.configProjectId) ??
    resolveConfiguredProjectIdFromConfig(input.config) ??
    normalizeProjectId(diskConfigProject) ??
    normalizeProjectId(gcpProjectFromFile) ??
    normalizeProjectId(keychainProject) ??
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
