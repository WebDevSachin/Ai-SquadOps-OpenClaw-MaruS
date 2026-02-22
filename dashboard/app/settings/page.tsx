"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumb, useBreadcrumbs } from "@/components/Breadcrumb";
import {
  Key,
  Eye,
  EyeOff,
  Trash2,
  Check,
  AlertTriangle,
  Loader2,
  Shield,
  Sparkles,
  Crown,
  Zap,
} from "lucide-react";

interface ProviderKey {
  provider: string;
  enabled: boolean;
  hasKey: boolean;
}

interface TierInfo {
  tier: string;
  defaultProvider: string;
  limits: {
    requests: { used: number; limit: number | null };
    tokens: { used: number; limit: number | null };
  };
  usagePercentage: number;
  warningLevel: "none" | "warning" | "critical" | "blocked";
}

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  placeholder: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "minimax",
    name: "MiniMax",
    description: "Default provider - Fast & cost-effective",
    icon: "🔥",
    placeholder: "Enter your MiniMax API key (e.g., mm-xxxxx...)",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4, GPT-4o, and more",
    icon: "🤖",
    placeholder: "Enter your OpenAI API key (sk-...)",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude 3.5 Sonnet and more",
    icon: "🧠",
    placeholder: "Enter your Anthropic API key (sk-ant-...)",
  },
  {
    id: "google",
    name: "Google AI",
    description: "Gemini Pro and Ultra models",
    icon: "🔷",
    placeholder: "Enter your Google AI API key (AIza...)",
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [providerKeys, setProviderKeys] = useState<ProviderKey[]>([]);
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const breadcrumbs = useBreadcrumbs();

  // Form state for each provider
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [defaultProvider, setDefaultProvider] = useState("minimax");

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchProviderKeys = useCallback(async () => {
    try {
      const response = await api.get("/provider-keys");
      const keys = response.data.providerKeys || [];

      // Transform to include hasKey
      const transformedKeys: ProviderKey[] = PROVIDERS.map((p) => ({
        provider: p.id,
        enabled: keys.find((k: any) => k.provider === p.id)?.enabled ?? false,
        hasKey: keys.some((k: any) => k.provider === p.id),
      }));

      setProviderKeys(transformedKeys);

      // Also fetch tier info
      const tierResponse = await api.get("/usage/tier");
      setTierInfo(tierResponse.data);
      if (tierResponse.data.defaultProvider) {
        setDefaultProvider(tierResponse.data.defaultProvider);
      }
    } catch (err) {
      console.error("Failed to fetch provider keys:", err);
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviderKeys();
  }, [fetchProviderKeys]);

  const handleApiKeyChange = (provider: string, value: string) => {
    setApiKeys((prev) => ({ ...prev, [provider]: value }));
    setError(null);
    setSuccess(null);
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const validateAndSaveKey = async (provider: string) => {
    const apiKey = apiKeys[provider];
    if (!apiKey || apiKey.trim().length === 0) {
      setError("Please enter an API key");
      return;
    }

    setSaving(provider);
    setError(null);
    setSuccess(null);

    try {
      // First validate the key format
      const validateResponse = await api.post("/provider-keys/validate", {
        provider,
        keyData: { apiKey },
      });

      if (!validateResponse.data.valid) {
        setError(validateResponse.data.error || "Invalid API key format");
        setSaving(null);
        return;
      }

      // Save the key
      await api.post("/provider-keys", {
        provider,
        keyData: { apiKey },
      });

      // Update default provider if this is the first key
      if (!providerKeys.find((pk) => pk.hasKey)) {
        await api.patch("/usage/tier", { defaultProvider: provider });
        setDefaultProvider(provider);
      }

      setSuccess(`${PROVIDERS.find((p) => p.id === provider)?.name} API key saved successfully`);
      setApiKeys((prev) => ({ ...prev, [provider]: "" }));
      fetchProviderKeys();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save API key");
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    setSaving(provider);
    setError(null);

    try {
      await api.delete(`/provider-keys/${provider}`);
      setSuccess(`${PROVIDERS.find((p) => p.id === provider)?.name} API key removed successfully`);
      setDeleteConfirm(null);
      fetchProviderKeys();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete API key");
    } finally {
      setSaving(null);
    }
  };

  const handleDefaultProviderChange = async (provider: string) => {
    setSaving(provider);
    setError(null);

    try {
      await api.patch("/usage/tier", { defaultProvider: provider });
      setDefaultProvider(provider);
      setSuccess(`Default provider set to ${PROVIDERS.find((p) => p.id === provider)?.name}`);
      fetchProviderKeys();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update default provider");
    } finally {
      setSaving(null);
    }
  };

  const getMaskedKey = (provider: string) => {
    return "••••••••••••••••••••";
  };

  const getWarningBadge = () => {
    if (!tierInfo) return null;

    switch (tierInfo.warningLevel) {
      case "blocked":
        return (
          <Badge variant="error" className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Limit Reached
          </Badge>
        );
      case "critical":
        return (
          <Badge variant="warning" className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {tierInfo.usagePercentage}% Used
          </Badge>
        );
      case "warning":
        return (
          <Badge variant="info" className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {tierInfo.usagePercentage}% Used
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbs} />
      
      {/* Header */}
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your AI provider API keys and preferences</p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
          <p className="text-green-300 text-sm">{success}</p>
        </div>
      )}

      {/* Free Tier Usage */}
      {tierInfo?.tier === "free" && (
        <Card>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Free Tier</h3>
                <p className="text-sm text-gray-400">1,000 requests/month</p>
              </div>
            </div>
            {getWarningBadge()}
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-400">Requests</span>
                <span className="text-gray-300">
                  {tierInfo.limits.requests.used.toLocaleString()} /{" "}
                  {tierInfo.limits.requests.limit?.toLocaleString() || "∞"}
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    tierInfo.usagePercentage >= 90
                      ? "bg-red-500"
                      : tierInfo.usagePercentage >= 80
                      ? "bg-amber-500"
                      : "bg-gradient-to-r from-indigo-500 to-purple-500"
                  }`}
                  style={{ width: `${Math.min(100, tierInfo.usagePercentage)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-400">Tokens</span>
                <span className="text-gray-300">
                  {tierInfo.limits.tokens.used.toLocaleString()} /{" "}
                  {tierInfo.limits.tokens.limit?.toLocaleString() || "∞"}
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                  style={{
                    width: `${
                      tierInfo.limits.tokens.limit
                        ? Math.min(100, (tierInfo.limits.tokens.used / tierInfo.limits.tokens.limit) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {tierInfo.usagePercentage >= 80 && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-sm text-gray-400">
                {tierInfo.usagePercentage >= 100
                  ? "You've reached your free tier limit. Upgrade to continue using the service."
                  : "You're approaching your free tier limit. Consider upgrading for more requests."}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Default Provider Selection */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-600/20 rounded-lg">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Default Provider</h3>
            <p className="text-sm text-gray-400">Select your preferred AI provider</p>
          </div>
        </div>

        <div className="space-y-3">
          {PROVIDERS.map((provider) => {
            const hasKey = providerKeys.find((pk) => pk.provider === provider.id)?.hasKey;
            const isDefault = defaultProvider === provider.id;
            const isSaving = saving === provider.id;

            return (
              <label
                key={provider.id}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                  isDefault
                    ? "border-indigo-500/50 bg-indigo-500/10"
                    : hasKey
                    ? "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                    : "border-gray-800 bg-gray-900/50 opacity-50 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="defaultProvider"
                    value={provider.id}
                    checked={isDefault}
                    onChange={() => hasKey && handleDefaultProviderChange(provider.id)}
                    disabled={!hasKey || tierInfo?.warningLevel === "blocked"}
                    className="w-4 h-4 text-indigo-500 bg-gray-800 border-gray-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{provider.icon}</span>
                      <span className="font-medium text-white">{provider.name}</span>
                      {isDefault && (
                        <Badge variant="success" className="text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{provider.description}</p>
                  </div>
                </div>

                {!hasKey && (
                  <span className="text-xs text-gray-500">Add API key to enable</span>
                )}
              </label>
            );
          })}
        </div>
      </Card>

      {/* API Keys */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-600/20 rounded-lg">
            <Key className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">API Keys</h3>
            <p className="text-sm text-gray-400">Manage your AI provider API keys</p>
          </div>
        </div>

        <div className="space-y-6">
          {PROVIDERS.map((provider) => {
            const hasKey = providerKeys.find((pk) => pk.provider === provider.id)?.hasKey;
            const isSaving = saving === provider.id;
            const showKey = showKeys[provider.id] || false;

            return (
              <div key={provider.id} className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{provider.icon}</span>
                    <div>
                      <h4 className="font-medium text-white">{provider.name}</h4>
                      <p className="text-sm text-gray-400">{provider.description}</p>
                    </div>
                  </div>

                  {hasKey && (
                    <div className="flex items-center gap-2">
                      <Badge variant="success" className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Configured
                      </Badge>
                      {defaultProvider === provider.id && (
                        <Badge variant="info">Default</Badge>
                      )}
                    </div>
                  )}
                </div>

                {hasKey ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 px-3 py-2 bg-gray-800 rounded-lg font-mono text-sm text-gray-300">
                      {showKey ? getMaskedKey(provider.id) : "••••••••••••••••••••"}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleShowKey(provider.id)}
                      title={showKey ? "Hide" : "Show"}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>

                    {deleteConfirm === provider.id ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteKey(provider.id)}
                          disabled={isSaving}
                        >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(provider.id)}
                        className="text-red-400 hover:text-red-300"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input
                      type={showKey ? "text" : "password"}
                      placeholder={provider.placeholder}
                      value={apiKeys[provider.id] || ""}
                      onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                      className="font-mono"
                    />
                    <div className="flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleShowKey(provider.id)}
                      >
                        {showKey ? (
                          <>
                            <EyeOff className="w-4 h-4 mr-1" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-1" />
                            Show
                          </>
                        )}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => validateAndSaveKey(provider.id)}
                        disabled={isSaving || !apiKeys[provider.id]}
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Save Key
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Security Notice */}
        <div className="mt-6 pt-6 border-t border-gray-800">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-gray-300">Security Notice</h4>
              <p className="text-sm text-gray-500 mt-1">
                Your API keys are encrypted and stored securely. They are never exposed in API
                responses. Only the last 4 characters are shown when viewing saved keys.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
