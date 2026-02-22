"use client";

import { forwardRef, HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  shimmer?: boolean;
  circle?: boolean;
  width?: string | number;
  height?: string | number;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      className = "",
      shimmer = true,
      circle = false,
      width,
      height,
      style,
      ...props
    },
    ref
  ) => {
    const baseClasses = "skeleton";
    const shimmerClass = shimmer ? " skeleton-shimmer" : "";
    const circleClass = circle ? " rounded-full" : "";

    const customStyles = {
      width: width,
      height: height,
      ...style,
    };

    return (
      <div
        ref={ref}
        className={`${baseClasses}${shimmerClass}${circleClass} ${className}`}
        style={customStyles}
        {...props}
      />
    );
  }
);

Skeleton.displayName = "Skeleton";

// Skeleton Card Component
interface SkeletonCardProps {
  className?: string;
  icon?: boolean;
  lines?: number;
}

export function SkeletonCard({
  className = "",
  icon = true,
  lines = 2,
}: SkeletonCardProps) {
  return (
    <div className={`card skeleton-shimmer ${className}`}>
      <div className="flex items-center gap-4">
        {icon && <Skeleton circle width={44} height={44} shimmer={false} />}
        <div className="flex-1 space-y-2">
          <Skeleton height={16} width="60%" shimmer={false} />
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
              key={i}
              height={12}
              width={i === lines - 1 ? "40%" : "80%"}
              shimmer={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Skeleton List Component
interface SkeletonListProps {
  className?: string;
  items?: number;
  avatar?: boolean;
}

export function SkeletonList({
  className = "",
  items = 5,
  avatar = true,
}: SkeletonListProps) {
  return (
    <div className={`card skeleton-shimmer space-y-4 ${className}`}>
      <Skeleton height={20} width="30%" shimmer={false} />
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          {avatar && <Skeleton circle width={32} height={32} shimmer={false} />}
          <div className="flex-1 space-y-1.5">
            <Skeleton height={14} width="75%" shimmer={false} />
            <Skeleton height={10} width="50%" shimmer={false} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Skeleton Table Component
interface SkeletonTableProps {
  className?: string;
  rows?: number;
  columns?: number;
}

export function SkeletonTable({
  className = "",
  rows = 5,
  columns = 4,
}: SkeletonTableProps) {
  return (
    <div className={`card overflow-hidden !p-0 skeleton-shimmer ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-6 py-4">
                <Skeleton height={12} width={`${60 + Math.random() * 30}%`} shimmer={false} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-gray-800/50">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="px-6 py-4">
                  <Skeleton
                    height={colIndex === 2 ? 20 : 14}
                    width={colIndex === 2 ? "80%" : `${70 + Math.random() * 20}%`}
                    className={colIndex === 2 ? "rounded-full" : "rounded"}
                    shimmer={false}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Skeleton Grid Component
interface SkeletonGridProps {
  className?: string;
  items?: number;
  columns?: number;
}

export function SkeletonGrid({
  className = "",
  items = 8,
  columns = 4,
}: SkeletonGridProps) {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-${columns} gap-4 ${className}`}
    >
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="card skeleton-shimmer space-y-3">
          <div className="flex items-start justify-between">
            <Skeleton width={40} height={40} className="rounded-lg" shimmer={false} />
            <Skeleton width={60} height={16} className="rounded" shimmer={false} />
          </div>
          <Skeleton height={16} width="70%" shimmer={false} />
          <Skeleton height={12} width="100%" shimmer={false} />
          <Skeleton height={20} width={60} className="rounded-full" shimmer={false} />
        </div>
      ))}
    </div>
  );
}

// Page Skeleton Component
interface PageSkeletonProps {
  className?: string;
  statCards?: number;
  showList?: boolean;
}

export function PageSkeleton({
  className = "",
  statCards = 4,
  showList = true,
}: PageSkeletonProps) {
  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header Skeleton */}
      <div>
        <Skeleton height={32} width={200} className="mb-2" shimmer={false} />
        <Skeleton height={16} width={300} shimmer={false} />
      </div>

      {/* Stat Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: statCards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Content Skeleton */}
      {showList && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <SkeletonList items={5} />
          </div>
          <div className="lg:col-span-2">
            <SkeletonList items={5} avatar />
          </div>
        </div>
      )}
    </div>
  );
}
