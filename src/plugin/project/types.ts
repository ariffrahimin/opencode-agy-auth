export const FREE_TIER_ID = "free-tier";
export const LEGACY_TIER_ID = "legacy-tier";

export const CODE_ASSIST_METADATA = {
  ideType: "ANTIGRAVITY",
} as const;

export interface EnterpriseLicenseInfo {
  userTier: string;
  location: string;
  projectId: string;
}

let enterpriseLicenseCache: EnterpriseLicenseInfo | null = null;

export function getEnterpriseLicenseCache(): EnterpriseLicenseInfo | null {
  return enterpriseLicenseCache;
}

export async function checkOrGetEnterpriseLicense(
  accessToken: string,
  projectId?: string,
  location = "global",
): Promise<EnterpriseLicenseInfo | null> {
  if (!projectId) return null;
  if (enterpriseLicenseCache && enterpriseLicenseCache.projectId === projectId) {
    return enterpriseLicenseCache;
  }
  try {
    const url = `https://businessaicode.googleapis.com/v1beta/projects/${projectId}/locations/${location}:selfAssignLicense`;
    const res = await (globalThis.fetch || fetch)(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "antigravity/1.4.6 darwin/arm64",
      },
      body: "{}",
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data && data.license && data.license.userTier) {
        enterpriseLicenseCache = {
          userTier: data.license.userTier,
          location: data.license.location || location,
          projectId: data.license.projectId || projectId,
        };
        return enterpriseLicenseCache;
      }
    }
  } catch {
    // Ignore and fall back to consumer endpoint
  }
  return null;
}

export function resolveEnterpriseModelName(
  modelName: string,
  tierMapping?: Record<string, { low: string; high: string; medium?: string }>,
): string {
  const m = (modelName || "").replace(/^google-agy\//, "");
  if (!m) return "gemini-4-argon-high";
  if (
    m.endsWith("-high") ||
    m.endsWith("-medium") ||
    m.endsWith("-low") ||
    m.endsWith("-max")
  ) {
    return m;
  }
  if (tierMapping && tierMapping[m]) {
    return tierMapping[m].high || tierMapping[m].medium || `${m}-high`;
  }
  if (m.includes("gemini-3.1-pro")) {
    return "gemini-3.1-pro-high";
  }
  return `${m}-high`;
}

export interface AgyUserTier {
  id?: string;
  isDefault?: boolean;
  userDefinedCloudaicompanionProject?: boolean;
  name?: string;
  description?: string;
}

export interface CloudAiCompanionProject {
  id?: string;
}

export interface AgyIneligibleTier {
  reasonCode?: string;
  reasonMessage?: string;
  validationUrl?: string;
  validationLearnMoreUrl?: string;
}

export interface LoadCodeAssistPayload {
  cloudaicompanionProject?: string | CloudAiCompanionProject;
  currentTier?: {
    id?: string;
    name?: string;
  };
  allowedTiers?: AgyUserTier[];
  ineligibleTiers?: AgyIneligibleTier[];
}

export interface OnboardUserPayload {
  name?: string;
  done?: boolean;
  response?: {
    cloudaicompanionProject?: {
      id?: string;
    };
  };
}

export interface RetrieveUserQuotaBucket {
  remainingAmount?: string;
  remainingFraction?: number;
  resetTime?: string;
  tokenType?: string;
  modelId?: string;
}

export interface RetrieveUserQuotaResponse {
  buckets?: RetrieveUserQuotaBucket[];
}

export interface QuotaSummaryBucket {
  bucketId?: string;
  displayName?: string;
  description?: string;
  window?: string;
  remaining?: string;
  remainingFraction?: number;
  remainingAmount?: string;
  disabled?: boolean;
  resetTime?: string;
}

export interface QuotaSummaryGroup {
  displayName?: string;
  description?: string;
  buckets?: QuotaSummaryBucket[];
}

export interface RetrieveUserQuotaSummaryResponse {
  groups?: QuotaSummaryGroup[];
  buckets?: QuotaSummaryBucket[];
  description?: string;
}

/**
 * Thrown during Gemini enablement if the required Google Cloud project is missing.
 */
export class ProjectIdRequiredError extends Error {
  constructor() {
    super(
      "Google Gemini/Agy requires a Google Cloud project. Enable the Gemini for Google Cloud API on a project you control, then set `provider.google.options.projectId` in your Opencode config (or set OPENCODE_AGY_PROJECT_ID / GOOGLE_CLOUD_PROJECT).",
    );
  }
}

export class ProjectAccessDeniedError extends Error {
  constructor(projectId: string | undefined, backendMessage: string | undefined) {
    const projectStr = projectId ? `project '${projectId}'` : 'the requested project';
    const msg = backendMessage ? `\nBackend response: ${backendMessage}` : '';
    super(`Access denied to ${projectStr}. Ensure the Gemini for Google Cloud API is enabled and you have the correct IAM permissions.${msg}`);
    this.name = 'ProjectAccessDeniedError';
  }
}

export class AccountValidationRequiredError extends Error {
  validationUrl?: string;
  validationLearnMoreUrl?: string;

  constructor(
    message: string,
    validationUrl?: string,
    validationLearnMoreUrl?: string,
  ) {
    const parts = [message.trim()];
    if (validationUrl) {
      parts.push(`Complete validation: ${validationUrl}`);
    }
    if (validationLearnMoreUrl) {
      parts.push(`Learn more: ${validationLearnMoreUrl}`);
    }

    super(parts.join("\n"));
    this.name = "AccountValidationRequiredError";
    this.validationUrl = validationUrl;
    this.validationLearnMoreUrl = validationLearnMoreUrl;
  }
}
