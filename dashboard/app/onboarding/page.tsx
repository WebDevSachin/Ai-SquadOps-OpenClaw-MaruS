"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Rocket, 
  CheckCircle, 
  Circle, 
  ArrowRight, 
  Building2, 
  Bot, 
  Plug, 
  Key, 
  Briefcase,
  Globe,
  Target,
  ChevronLeft,
  Loader2,
  MessageCircle,
  Check,
  AlertCircle,
  Users,
  X,
  Shield
} from "lucide-react";
import { Card, Button } from "@/components/ui";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface Provider {
  id: string;
  name: string;
  placeholder: string;
  validatePattern: RegExp;
  isSystemAvailable?: boolean;
}

interface OnboardingData {
  business: {
    name: string;
    website: string;
    industry: string;
    stage: string;
    goal: string;
  };
  template: string;
  role?: string;
  agents: string[];
  integrations: {
    telegram: boolean;
    slack: boolean;
    discord: boolean;
  };
  providerKeys: {
    provider: string;
    key: string;
  }[];
  useSystemKeys: Record<string, boolean>; // Track which providers use system keys
  teamEmails: string[];
}

interface ValidationError {
  field: string;
  message: string;
}

const INDUSTRIES = [
  "Technology",
  "Finance",
  "Healthcare",
  "Education",
  "E-commerce",
  "Marketing",
  "Consulting",
  "Other",
];

const STAGES = [
  { value: "startup", label: "Startup", description: "Early stage, building MVP" },
  { value: "growth", label: "Growth", description: "Product-market fit, scaling" },
  { value: "established", label: "Established", description: "Mature business, optimizing" },
];

const TEMPLATES = [
  { 
    id: "customer-support", 
    name: "Customer Support", 
    description: "AI agents for handling customer inquiries",
    icon: MessageCircle,
    roles: ["member", "admin", "user"]
  },
  { 
    id: "sales-automation", 
    name: "Sales Automation", 
    description: "Lead generation and sales outreach",
    icon: Target,
    roles: ["member", "admin", "user"]
  },
  { 
    id: "operations", 
    name: "Operations Hub", 
    description: "Internal operations and task management",
    icon: Briefcase,
    roles: ["member", "admin", "user"]
  },
  { 
    id: "development", 
    name: "Development Team", 
    description: "AI agents for software development and code review",
    icon: Bot,
    roles: ["member", "admin", "user"]
  },
  { 
    id: "marketing", 
    name: "Marketing & Content", 
    description: "Content creation, social media, and SEO optimization",
    icon: Globe,
    roles: ["member", "admin", "user"]
  },
  { 
    id: "research", 
    name: "Research & Analytics", 
    description: "Data analysis, market research, and insights",
    icon: Target,
    roles: ["admin"]
  },
  { 
    id: "custom", 
    name: "Custom Setup", 
    description: "Build your own agent configuration",
    icon: Bot,
    roles: ["member", "admin", "user"]
  },
];

// Role-specific agents
const ROLE_AGENTS: Record<string, typeof AGENT_TYPES> = {
  member: [
    { id: "responder", name: "Email Responder", description: "Handles email inquiries" },
    { id: "scheduler", name: "Meeting Scheduler", description: "Manages calendar and meetings" },
    { id: "researcher", name: "Research Assistant", description: "Gathers and analyzes information" },
    { id: "writer", name: "Content Writer", description: "Creates and edits content" },
    { id: "analyst", name: "Data Analyst", description: "Analyzes data and generates reports" },
  ],
  admin: [
    { id: "responder", name: "Email Responder", description: "Handles email inquiries" },
    { id: "scheduler", name: "Meeting Scheduler", description: "Manages calendar and meetings" },
    { id: "researcher", name: "Research Assistant", description: "Gathers and analyzes information" },
    { id: "writer", name: "Content Writer", description: "Creates and edits content" },
    { id: "analyst", name: "Data Analyst", description: "Analyzes data and generates reports" },
    { id: "orchestrator", name: "Swarm Orchestrator", description: "Manages multi-agent workflows" },
    { id: "security", name: "Security Auditor", description: "Monitors and audits system security" },
  ],
  user: [
    { id: "responder", name: "Email Responder", description: "Handles email inquiries" },
    { id: "scheduler", name: "Meeting Scheduler", description: "Manages calendar and meetings" },
    { id: "researcher", name: "Research Assistant", description: "Gathers and analyzes information" },
    { id: "writer", name: "Content Writer", description: "Creates and edits content" },
  ],
};

const AGENT_TYPES = [
  { id: "responder", name: "Email Responder", description: "Handles email inquiries" },
  { id: "scheduler", name: "Meeting Scheduler", description: "Manages calendar and meetings" },
  { id: "researcher", name: "Research Assistant", description: "Gathers and analyzes information" },
  { id: "writer", name: "Content Writer", description: "Creates and edits content" },
  { id: "analyst", name: "Data Analyst", description: "Analyzes data and generates reports" },
];

