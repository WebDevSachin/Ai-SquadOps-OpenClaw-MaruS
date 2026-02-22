"use client";

import { useState } from "react";
import {
  Settings,
  Save,
  Key,
  Bell,
  Shield,
  Database,
  Globe,
  Mail,
  CheckCircle,
} from "lucide-react";
import { Breadcrumb, useBreadcrumbs } from "@/components/Breadcrumb";

interface SettingSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
}

const sections: SettingSection[] = [
  {
    id: "general",
    title: "General",
    icon: Settings,
    description: "Basic system configuration",
  },
  {
    id: "security",
    title: "Security",
    icon: Shield,
    description: "Authentication and access control",
  },
  {
    id: "api",
    title: "API & Keys",
    icon: Key,
    description: "External API configurations",
  },
  {
    id: "notifications",
    title: "Notifications",
    icon: Bell,
    description: "Alert and email settings",
  },
  {
    id: "database",
    title: "Database",
    icon: Database,
    description: "Connection and backup settings",
  },
  {
    id: "integrations",
    title: "Integrations",
    icon: Globe,
    description: "Third-party service connections",
  },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("general");
  const [saved, setSaved] = useState(false);
  const breadcrumbs = useBreadcrumbs();
  const [settings, setSettings] = useState({
    // General
    siteName: "SquadOps",
    siteDescription: "AI Agent Operations Hub",
    timezone: "UTC",
    dateFormat: "MM/DD/YYYY",

    // Security
    require2FA: false,
    sessionTimeout: 30,
    passwordMinLength: 8,
    maxLoginAttempts: 5,

    // API
    youtubeApiKey: "",
    openaiApiKey: "",
    rateLimitPerMinute: 60,

    // Notifications
    emailNotifications: true,
    slackWebhook: "",
    alertOnError: true,
    dailyDigest: false,

    // Database
    backupEnabled: true,
    backupFrequency: "daily",
    retentionDays: 30,

    // Integrations
    slackEnabled: false,
    discordWebhook: "",
    githubToken: "",
  });

  const handleSave = () => {
    // Simulate API call
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateSetting = (key: string, value: string | boolean | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const ActiveIcon = sections.find((s) => s.id === activeSection)?.icon || Settings;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbs} />
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-emerald-500" />
          Settings
        </h1>
        <p className="text-gray-400 mt-1">
          Configure system-wide settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeSection === section.id
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <section.icon className="w-5 h-5" />
              <div>
                <p className="font-medium">{section.title}</p>
                <p
                  className={`text-xs ${
                    activeSection === section.id ? "text-indigo-200" : "text-gray-500"
                  }`}
                >
                  {section.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-900/50 rounded-lg">
                <ActiveIcon className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {sections.find((s) => s.id === activeSection)?.title}
                </h2>
                <p className="text-sm text-gray-400">
                  {sections.find((s) => s.id === activeSection)?.description}
                </p>
              </div>
            </div>

            {/* General Settings */}
            {activeSection === "general" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Site Name
                  </label>
                  <input
                    type="text"
                    value={settings.siteName}
                    onChange={(e) => updateSetting("siteName", e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Site Description
                  </label>
                  <input
                    type="text"
                    value={settings.siteDescription}
                    onChange={(e) => updateSetting("siteDescription", e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Timezone
                    </label>
                    <select
                      value={settings.timezone}
                      onChange={(e) => updateSetting("timezone", e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="UTC">UTC</option>
                      <option value="EST">EST</option>
                      <option value="PST">PST</option>
                      <option value="GMT">GMT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Date Format
                    </label>
                    <select
                      value={settings.dateFormat}
                      onChange={(e) => updateSetting("dateFormat", e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeSection === "security" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-200">Require 2FA</p>
                    <p className="text-sm text-gray-500">
                      Enforce two-factor authentication for all users
                    </p>
                  </div>
                  <button
                    onClick={() => updateSetting("require2FA", !settings.require2FA)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.require2FA ? "bg-indigo-600" : "bg-gray-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.require2FA ? "translate-x-6" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Session Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) => updateSetting("sessionTimeout", parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Minimum Password Length
                  </label>
                  <input
                    type="number"
                    value={settings.passwordMinLength}
                    onChange={(e) => updateSetting("passwordMinLength", parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Max Login Attempts
                  </label>
                  <input
                    type="number"
                    value={settings.maxLoginAttempts}
                    onChange={(e) => updateSetting("maxLoginAttempts", parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* API Settings */}
            {activeSection === "api" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    YouTube API Key
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={settings.youtubeApiKey}
                      onChange={(e) => updateSetting("youtubeApiKey", e.target.value)}
                      placeholder="Enter your YouTube API key"
                      className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
                      Test
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    OpenAI API Key
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={settings.openaiApiKey}
                      onChange={(e) => updateSetting("openaiApiKey", e.target.value)}
                      placeholder="Enter your OpenAI API key"
                      className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
                      Test
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Rate Limit (requests per minute)
                  </label>
                  <input
                    type="number"
                    value={settings.rateLimitPerMinute}
                    onChange={(e) => updateSetting("rateLimitPerMinute", parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Notifications Settings */}
            {activeSection === "notifications" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-200">Email Notifications</p>
                      <p className="text-sm text-gray-500">
                        Receive email alerts for important events
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting("emailNotifications", !settings.emailNotifications)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.emailNotifications ? "bg-indigo-600" : "bg-gray-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.emailNotifications ? "translate-x-6" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-200">Alert on Error</p>
                    <p className="text-sm text-gray-500">
                      Send notifications when agents encounter errors
                    </p>
                  </div>
                  <button
                    onClick={() => updateSetting("alertOnError", !settings.alertOnError)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.alertOnError ? "bg-indigo-600" : "bg-gray-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.alertOnError ? "translate-x-6" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-200">Daily Digest</p>
                    <p className="text-sm text-gray-500">
                      Receive a daily summary of activities
                    </p>
                  </div>
                  <button
                    onClick={() => updateSetting("dailyDigest", !settings.dailyDigest)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.dailyDigest ? "bg-indigo-600" : "bg-gray-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.dailyDigest ? "translate-x-6" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Slack Webhook URL
                  </label>
                  <input
                    type="text"
                    value={settings.slackWebhook}
                    onChange={(e) => updateSetting("slackWebhook", e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Database Settings */}
            {activeSection === "database" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-200">Automatic Backups</p>
                    <p className="text-sm text-gray-500">
                      Enable scheduled database backups
                    </p>
                  </div>
                  <button
                    onClick={() => updateSetting("backupEnabled", !settings.backupEnabled)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.backupEnabled ? "bg-indigo-600" : "bg-gray-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.backupEnabled ? "translate-x-6" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Backup Frequency
                  </label>
                  <select
                    value={settings.backupFrequency}
                    onChange={(e) => updateSetting("backupFrequency", e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Retention Period (days)
                  </label>
                  <input
                    type="number"
                    value={settings.retentionDays}
                    onChange={(e) => updateSetting("retentionDays", parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors">
                    Test Connection
                  </button>
                  <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors">
                    Run Backup Now
                  </button>
                </div>
              </div>
            )}

            {/* Integrations Settings */}
            {activeSection === "integrations" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-200">Slack Integration</p>
                    <p className="text-sm text-gray-500">
                      Enable Slack bot for notifications
                    </p>
                  </div>
                  <button
                    onClick={() => updateSetting("slackEnabled", !settings.slackEnabled)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.slackEnabled ? "bg-indigo-600" : "bg-gray-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.slackEnabled ? "translate-x-6" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Discord Webhook URL
                  </label>
                  <input
                    type="text"
                    value={settings.discordWebhook}
                    onChange={(e) => updateSetting("discordWebhook", e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    GitHub Access Token
                  </label>
                  <input
                    type="password"
                    value={settings.githubToken}
                    onChange={(e) => updateSetting("githubToken", e.target.value)}
                    placeholder="ghp_..."
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex items-center justify-end gap-4 mt-6 pt-6 border-t border-gray-800">
              {saved && (
                <span className="flex items-center gap-2 text-sm text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  Settings saved successfully
                </span>
              )}
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
