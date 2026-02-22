"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Filter, Check } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  multiple?: boolean;
}

interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string | string[]>;
  onChange: (key: string, value: string | string[]) => void;
  onClear?: () => void;
  className?: string;
}

export function FilterBar({
  filters,
  values,
  onChange,
  onClear,
  className = "",
}: FilterBarProps) {
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpenFilter(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle filter toggle
  const handleFilterClick = (key: string) => {
    setOpenFilter(openFilter === key ? null : key);
  };

  // Handle option selection
  const handleOptionSelect = (key: string, value: string) => {
    onChange(key, value);
    setOpenFilter(null);
  };

  // Get active filter count
  const activeFilterCount = Object.values(values).filter(
    (v) => v && (Array.isArray(v) ? v.length > 0 : v !== "all")
  ).length;

  // Has any active filters
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div
      ref={dropdownRef}
      className={`flex flex-wrap items-center gap-2 ${className}`}
    >
      {/* Filter Buttons */}
      {filters.map((filter) => {
        const isOpen = openFilter === filter.key;
        const selectedValue = values[filter.key];
        const selectedOption = filter.options.find(
          (opt) => opt.value === selectedValue
        );
        const isActive = selectedValue && selectedValue !== "all";

        return (
          <div key={filter.key} className="relative">
            <button
              onClick={() => handleFilterClick(filter.key)}
              className={`
                flex items-center gap-2 px-3 py-2 text-sm rounded-xl
                transition-all duration-200 border
                ${
                  isActive
                    ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                    : "bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700"
                }
              `}
            >
              <Filter className="w-4 h-4" />
              <span>
                {filter.label}: {selectedOption?.label || "All"}
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown */}
            {isOpen && (
              <div className="absolute top-full mt-1 left-0 z-50 bg-gray-900 border border-gray-800 rounded-xl shadow-xl py-1 min-w-[180px] animate-fade-in">
                {filter.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleOptionSelect(filter.key, option.value)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 text-sm
                      transition-colors hover:bg-gray-800
                      ${
                        selectedValue === option.value
                          ? "text-indigo-400 bg-indigo-500/10"
                          : "text-gray-300"
                      }
                    `}
                  >
                    <span>{option.label}</span>
                    <div className="flex items-center gap-2">
                      {option.count !== undefined && (
                        <span className="text-xs text-gray-500">
                          {option.count}
                        </span>
                      )}
                      {selectedValue === option.value && (
                        <Check className="w-4 h-4 text-indigo-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Clear All Button */}
      {hasActiveFilters && onClear && (
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
          Clear all
        </button>
      )}
    </div>
  );
}

// Standalone Filter Dropdown Component
interface FilterDropdownProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  className?: string;
}

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  className = "",
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 text-sm rounded-xl
          transition-all duration-200 border
          ${
            value && value !== "all"
              ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
              : "bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700"
          }
        `}
      >
        <Filter className="w-4 h-4" />
        <span>
          {label}: {selectedOption?.label || "All"}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-gray-900 border border-gray-800 rounded-xl shadow-xl py-1 min-w-[150px] animate-fade-in">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`
                w-full flex items-center justify-between px-3 py-2 text-sm
                transition-colors hover:bg-gray-800
                ${
                  value === option.value
                    ? "text-indigo-400 bg-indigo-500/10"
                    : "text-gray-300"
                }
              `}
            >
              <span>{option.label}</span>
              {value === option.value && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default FilterBar;
