"use client";

import { useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Bot,
  Building2,
  LayoutTemplate,
  Plug,
  Key,
  Rocket,
  MessageCircle,
  Mail,
  Github,
  CreditCard,
  FileText,
  Send,
  Shield,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const STEPS = [
  { id: 1, label: "Welcome", icon: Bot },
  { id: 2, label: "Business Info", icon: Building2 },
  { id: 3, label: "Squad Template", icon: LayoutTemplate },
  { id: 4, label: "Integrations", icon: Plug },
  { id: 5, label: "API Keys", icon: Key },
  { id: 6, label: "Review & Launch", icon: Rocket },
];

const STAGE_OPTIONS = [
  { value: "pre-revenue", label: "Pre-revenue" },
  { value: "early", label: "Early stage" },
  { value: "growth", label: "Growth" },
  { value: "scale", label: "Scale" },
];

const TEMPLATES = {
  "saas-growth": {
    name: "SaaS Growth",
    description: "All 21 agents — full squad for product-led growth",
    agents: [
      "marus", "forge", "canvas", "helm", "aegis", "vault", "architect", "patcher",
      "scout", "scribe", "sentinel", "lens", "herald", "oracle", "guide", "beacon", "shield", "compass",
      "warden", "prism", "clerk",
    ],
  },
  "content-creator": {
    name: "Content Creator",
    description: "MaruS, Scout, Scribe, Lens, Beacon, Compass",
    agents: ["marus", "scout", "scribe", "lens", "beacon", "compass"],
  },
  "e-commerce": {
    name: "E-Commerce",
    description: "MaruS, Scout, Scribe, Sentinel, Herald, Oracle, Canvas, Forge",
    agents: ["marus", "scout", "scribe", "sentinel", "herald", "oracle", "canvas", "forge"],
  },
  custom: {
    name: "Custom",
    description: "Pick individual agents",
    agents: [] as string[],
  },
};

const ALL_AGENTS = [
  { id: "marus", name: "MaruS", specialty: "Orchestrator / Lead" },
  { id: "forge", name: "Forge", specialty: "Backend Dev" },
  { id: "canvas", name: "Canvas", specialty: "Frontend / UI Dev" },
  { id: "helm", name: "Helm", specialty: "DevOps / Infra" },
  { id: "aegis", name: "Aegis", specialty: "QA / Testing" },
  { id: "vault", name: "Vault", specialty: "DBA / Database" },
  { id: "architect", name: "Architect", specialty: "System Design" },
  { id: "patcher", name: "Patcher", specialty: "Code Review / Refactor" },
  { id: "scout", name: "Scout", specialty: "Research" },
  { id: "scribe", name: "Scribe", specialty: "Content Writer" },
  { id: "sentinel", name: "Sentinel", specialty: "Retention" },
  { id: "lens", name: "Lens", specialty: "SEO" },
  { id: "herald", name: "Herald", specialty: "Outreach / Sales" },
  { id: "oracle", name: "Oracle", specialty: "Analytics" },
  { id: "guide", name: "Guide", specialty: "Onboarding" },
  { id: "beacon", name: "Beacon", specialty: "Social Media" },
  { id: "shield", name: "Shield", specialty: "Customer Support" },
  { id: "compass", name: "Compass", specialty: "Strategy / Planning" },
  { id: "warden", name: "Warden", specialty: "Security / Audit" },
  { id: "prism", name: "Prism", specialty: "Design / UX" },
  { id: "clerk", name: "Clerk", specialty: "Docs / Knowledge" },
];

const INTEGRATIONS = [
  { id: "telegram", name: "Telegram", description: "Primary notification channel (required)", icon: MessageCircle, required: true },
  { id: "slack", name: "Slack", description: "Team notifications and approvals", icon: Send, required: false },
  { id: "gmail", name: "Gmail", description: "Read-only email access for context", icon: Mail, required: false },
  { id: "github", name: "GitHub", description: "Code repos and PR automation", icon: Github, required: false },
  { id: "stripe", name: "Stripe", description: "Payments and billing data", icon: CreditCard, required: false },
  { id: "notion", name: "Notion", description: "Docs and knowledge base sync", icon: FileText, required: false },
  { id: "twitter", name: "X / Twitter", description: "Social listening and engagement", icon: Send, required: false },
];

interface OnboardingData {
  businessName: string;
  website: string;
  industry: string;
  stage: string;
  goal: string;
  template: keyof typeof TEMPLATES;
  customAgents: string[];
  integrations: Record<string, boolean>;
  anthropicApiKey: string;
  telegramBotToken: string;
  slackBotToken: string;
}

const initialData: OnboardingData = {
  businessName: "",
  website: "",
  industry: "",
  stage: "",
  goal: "",
  template: "saas-growth",
  customAgents: [],
  integrations: { telegram: true },
  anthropicApiKey: "",
  telegramBotToken: "",
  slackBotToken: "",
};

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [launched, setLaunched] = useState(false);

  const update = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(updates).forEach((k) => delete next[k]);
      return next;
    });
  };

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 2) {
      if (!data.businessName.trim()) newErrors.businessName = "Business name is required";
      if (!data.industry.trim()) newErrors.industry = "Industry is required";
      if (!data.stage) newErrors.stage = "Stage is required";
    }
    if (step === 3) {
      if (data.template === "custom" && data.customAgents.length === 0) {
        newErrors.customAgents = "Select at least one agent";
      }
    }
    if (step === 5) {
      if (!data.anthropicApiKey.trim()) newErrors.anthropicApiKey = "Anthropic API key is required";
      if (!data.telegramBotToken.trim()) newErrors.telegramBotToken = "Telegram bot token is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < 6) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleLaunch = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    try {
      const payload = {
        business: {
          name: data.businessName,
          website: data.website,
          industry: data.industry,
          stage: data.stage,
          goal: data.goal,
        },
        template: data.template,
        agents: data.template === "custom" ? data.customAgents : TEMPLATES[data.template].agents,
        integrations: data.integrations,
        apiKeys: {
          anthropic: data.anthropicApiKey,
          telegram: data.telegramBotToken,
          slack: data.slackBotToken || undefined,
        },
      };
      const res = await fetch(`${API}/api/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to launch");
      }
      setLaunched(true);
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : "Failed to launch SquadOps" });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleIntegration = (id: string) => {
    if (id === "telegram") return;
    update({
      integrations: { ...data.integrations, [id]: !data.integrations[id] },
    });
  };

  const toggleCustomAgent = (id: string) => {
    const next = data.customAgents.includes(id)
      ? data.customAgents.filter((a) => a !== id)
      : [...data.customAgents, id];
    update({ customAgents: next });
  };

  if (launched) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="card max-w-lg text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center mx-auto mb-6">
            <Rocket className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">SquadOps Launched!</h1>
          <p className="text-gray-400 mb-6">
            Your AI squad is being configured. You&apos;ll receive a Telegram message when setup is complete.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors"
          >
            Go to Dashboard
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-12">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                step === s.id
                  ? "border-indigo-500 bg-indigo-600 text-white"
                  : step > s.id
                  ? "border-emerald-600 bg-emerald-600/20 text-emerald-400"
                  : "border-gray-700 bg-gray-900 text-gray-500"
              }`}
            >
              {step > s.id ? (
                <span className="text-sm font-bold">✓</span>
              ) : (
                <s.icon className="w-4 h-4" />
              )}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 rounded ${
                  step > s.id ? "bg-emerald-600" : "bg-gray-800"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="card border-gray-800 mb-8">
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-indigo-600/20 flex items-center justify-center">
                <Bot className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Welcome to SquadOps</h2>
                <p className="text-gray-400">Let&apos;s get your AI operations squad ready</p>
              </div>
            </div>
            <p className="text-gray-300 leading-relaxed">
              SquadOps deploys <strong className="text-white">MaruS</strong> as your lead agent plus up to{" "}
              <strong className="text-white">20 specialist agents</strong> — from engineering (Forge, Canvas, Helm) to
              business (Scout, Scribe, Herald) and ops (Warden, Prism, Clerk). They work together on tasks, approvals,
              and goals while you stay in control.
            </p>
            <p className="text-gray-400 text-sm">
              This wizard will collect your business info, choose a squad template, configure integrations, and set up
              API keys. Takes about 3 minutes.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-white">Business Information</h2>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Business name *</label>
              <input
                type="text"
                value={data.businessName}
                onChange={(e) => update({ businessName: e.target.value })}
                placeholder="Acme Inc"
                className={`w-full px-4 py-3 rounded-xl bg-gray-950 border ${
                  errors.businessName ? "border-red-500" : "border-gray-700"
                } text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
              />
              {errors.businessName && <p className="text-red-400 text-sm mt-1">{errors.businessName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Website</label>
              <input
                type="url"
                value={data.website}
                onChange={(e) => update({ website: e.target.value })}
                placeholder="https://acme.com"
                className="w-full px-4 py-3 rounded-xl bg-gray-950 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Industry *</label>
              <input
                type="text"
                value={data.industry}
                onChange={(e) => update({ industry: e.target.value })}
                placeholder="SaaS, E-commerce, Media..."
                className={`w-full px-4 py-3 rounded-xl bg-gray-950 border ${
                  errors.industry ? "border-red-500" : "border-gray-700"
                } text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
              />
              {errors.industry && <p className="text-red-400 text-sm mt-1">{errors.industry}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Stage *</label>
              <select
                value={data.stage}
                onChange={(e) => update({ stage: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl bg-gray-950 border ${
                  errors.stage ? "border-red-500" : "border-gray-700"
                } text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
              >
                <option value="">Select stage</option>
                {STAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {errors.stage && <p className="text-red-400 text-sm mt-1">{errors.stage}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Primary goal</label>
              <textarea
                value={data.goal}
                onChange={(e) => update({ goal: e.target.value })}
                placeholder="e.g. Scale content production, automate customer support..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-gray-950 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-white">Squad Template</h2>
            <p className="text-gray-400 text-sm">Choose a preset or build a custom squad</p>
            <div className="grid gap-3">
              {(Object.keys(TEMPLATES) as Array<keyof typeof TEMPLATES>).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => update({ template: key })}
                  className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                    data.template === key
                      ? "border-indigo-500 bg-indigo-600/10"
                      : "border-gray-700 hover:border-gray-600 bg-gray-950/50"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                      data.template === key ? "border-indigo-500 bg-indigo-500" : "border-gray-600"
                    }`}
                  >
                    {data.template === key && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div>
                    <p className="font-medium text-white">{TEMPLATES[key].name}</p>
                    <p className="text-sm text-gray-400">{TEMPLATES[key].description}</p>
                  </div>
                </button>
              ))}
            </div>
            {data.template === "custom" && (
              <div className="pt-4 border-t border-gray-800">
                <p className="text-sm font-medium text-gray-300 mb-3">Select agents</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {ALL_AGENTS.map((a) => (
                    <label
                      key={a.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-800/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={data.customAgents.includes(a.id)}
                        onChange={() => toggleCustomAgent(a.id)}
                        className="rounded border-gray-600 bg-gray-950 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-300">{a.name}</span>
                    </label>
                  ))}
                </div>
                {errors.customAgents && <p className="text-red-400 text-sm mt-2">{errors.customAgents}</p>}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-white">Integrations</h2>
            <p className="text-gray-400 text-sm">Connect the services your squad will use</p>
            <div className="space-y-3">
              {INTEGRATIONS.map((int) => {
                const Icon = int.icon;
                const enabled = int.required || data.integrations[int.id];
                return (
                  <div
                    key={int.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border ${
                      enabled ? "border-gray-700 bg-gray-950/50" : "border-gray-800 bg-gray-950/30"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white flex items-center gap-2">
                        {int.name}
                        {int.required && (
                          <span className="text-xs text-amber-400 font-normal">(required)</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-400">{int.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => !int.required && toggleIntegration(int.id)}
                      disabled={int.required}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        enabled ? "bg-indigo-600" : "bg-gray-700"
                      } ${int.required ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          enabled ? "left-7" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-white">API Keys</h2>
            <p className="text-gray-400 text-sm">Required for AI and notifications</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Anthropic API Key *</label>
                <input
                  type="password"
                  value={data.anthropicApiKey}
                  onChange={(e) => update({ anthropicApiKey: e.target.value })}
                  placeholder="sk-ant-..."
                  className={`w-full px-4 py-3 rounded-xl bg-gray-950 border ${
                    errors.anthropicApiKey ? "border-red-500" : "border-gray-700"
                  } text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                />
                {errors.anthropicApiKey && <p className="text-red-400 text-sm mt-1">{errors.anthropicApiKey}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Telegram Bot Token *</label>
                <input
                  type="password"
                  value={data.telegramBotToken}
                  onChange={(e) => update({ telegramBotToken: e.target.value })}
                  placeholder="123456789:ABC..."
                  className={`w-full px-4 py-3 rounded-xl bg-gray-950 border ${
                    errors.telegramBotToken ? "border-red-500" : "border-gray-700"
                  } text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                />
                {errors.telegramBotToken && <p className="text-red-400 text-sm mt-1">{errors.telegramBotToken}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Slack Bot Token (optional)</label>
                <input
                  type="password"
                  value={data.slackBotToken}
                  onChange={(e) => update({ slackBotToken: e.target.value })}
                  placeholder="xoxb-..."
                  className="w-full px-4 py-3 rounded-xl bg-gray-950 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-900/20 border border-amber-800/50">
              <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-200/90">
                <p className="font-medium text-amber-300 mb-0.5">Security note</p>
                <p>
                  API keys are encrypted at rest and never logged. Only use keys with minimal required permissions.
                  Rotate keys if you suspect exposure.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Review & Launch</h2>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gray-950 border border-gray-800">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Business</p>
                <p className="text-white font-medium">{data.businessName}</p>
                {data.website && <p className="text-gray-400 text-sm">{data.website}</p>}
                <p className="text-gray-400 text-sm">{data.industry} • {STAGE_OPTIONS.find((s) => s.value === data.stage)?.label || data.stage}</p>
                {data.goal && <p className="text-gray-400 text-sm mt-1">{data.goal}</p>}
              </div>
              <div className="p-4 rounded-xl bg-gray-950 border border-gray-800">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Squad</p>
                <p className="text-white font-medium">{TEMPLATES[data.template].name}</p>
                <p className="text-gray-400 text-sm">
                  {data.template === "custom"
                    ? `${data.customAgents.length} agents`
                    : `${TEMPLATES[data.template].agents.length} agents`}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-950 border border-gray-800">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Integrations</p>
                <p className="text-gray-400 text-sm">
                  {Object.entries(data.integrations)
                    .filter(([, v]) => v)
                    .map(([k]) => INTEGRATIONS.find((i) => i.id === k)?.name || k)
                    .join(", ")}
                </p>
              </div>
            </div>
            {errors.submit && (
              <div className="p-4 rounded-xl bg-red-900/20 border border-red-800 text-red-400 text-sm">
                {errors.submit}
              </div>
            )}
            <button
              onClick={handleLaunch}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
            >
              {submitting ? (
                "Launching..."
              ) : (
                <>
                  Launch SquadOps
                  <Rocket className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      {step < 6 && (
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
