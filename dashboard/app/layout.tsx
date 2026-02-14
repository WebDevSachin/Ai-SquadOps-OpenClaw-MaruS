import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import {
  LayoutDashboard,
  Bot,
  ListTodo,
  MessageSquare,
  ShieldCheck,
  ScrollText,
  Target,
  BarChart3,
  RefreshCw,
  Rocket,
} from "lucide-react";

export const metadata: Metadata = {
  title: "SquadOps Dashboard",
  description: "AI Agent Operations Hub",
};

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/onboarding", label: "Onboarding", icon: Rocket },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/usage", label: "Usage", icon: BarChart3 },
  { href: "/recurring", label: "Recurring", icon: RefreshCw },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
          {/* Logo */}
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  SquadOps
                </h1>
                <p className="text-xs text-gray-500">Ops Hub</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <item.icon className="w-4.5 h-4.5" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-300">
                SO
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">Admin</p>
                <p className="text-xs text-gray-500">squadops.ai</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-950">
          <div className="p-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
