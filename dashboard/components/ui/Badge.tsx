"use client";

import { forwardRef, HTMLAttributes, ReactNode } from "react";

type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "outline";
type BadgeSize = "sm" | "md" | "lg";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  dotColor?: string;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-gray-800 text-gray-300 border-gray-700",
  primary: "bg-indigo-900/50 text-indigo-300 border-indigo-800",
  success: "bg-green-900/50 text-green-300 border-green-800",
  warning: "bg-yellow-900/50 text-yellow-300 border-yellow-800",
  error: "bg-red-900/50 text-red-300 border-red-800",
  info: "bg-blue-900/50 text-blue-300 border-blue-800",
  outline: "bg-transparent text-gray-400 border-gray-700",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      children,
      variant = "default",
      size = "md",
      dot = false,
      dotColor,
      className = "",
      ...props
    },
    ref
  ) => {
    const baseClasses = "badge border";
    const variantClasses = variantStyles[variant];
    const sizeClasses = sizeStyles[size];

    const dotStyle = dotColor
      ? { backgroundColor: dotColor }
      : undefined;

    return (
      <span
        ref={ref}
        className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
        {...props}
      >
        {dot && (
          <span
            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
              !dotColor ? "bg-current" : ""
            }`}
            style={dotStyle}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

// Status Badge with animated dot
interface StatusBadgeProps extends Omit<BadgeProps, "dot" | "variant"> {
  status: "active" | "paused" | "error" | "inactive" | string;
  showDot?: boolean;
}

const statusConfig: Record<
  string,
  { variant: BadgeVariant; dotColor: string; label: string }
> = {
  active: {
    variant: "success",
    dotColor: "#4ade80",
    label: "Active",
  },
  paused: {
    variant: "warning",
    dotColor: "#facc15",
    label: "Paused",
  },
  error: {
    variant: "error",
    dotColor: "#f87171",
    label: "Error",
  },
  inactive: {
    variant: "default",
    dotColor: "#6b7280",
    label: "Inactive",
  },
};

export function StatusBadge({
  status,
  showDot = true,
  children,
  ...props
}: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.inactive;

  return (
    <Badge
      variant={config.variant}
      dot={showDot}
      dotColor={config.dotColor}
      {...props}
    >
      {children || config.label}
    </Badge>
  );
}
