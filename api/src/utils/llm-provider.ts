import { pool } from "../index";
import { decrypt } from "./encryption";

export interface ProviderConfig {
  provider: string;
  keyData: any;
}

/**
 * Get LLM provider configuration for a user
 * Returns user's BYOK keys if configured, otherwise falls back to system keys
 */
export async function getLLMProviderConfig(
  userId: string,
  preferredProvider?: string
): Promise<ProviderConfig | null> {
  try {
    // Fetch all enabled provider keys for the user
    const result = await pool.query(
      `SELECT provider, key_data
       FROM provider_keys
       WHERE user_id = $1 AND enabled = true
       ORDER BY updated_at DESC`,
      [userId]
    );

    if (result.rows.length === 0) {
      // No BYOK configured - return system fallback
      return getSystemFallbackConfig();
    }

    // If preferred provider specified, try to use it
    if (preferredProvider) {
      const providerRow = result.rows.find((r) => r.provider === preferredProvider);
      if (providerRow) {
        return {
          provider: providerRow.provider,
          keyData: JSON.parse(decrypt(providerRow.key_data)),
        };
      }
    }

    // Otherwise, use the first (most recently updated) provider
    const firstRow = result.rows[0];
    return {
      provider: firstRow.provider,
      keyData: JSON.parse(decrypt(firstRow.key_data)),
    };
  } catch (err) {
    console.error("Error fetching LLM provider config:", err);
    return null;
  }
}

/**
 * Get system fallback configuration from environment variables
 */
function getSystemFallbackConfig(): ProviderConfig | null {
  // Try OpenRouter first
  if (process.env.SYSTEM_OPENROUTER_KEY) {
    return {
      provider: "openrouter",
      keyData: { apiKey: process.env.SYSTEM_OPENROUTER_KEY },
    };
  }

  // Fall back to Anthropic
  if (process.env.SYSTEM_ANTHROPIC_KEY) {
    return {
      provider: "anthropic",
      keyData: { apiKey: process.env.SYSTEM_ANTHROPIC_KEY },
    };
  }

  // No system fallback configured
  return null;
}

/**
 * Get OpenRouter API client configuration
 * This can be used with standard OpenAI-compatible libraries
 */
export async function getOpenRouterConfig(userId: string): Promise<{
  apiKey: string;
  baseURL: string;
} | null> {
  const config = await getLLMProviderConfig(userId, "openrouter");
  if (!config || config.provider !== "openrouter") {
    return null;
  }

  return {
    apiKey: config.keyData.apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  };
}

/**
 * Get Anthropic API client configuration
 */
export async function getAnthropicConfig(userId: string): Promise<{
  apiKey: string;
} | null> {
  const config = await getLLMProviderConfig(userId, "anthropic");
  if (!config || config.provider !== "anthropic") {
    return null;
  }

  return {
    apiKey: config.keyData.apiKey,
  };
}

/**
 * Get AWS Bedrock configuration
 */
export async function getAWSBedrockConfig(userId: string): Promise<{
  bedrockApiKey?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
} | null> {
  const config = await getLLMProviderConfig(userId, "aws-bedrock");
  if (!config || config.provider !== "aws-bedrock") {
    return null;
  }

  return config.keyData;
}

/**
 * Get Google Vertex AI configuration
 */
export async function getGoogleVertexConfig(userId: string): Promise<{
  serviceAccountKey: object;
  region?: string;
} | null> {
  const config = await getLLMProviderConfig(userId, "google-vertex");
  if (!config || config.provider !== "google-vertex") {
    return null;
  }

  return config.keyData;
}

/**
 * Get Azure AI configuration
 */
export async function getAzureConfig(userId: string): Promise<
  Array<{
    model_slug: string;
    endpoint_url: string;
    api_key: string;
    model_id: string;
  }> | null
> {
  const config = await getLLMProviderConfig(userId, "azure");
  if (!config || config.provider !== "azure") {
    return null;
  }

  return config.keyData;
}

/**
 * Get a unified API endpoint for making LLM calls
 * This abstracts away the provider-specific details
 */
export async function getUnifiedLLMEndpoint(
  userId: string,
  model?: string
): Promise<{
  provider: string;
  apiKey: string;
  baseURL: string;
  model: string;
} | null> {
  const config = await getLLMProviderConfig(userId);
  if (!config) {
    return null;
  }

  // Most providers can use OpenAI-compatible endpoints
  switch (config.provider) {
    case "openrouter":
      return {
        provider: "openrouter",
        apiKey: config.keyData.apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        model: model || "moonshotai/kimi-k2.5",
      };
    case "anthropic":
      // Anthropic doesn't use OpenAI-compatible format, but we can note it here
      return {
        provider: "anthropic",
        apiKey: config.keyData.apiKey,
        baseURL: "https://api.anthropic.com/v1",
        model: model || "claude-3-5-sonnet-20241022",
      };
    default:
      return null;
  }
}
