"use client";

import { forwardRef, HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
}

const paddingStyles = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      hover = false,
      interactive = false,
      padding = "md",
      className = "",
      ...props
    },
    ref
  ) => {
    let cardClass = "card";
    
    if (interactive) {
      cardClass += " card-interactive";
    } else if (hover) {
      cardClass += " card-hover";
    }
    
    cardClass += ` ${paddingStyles[padding]}`;
    
    if (className) {
      cardClass += ` ${className}`;
    }

    return (
      <div ref={ref} className={cardClass} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

// Card Header Component
interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex items-center justify-between mb-4 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = "CardHeader";

// Card Title Component
interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
  className?: string;
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={`text-lg font-semibold text-white ${className}`}
        {...props}
      >
        {children}
      </h3>
    );
  }
);

CardTitle.displayName = "CardTitle";

// Card Content Component
interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <div ref={ref} className={className} {...props}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = "CardContent";

// Card Footer Component
interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex items-center justify-between mt-4 pt-4 border-t border-gray-800 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = "CardFooter";