const PROVIDERS = [
  { id: "openai", name: "OpenAI", placeholder: "sk-...", validatePattern: /^sk-[a-zA-Z0-9]{32,}$/ },
  { id: "anthropic", name: "Anthropic", placeholder: "sk-ant-...", validatePattern: /^sk-ant-[a-zA-Z0-9-]+$/ },
  { id: "google", name: "Google AI", placeholder: "AIza...", validatePattern: /^AIza[a-zA-Z0-9_-]{35,}$/ },
  { id: "minimax", name: "MiniMax", placeholder: "mk-...", validatePattern: /^mk-[a-zA-Z0-9]{32,}$/, isSystemAvailable: true },
];

// Storage key for draft data
const ONBOARDING_DRAFT_KEY = "onboarding-draft";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [keyValidationStatus, setKeyValidationStatus] = useState<Record<string, "idle" | "validating" | "valid" | "invalid">>({});
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [usageLimits, setUsageLimits] = useState<Record<string, { remaining: number; limit: number }>>({});
  const [loadingUsageLimits, setLoadingUsageLimits] = useState(false);
  
  // Load draft from localStorage on mount
  const [data, setData] = useState<OnboardingData>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed._currentStep !== undefined) {
            setCurrentStep(parsed._currentStep);
          }
          return {
            business: parsed.business || { name: "", website: "", industry: "", stage: "", goal: "" },
            template: parsed.template || "",
            role: parsed.role || user?.role || "member",
            agents: parsed.agents || [],
            integrations: parsed.integrations || { telegram: true, slack: false, discord: false },
            providerKeys: parsed.providerKeys || [],
            useSystemKeys: parsed.useSystemKeys || { minimax: true },
            teamEmails: parsed.teamEmails || [""],
          };
        } catch {
          console.error("Failed to parse onboarding draft");
        }
      }
    }
    return {
      business: { name: "", website: "", industry: "", stage: "", goal: "" },
      template: "",
      role: user?.role || "member",
      agents: [],
      integrations: { telegram: true, slack: false, discord: false },
      providerKeys: [],
      useSystemKeys: { minimax: true }, // Default to system key for MiniMax
      teamEmails: [""],
    };
  });

  // Auto-save draft to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && !completed) {
      const draft = { ...data, _currentStep: currentStep, _savedAt: new Date().toISOString() };
      localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
    }
  }, [data, currentStep, completed]);

  // Clear draft on completion
  useEffect(() => {
    if (completed && typeof window !== "undefined") {
      localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    }
  }, [completed]);

  // Announce step changes to screen readers
  useEffect(() => {
    const announcement = document.getElementById("step-announcement");
    if (announcement) {
      announcement.textContent = `Step ${currentStep + 1} of ${steps.length}: ${steps[currentStep].title}`;
    }
  }, [currentStep]);

  // Redirect admin users to /admin
  useEffect(() => {
    if (!authLoading && isAdmin) {
      router.push("/admin");
    }
  }, [authLoading, isAdmin, router]);

  // Redirect users with completed onboarding to /
  useEffect(() => {
    if (!authLoading && user && user.onboardingCompleted) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  const steps = [
    { title: "Business Info", icon: Building2 },
    { title: "Template", icon: Briefcase },
    { title: "Agents", icon: Bot },
    { title: "Integrations", icon: Plug },
    { title: "Provider Keys", icon: Key },
    { title: "Team Invite", icon: Users },
  ];

  // Get role from data or user
  const getUserRole = (): string => {
    return data.role || user?.role || "member";
  };

  // Get templates filtered by role
  const getRoleTemplates = () => {
    const role = getUserRole();
    return TEMPLATES.filter(t => t.roles.includes(role));
  };

  // Get agents filtered by role
  const getRoleAgents = () => {
    const role = getUserRole();
    return ROLE_AGENTS[role] || ROLE_AGENTS.member;
  };

  const validateStep = useCallback((): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    switch (currentStep) {
      case 0:
        if (!data.business.name.trim()) {
          errors.push({ field: "businessName", message: "Business name is required" });
        } else if (data.business.name.length < 2) {
          errors.push({ field: "businessName", message: "Business name must be at least 2 characters" });
        }
        if (!data.business.industry) {
          errors.push({ field: "industry", message: "Please select an industry" });
        }
        if (!data.business.stage) {
          errors.push({ field: "stage", message: "Please select a business stage" });
        }
        if (data.business.website && !isValidUrl(data.business.website)) {
          errors.push({ field: "website", message: "Please enter a valid URL" });
        }
        break;
      case 1:
        if (!data.template) {
          errors.push({ field: "template", message: "Please select a template" });
        }
        break;
      case 2:
        if (data.agents.length === 0) {
          errors.push({ field: "agents", message: "Please select at least one agent" });
        }
        break;
      case 3:
        if (!data.integrations.telegram) {
          errors.push({ field: "telegram", message: "Telegram integration is required" });
        }
        break;
      case 5:
        // Team invite is optional, but validate emails if provided
        data.teamEmails.forEach((email, index) => {
          if (email && !isValidEmail(email)) {
            errors.push({ field: `email-${index}`, message: `Invalid email address at position ${index + 1}` });
          }
        });
        break;
    }
    
    return errors;
  }, [currentStep, data]);

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Fetch usage limits for free tier
  const fetchUsageLimits = useCallback(async () => {
    setLoadingUsageLimits(true);
    try {
      const response = await api.get("/usage/limits");
      setUsageLimits(response.data.limits || {});
    } catch (err) {
      console.error("Failed to fetch usage limits:", err);
      // Set default limits for free tier
      setUsageLimits({
        minimax: { remaining: 100, limit: 100 },
        openai: { remaining: 0, limit: 0 },
        anthropic: { remaining: 0, limit: 0 },
        google: { remaining: 0, limit: 0 },
      });
    } finally {
      setLoadingUsageLimits(false);
    }
  }, []);

  // Load usage limits when reaching provider keys step
  useEffect(() => {
    if (currentStep === 4) {
      fetchUsageLimits();
    }
  }, [currentStep, fetchUsageLimits]);

  // Fetch saved progress from database on mount
  const fetchSavedProgress = useCallback(async () => {
    try {
      const response = await api.get("/onboarding/progress");
      const savedData = response.data.data;
      
      if (savedData && savedData.currentStep > 0) {
        // Restore saved progress
        setCurrentStep(savedData.currentStep);
        
        // Update data if we have saved values
        if (savedData.business) {
          setData(prev => ({
            ...prev,
            business: { 
              ...prev.business, 
              ...savedData.business 
            },
            template: savedData.template || prev.template,
            agents: savedData.agents || prev.agents,
            integrations: savedData.integrations 
              ? { ...prev.integrations, ...savedData.integrations }
              : prev.integrations,
            useSystemKeys: savedData.useSystemKeys || prev.useSystemKeys,
          }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch saved progress:", err);
      // Continue with localStorage data
    }
  }, []);

  // Load saved progress on mount
  useEffect(() => {
    if (user && !completed) {
      fetchSavedProgress();
    }
  }, [user, completed, fetchSavedProgress]);

  // Save progress to database when step changes
  const saveProgressToDatabase = useCallback(async () => {
    if (!user || completed) return;
    
    try {
      await api.put("/onboarding/progress", {
        currentStep,
        business: data.business,
        template: data.template,
        agents: data.agents,
        integrations: data.integrations,
        providerKeys: data.providerKeys.map(pk => ({
          provider: pk.provider,
          key: pk.key,
          useSystemKey: data.useSystemKeys[pk.provider] || false,
        })),
      });
    } catch (err) {
      console.error("Failed to save progress to database:", err);
      // Silent fail - localStorage will still have the data
    }
  }, [user, completed, currentStep, data]);

  // Auto-save to database when step changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveProgressToDatabase();
    }, 1000); // Debounce 1 second
    
    return () => clearTimeout(timer);
  }, [currentStep, data, saveProgressToDatabase]);

  const canProceed = useCallback(() => {
    const errors = validateStep();
    return errors.length === 0;
  }, [validateStep]);

  const handleNext = () => {
    const errors = validateStep();
    if (errors.length > 0) {
      setValidationErrors(errors);
      // Focus first error field
      const firstError = document.getElementById(errors[0].field);
      if (firstError) {
        firstError.focus();
      }
      return;
    }
    
    setValidationErrors([]);
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    setValidationErrors([]);
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await api.post("/onboarding/skip");
      setCompleted(true);
      setShowWelcomeModal(true);
      
      // Set onboarding cookie for middleware
      document.cookie = "onboarding=completed; path=/; max-age=2592000"; // 30 days
    } catch (err: any) {
      console.error("Skip error:", err);
      setError(err.response?.data?.error || "Failed to skip onboarding");
      setLoading(false);
    }
  };

  const validateApiKey = async (provider: string, key: string) => {
    if (!key.trim()) return;
    
    setKeyValidationStatus(prev => ({ ...prev, [provider]: "validating" }));
    
    // Simulate API validation (replace with real validation endpoint)
    setTimeout(() => {
      const providerConfig = PROVIDERS.find(p => p.id === provider);
      const isValid = providerConfig?.validatePattern.test(key) ?? false;
      
      setKeyValidationStatus(prev => ({ 
        ...prev, 
        [provider]: isValid ? "valid" : "invalid" 
      }));
    }, 1000);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Include system key preferences in the payload
      const systemKeyProviders = Object.entries(data.useSystemKeys)
        .filter(([_, useSystem]) => useSystem)
        .map(([provider]) => provider);

      const payload = {
        business: data.business,
        template: data.template || "custom",
        role: data.role,
        agents: data.agents.length > 0 ? data.agents : ["responder"],
        integrations: data.integrations,
        providerKeys: data.providerKeys
          .filter(pk => pk.key.trim())
          .map(pk => ({
            provider: pk.provider,
            keyData: { key: pk.key },
            useSystemKey: data.useSystemKeys[pk.provider] || false,
          })),
        // Include system key providers
        systemKeyProviders,
        teamEmails: data.teamEmails.filter(email => email.trim()),
      };

      await api.post("/onboarding", payload);
      
      // Send team invites if any emails provided
      const validEmails = data.teamEmails.filter(email => email.trim() && isValidEmail(email));
      if (validEmails.length > 0) {
        try {
          await api.post("/onboarding/invites", { emails: validEmails });
        } catch (inviteErr) {
          console.error("Failed to send invites:", inviteErr);
          // Don't fail onboarding if invites fail
        }
      }
      
      // Set cookie for middleware (server-side should also set this, but this is a backup)
      document.cookie = "onboarding=completed; path=/; max-age=2592000; SameSite=Lax";
      
      setCompleted(true);
      setShowWelcomeModal(true);
    } catch (err: any) {
      console.error("Onboarding error:", err);
      setError(err.response?.data?.error || "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  const toggleAgent = (agentId: string) => {
    setData(prev => ({
      ...prev,
      agents: prev.agents.includes(agentId)
        ? prev.agents.filter(id => id !== agentId)
        : [...prev.agents, agentId],
    }));
  };

  const updateProviderKey = (provider: string, key: string) => {
    setData(prev => {
      const existing = prev.providerKeys.find(pk => pk.provider === provider);
      if (existing) {
        return {
          ...prev,
          providerKeys: prev.providerKeys.map(pk => 
            pk.provider === provider ? { ...pk, key } : pk
          ),
        };
      }
      return {
        ...prev,
        providerKeys: [...prev.providerKeys, { provider, key }],
      };
    });
    
    // Reset validation status when key changes
    setKeyValidationStatus(prev => ({ ...prev, [provider]: "idle" }));
  };

  const getProviderKey = (provider: string) => {
    return data.providerKeys.find(pk => pk.provider === provider)?.key || "";
  };

  // Toggle between BYOK (Bring Your Own Key) and System Key
  const toggleSystemKey = (provider: string, useSystem: boolean) => {
    setData(prev => ({
      ...prev,
      useSystemKeys: {
        ...prev.useSystemKeys,
        [provider]: useSystem,
      },
    }));
    
    // Clear the key if switching to system key
    if (useSystem) {
      setData(prev => ({
        ...prev,
        providerKeys: prev.providerKeys.map(pk => 
          pk.provider === provider ? { ...pk, key: "" } : pk
        ),
      }));
      setKeyValidationStatus(prev => ({ ...prev, [provider]: "idle" }));
    }
  };

  // Check if a provider should use system key
  const useSystemKey = (provider: string) => {
    return data.useSystemKeys[provider] ?? false;
  };

  const addTeamEmail = () => {
    setData(prev => ({
      ...prev,
      teamEmails: [...prev.teamEmails, ""],
    }));
  };

  const removeTeamEmail = (index: number) => {
    setData(prev => ({
      ...prev,
      teamEmails: prev.teamEmails.filter((_, i) => i !== index),
    }));
  };

  const updateTeamEmail = (index: number, email: string) => {
    setData(prev => ({
      ...prev,
      teamEmails: prev.teamEmails.map((e, i) => i === index ? email : e),
    }));
  };

  const getFieldError = (field: string): string | undefined => {
    return validationErrors.find(e => e.field === field)?.message;
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  // Show loading spinner while auth is checking
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (completed && showWelcomeModal) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" role="main" aria-label="Onboarding Complete">
        <Card className="max-w-md w-full text-center p-8">
          <div className="w-20 h-20 bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6" aria-hidden="true">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to SquadOps!</h1>
          <p className="text-gray-400 mb-6">
            Your onboarding is complete. You&apos;re all set to start using AI agents.
          </p>
          <div className="space-y-3">
            <Button 
              onClick={() => router.push("/")}
              className="w-full"
              aria-label="Go to Dashboard"
            >
              Go to Dashboard
            </Button>
            <Button 
              variant="secondary"
              onClick={() => router.push("/agents")}
              className="w-full"
              aria-label="Set up your first agent"
            >
              Set Up Your First Agent
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen p-4 sm:p-6 lg:p-8" 
      role="main" 
      aria-label="SquadOps Onboarding"
    >
      {/* Live region for screen reader announcements */}
      <div 
        id="step-announcement" 
        className="sr-only" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
      />
      
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <div 
            className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-500/20"
            aria-hidden="true"
          >
            <Rocket className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to SquadOps</h1>
          <p className="text-gray-400">
            Let&apos;s get you set up with your AI agent operations hub
          </p>
        </header>

        {/* Progress */}
        <nav aria-label="Onboarding progress">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400" id="step-counter">
                Step {currentStep + 1} of {steps.length}
              </span>
              <span className="text-sm font-medium text-white" aria-label={`${Math.round(progress)}% complete`}>
                {Math.round(progress)}%
              </span>
            </div>
            <div 
              className="h-2 bg-gray-800 rounded-full overflow-hidden"
              role="progressbar" 
              aria-valuenow={Math.round(progress)} 
              aria-valuemin={0} 
              aria-valuemax={100}
              aria-labelledby="step-counter"
            >
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            {/* Step indicators */}
            <div className="flex justify-between mt-4" role="list" aria-label="Steps">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;
                
                return (
                  <div 
                    key={index}
                    className={`flex flex-col items-center gap-2 ${
                      isActive ? "text-indigo-400" : isCompleted ? "text-green-400" : "text-gray-600"
                    }`}
                    role="listitem"
                    aria-current={isActive ? "step" : undefined}
                    aria-label={`${step.title} ${isCompleted ? "completed" : isActive ? "current" : "pending"}`}
                  >
                    <div 
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isActive 
                          ? "bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-2 ring-offset-gray-950" 
                          : isCompleted 
                            ? "bg-green-600 text-white" 
                            : "bg-gray-800 text-gray-500"
                      }`}
                      aria-hidden="true"
                    >
                      {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className="text-xs hidden sm:block font-medium">{step.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Error */}
        {error && (
          <div 
            className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-xl text-red-400 flex items-start gap-3"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Step Content */}
        <section aria-label={`Step ${currentStep + 1}: ${steps[currentStep].title}`}>
          <Card className="mb-6">
            {/* Step 1: Business Info */}
            {currentStep === 0 && (
              <fieldset className="space-y-6">
                <legend className="text-xl font-semibold text-white mb-1">Business Information</legend>
                <p className="text-sm text-gray-400 mb-4">Tell us about your business</p>

                <div>
                  <label htmlFor="businessName" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Business Name <span aria-label="required">*</span>
                  </label>
                  <input
                    id="businessName"
                    type="text"
                    value={data.business.name}
                    onChange={(e) => setData(prev => ({
                      ...prev,
                      business: { ...prev.business, name: e.target.value }
                    }))}
                    className={`input ${getFieldError("businessName") ? "border-red-500 focus:border-red-500" : ""}`}
                    placeholder="Acme Inc."
                    aria-required="true"
                    aria-invalid={!!getFieldError("businessName")}
                    aria-describedby={getFieldError("businessName") ? "businessName-error" : undefined}
                  />
                  {getFieldError("businessName") && (
                    <p id="businessName-error" className="mt-1.5 text-sm text-red-400" role="alert">
                      {getFieldError("businessName")}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Website (optional)
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" aria-hidden="true" />
                    <input
                      id="website"
                      type="url"
                      value={data.business.website}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        business: { ...prev.business, website: e.target.value }
                      }))}
                      className={`input pl-10 ${getFieldError("website") ? "border-red-500 focus:border-red-500" : ""}`}
                      placeholder="https://example.com"
                      aria-invalid={!!getFieldError("website")}
                      aria-describedby={getFieldError("website") ? "website-error" : undefined}
                    />
                  </div>
                  {getFieldError("website") && (
                    <p id="website-error" className="mt-1.5 text-sm text-red-400" role="alert">
                      {getFieldError("website")}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="industry" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Industry <span aria-label="required">*</span>
                  </label>
                  <select
                    id="industry"
                    value={data.business.industry}
                    onChange={(e) => setData(prev => ({
                      ...prev,
                      business: { ...prev.business, industry: e.target.value }
                    }))}
                    className={`input ${getFieldError("industry") ? "border-red-500 focus:border-red-500" : ""}`}
                    aria-required="true"
                    aria-invalid={!!getFieldError("industry")}
                    aria-describedby={getFieldError("industry") ? "industry-error" : undefined}
                  >
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                  {getFieldError("industry") && (
                    <p id="industry-error" className="mt-1.5 text-sm text-red-400" role="alert">
                      {getFieldError("industry")}
                    </p>
                  )}
                </div>

                <fieldset>
                  <legend className="block text-sm font-medium text-gray-300 mb-1.5">
                    Business Stage <span aria-label="required">*</span>
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {STAGES.map(stage => (
                      <button
                        key={stage.value}
                        type="button"
                        onClick={() => setData(prev => ({
                          ...prev,
                          business: { ...prev.business, stage: stage.value }
                        }))}
                        className={`p-3 rounded-xl text-left border transition-all ${
                          data.business.stage === stage.value
                            ? "border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-950"
                            : "border-gray-700 hover:border-gray-600"
                        } ${getFieldError("stage") ? "border-red-500" : ""}`}
                        aria-pressed={data.business.stage === stage.value}
                      >
                        <div className="font-medium text-white text-sm">{stage.label}</div>
                        <div className="text-xs text-gray-500 mt-1">{stage.description}</div>
                      </button>
                    ))}
                  </div>
                  {getFieldError("stage") && (
                    <p id="stage-error" className="mt-1.5 text-sm text-red-400" role="alert">
                      {getFieldError("stage")}
                    </p>
                  )}
                </fieldset>

                <div>
                  <label htmlFor="goal" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Primary Goal (optional)
                  </label>
                  <textarea
                    id="goal"
                    value={data.business.goal}
                    onChange={(e) => setData(prev => ({
                      ...prev,
                      business: { ...prev.business, goal: e.target.value }
                    }))}
                    className="input min-h-[80px] resize-none"
                    placeholder="What do you want to achieve with AI agents?"
                  />
                </div>
              </fieldset>
            )}

            {/* Step 2: Template */}
            {currentStep === 1 && (
              <fieldset className="space-y-6">
                <legend className="text-xl font-semibold text-white mb-1">Choose a Template</legend>
                <p className="text-sm text-gray-400 mb-4">
                  Select a starting configuration for your agents
                  {getUserRole() === 'admin' && <span className="text-indigo-400 ml-1">(Admin mode - advanced templates available)</span>}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="radiogroup" aria-label="Template selection">
                  {getRoleTemplates().map(template => {
                    const Icon = template.icon;
                    const isSelected = data.template === template.id;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setData(prev => ({ ...prev, template: template.id }))}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-950"
                            : "border-gray-700 hover:border-gray-600"
                        }`}
                        role="radio"
                        aria-checked={isSelected}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isSelected ? "bg-indigo-600" : "bg-gray-800"
                          }`} aria-hidden="true">
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-white">{template.name}</div>
                            <div className="text-sm text-gray-500 mt-0.5">{template.description}</div>
                          </div>
                          {isSelected && (
                            <CheckCircle className="w-5 h-5 text-indigo-400" aria-hidden="true" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {getFieldError("template") && (
                  <p className="text-sm text-red-400" role="alert">{getFieldError("template")}</p>
                )}
              </fieldset>
            )}

            {/* Step 3: Agents */}
            {currentStep === 2 && (
              <fieldset className="space-y-6">
                <legend className="text-xl font-semibold text-white mb-1">Select Agents</legend>
                <p className="text-sm text-gray-400 mb-4">
                  Choose which AI agents you want to enable (select at least one)
                  {getUserRole() === 'admin' && <span className="text-indigo-400 ml-1">(Admin: additional orchestration and security agents available)</span>}
                </p>

                <div className="space-y-3">
                  {getRoleAgents().map(agent => {
                    const isSelected = data.agents.includes(agent.id);
                    return (
                      <label
                        key={agent.id}
                        className={`w-full p-4 rounded-xl border text-left transition-all flex items-center gap-4 cursor-pointer ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-500/10"
                            : "border-gray-700 hover:border-gray-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleAgent(agent.id)}
                          className="sr-only"
                          aria-describedby={`${agent.id}-description`}
                        />
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-500"
                            : "border-gray-600"
                        }`} aria-hidden="true">
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-white">{agent.name}</div>
                          <div id={`${agent.id}-description`} className="text-sm text-gray-500">{agent.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {getFieldError("agents") && (
                  <p className="text-sm text-red-400" role="alert">{getFieldError("agents")}</p>
                )}
              </fieldset>
            )}

            {/* Step 4: Integrations */}
            {currentStep === 3 && (
              <fieldset className="space-y-6">
                <legend className="text-xl font-semibold text-white mb-1">Connect Integrations</legend>
                <p className="text-sm text-gray-400 mb-4">Enable the platforms you want your agents to work with</p>

                <div className="space-y-3">
                  {/* Telegram - Required */}
                  <div className={`p-4 rounded-xl border ${
                    data.integrations.telegram 
                      ? "border-indigo-500 bg-indigo-500/10" 
                      : getFieldError("telegram") ? "border-red-800 bg-red-900/10" : "border-gray-700"
                  }`}>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-3">
                        <MessageCircle className="w-6 h-6 text-blue-400" aria-hidden="true" />
                        <div>
                          <div className="font-medium text-white">Telegram</div>
                          <div className="text-sm text-gray-500">Required for agent communication</div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={data.integrations.telegram}
                        onChange={(e) => setData(prev => ({
                          ...prev,
                          integrations: { ...prev.integrations, telegram: e.target.checked }
                        }))}
                        className="sr-only peer"
                        aria-required="true"
                      />
                      <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-700 peer-checked:bg-indigo-600 transition-colors">
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          data.integrations.telegram ? "translate-x-6" : "translate-x-1"
                        }`} />
                      </div>
                    </label>
                    {!data.integrations.telegram && (
                      <p className="text-sm text-red-400 mt-2" role="alert">
                        Telegram integration is required
                      </p>
                    )}
                  </div>

                  {/* Slack */}
                  <div className={`p-4 rounded-xl border ${
                    data.integrations.slack 
                      ? "border-indigo-500 bg-indigo-500/10" 
                      : "border-gray-700"
                  }`}>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center text-xs font-bold text-white" aria-hidden="true">S</div>
                        <div>
                          <div className="font-medium text-white">Slack</div>
                          <div className="text-sm text-gray-500">Connect your Slack workspace</div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={data.integrations.slack}
                        onChange={(e) => setData(prev => ({
                          ...prev,
                          integrations: { ...prev.integrations, slack: e.target.checked }
                        }))}
                        className="sr-only peer"
                      />
                      <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-700 peer-checked:bg-indigo-600 transition-colors">
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          data.integrations.slack ? "translate-x-6" : "translate-x-1"
                        }`} />
                      </div>
                    </label>
                  </div>

                  {/* Discord */}
                  <div className={`p-4 rounded-xl border ${
                    data.integrations.discord 
                      ? "border-indigo-500 bg-indigo-500/10" 
                      : "border-gray-700"
                  }`}>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-bold text-white" aria-hidden="true">D</div>
                        <div>
                          <div className="font-medium text-white">Discord</div>
                          <div className="text-sm text-gray-500">Connect your Discord server</div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={data.integrations.discord}
                        onChange={(e) => setData(prev => ({
                          ...prev,
                          integrations: { ...prev.integrations, discord: e.target.checked }
                        }))}
                        className="sr-only peer"
                      />
                      <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-700 peer-checked:bg-indigo-600 transition-colors">
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          data.integrations.discord ? "translate-x-6" : "translate-x-1"
                        }`} />
                      </div>
                    </label>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Step 5: Provider Keys */}
            {currentStep === 4 && (
              <fieldset className="space-y-6">
                <legend className="text-xl font-semibold text-white mb-1">AI Provider Keys</legend>
                <p className="text-sm text-gray-400">
                  Add your API keys for AI providers (optional - you can use system keys for MiniMax or add your own later)
                </p>

                {/* Free tier usage limits */}
                {loadingUsageLimits ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading usage limits...
                  </div>
                ) : (
                  <div className="p-4 bg-indigo-900/20 border border-indigo-800/50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-5 h-5 text-indigo-400" />
                      <span className="text-sm font-medium text-indigo-300">Free Tier</span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Free tier: <span className="text-white font-medium">{usageLimits.minimax?.remaining ?? 100} requests remaining</span> with MiniMax (system key)
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {PROVIDERS.map(provider => {
                    const status = keyValidationStatus[provider.id];
                    const isUsingSystemKey = useSystemKey(provider.id);
                    const providerLimit = usageLimits[provider.id];
                    const hasSystemOption = provider.isSystemAvailable;

                    return (
                      <div key={provider.id} className="p-4 bg-gray-800/30 rounded-xl border border-gray-700">
                        <div className="flex items-center justify-between mb-3">
                          <label htmlFor={`provider-${provider.id}`} className="block text-sm font-medium text-gray-300">
                            {provider.name}
                          </label>
                          
                          {/* BYOK vs System Key Toggle */}
                          {hasSystemOption && (
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${isUsingSystemKey ? 'text-indigo-400' : 'text-gray-500'}`}>
                                Use System Key
                              </span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={!isUsingSystemKey}
                                onClick={() => toggleSystemKey(provider.id, !isUsingSystemKey)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  isUsingSystemKey ? 'bg-indigo-600' : 'bg-gray-600'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                    isUsingSystemKey ? 'translate-x-4.5' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                              <span className={`text-xs ${!isUsingSystemKey ? 'text-indigo-400' : 'text-gray-500'}`}>
                                Bring Your Own
                              </span>
                            </div>
                          )}
                        </div>

                        {/* System key indicator */}
                        {isUsingSystemKey && hasSystemOption && (
                          <div className="mb-3 p-2 bg-indigo-900/30 rounded-lg flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-indigo-400" />
                            <span className="text-xs text-indigo-300">
                              Using system MiniMax key ({providerLimit?.remaining ?? 100} requests remaining)
                            </span>
                          </div>
                        )}

                        {/* API Key Input - only show if not using system key */}
                        {(!hasSystemOption || !isUsingSystemKey) && (
                          <div className="relative">
                            <input
                              id={`provider-${provider.id}`}
                              type="password"
                              value={getProviderKey(provider.id)}
                              onChange={(e) => updateProviderKey(provider.id, e.target.value)}
                              onBlur={() => validateApiKey(provider.id, getProviderKey(provider.id))}
                              className={`input pr-24 ${
                                status === "valid" ? "border-green-500" : 
                                status === "invalid" ? "border-red-500" : ""
                              }`}
                              placeholder={provider.placeholder}
                              aria-describedby={`${provider.id}-status`}
                              disabled={hasSystemOption && isUsingSystemKey}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              {status === "validating" && (
                                <Loader2 className="w-5 h-5 text-gray-500 animate-spin" aria-hidden="true" />
                              )}
                              {status === "valid" && (
                                <CheckCircle className="w-5 h-5 text-green-500" aria-hidden="true" />
                              )}
                              {status === "invalid" && (
                                <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
                              )}
                            </div>
                          </div>
                        )}

                        {/* Usage limit info for BYOK */}
                        {!isUsingSystemKey && providerLimit && providerLimit.limit > 0 && (
                          <p className="mt-2 text-xs text-gray-500">
                            Your key: {providerLimit.remaining} / {providerLimit.limit} requests remaining
                          </p>
                        )}
                        
                        <p id={`${provider.id}-status`} className="sr-only">
                          {status === "validating" ? "Validating key..." : 
                           status === "valid" ? "Key is valid" : 
                           status === "invalid" ? "Key format is invalid" : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 bg-gray-800/50 rounded-xl">
                  <p className="text-sm text-gray-400">
                    <strong className="text-white">Note:</strong> Your API keys are encrypted and stored securely. 
                    MiniMax system keys include 100 free requests. You can skip this step and add keys later from Settings.
                  </p>
                </div>
              </fieldset>
            )}

            {/* Step 6: Team Invite */}
            {currentStep === 5 && (
              <fieldset className="space-y-6">
                <legend className="text-xl font-semibold text-white mb-1">Invite Your Team</legend>
                <p className="text-sm text-gray-400 mb-4">
                  Invite team members to collaborate (optional)
                </p>

                <div className="space-y-3">
                  {data.teamEmails.map((email, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1">
                        <label htmlFor={`team-email-${index}`} className="sr-only">
                          Team member email {index + 1}
                        </label>
                        <input
                          id={`team-email-${index}`}
                          type="email"
                          value={email}
                          onChange={(e) => updateTeamEmail(index, e.target.value)}
                          className={`input ${getFieldError(`email-${index}`) ? "border-red-500" : ""}`}
                          placeholder="colleague@company.com"
                          aria-invalid={!!getFieldError(`email-${index}`)}
                          aria-describedby={getFieldError(`email-${index}`) ? `email-${index}-error` : undefined}
                        />
                        {getFieldError(`email-${index}`) && (
                          <p id={`email-${index}-error`} className="mt-1 text-sm text-red-400" role="alert">
                            {getFieldError(`email-${index}`)}
                          </p>
                        )}
                      </div>
                      {data.teamEmails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTeamEmail(index)}
                          className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                          aria-label={`Remove email ${index + 1}`}
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addTeamEmail}
                  className="text-sm text-indigo-400 hover:text-indigo-300 font-medium"
                  disabled={data.teamEmails.length >= 10}
                >
                  + Add another team member
                </button>

                <p className="text-xs text-gray-500">
                  Team members will receive an invitation email to join your SquadOps workspace.
                </p>
              </fieldset>
            )}
          </Card>
        </section>

        {/* Navigation */}
        <nav aria-label="Step navigation" className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 0 || loading}
            leftIcon={<ChevronLeft className="w-4 h-4" />}
            aria-label="Go to previous step"
          >
            Back
          </Button>

          <div className="flex items-center gap-3">
            {currentStep === steps.length - 1 && (
              <Button
                variant="ghost"
                onClick={handleSkip}
                disabled={loading}
                aria-label="Skip and complete later"
              >
                Skip for now
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={loading}
              rightIcon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              aria-label={currentStep === steps.length - 1 ? "Complete setup" : "Continue to next step"}
            >
              {currentStep === steps.length - 1 
                ? (loading ? "Completing..." : "Complete Setup") 
                : "Continue"}
            </Button>
          </div>
        </nav>
      </div>
    </div>
  );
}
