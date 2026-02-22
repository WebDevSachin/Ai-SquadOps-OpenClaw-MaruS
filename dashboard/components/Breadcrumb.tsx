"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1 text-sm ${className}`}>
      {/* Home Link */}
      <Link
        href="/"
        className="flex items-center gap-1.5 text-gray-500 hover:text-white transition-colors"
      >
        <Home className="w-4 h-4" />
        <span className="sr-only lg:not-sr-only">Home</span>
      </Link>

      {items.map((item, index) => (
        <div key={item.href || index} className="flex items-center gap-1.5">
          <ChevronRight className="w-4 h-4 text-gray-600" />
          {item.href ? (
            <Link
              href={item.href}
              className="text-gray-500 hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-300 font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}

// Hook to generate breadcrumbs from pathname
export function useBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname();

  // Map of paths to breadcrumb labels
  const pathLabels: Record<string, string> = {
    "": "Dashboard",
    "/": "Dashboard",
    "/tasks": "Tasks",
    "/goals": "Goals",
    "/agents": "Agents",
    "/messages": "Messages",
    "/approvals": "Approvals",
    "/audit": "Audit Log",
    "/usage": "Usage",
    "/recurring": "Recurring",
    "/workflows": "Workflows",
    "/settings": "Settings",
    "/onboarding": "Onboarding",
    "/admin": "Admin",
    "/admin/users": "Users",
    "/admin/swarm": "Agent Swarm",
    "/admin/settings": "Settings",
  };

  // Generate breadcrumbs from pathname
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  let currentPath = "";
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;

    // Check if this is a dynamic route segment (e.g., [id])
    if (segment.startsWith("[") && segment.endsWith("]")) {
      // For dynamic routes, we don't add a breadcrumb item
      return;
    }

    // Find the label for this path
    let label = pathLabels[currentPath];

    // If no direct match, check for partial matches
    if (!label) {
      // Try to find a parent path
      const parentPath = `/${segments.slice(0, index + 1).join("/")}`;
      label = pathLabels[parentPath];
    }

    // If still no label, format the segment as a label
    if (!label) {
      label = segment
        .replace(/-/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^\w/, (c) => c.toUpperCase());
    }

    // Determine if this is the last item (current page)
    const isLast = index === segments.length - 1;

    breadcrumbs.push({
      label,
      href: isLast ? undefined : currentPath,
    });
  });

  return breadcrumbs;
}

export default Breadcrumb;
