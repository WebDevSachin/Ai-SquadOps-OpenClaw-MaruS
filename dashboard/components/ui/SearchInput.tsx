"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";

export interface SearchSuggestion {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface SearchInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  suggestions?: SearchSuggestion[];
  loading?: boolean;
  onSuggestionClick?: (suggestion: SearchSuggestion) => void;
  debounceMs?: number;
  className?: string;
  autoFocus?: boolean;
}

export function SearchInput({
  value = "",
  onChange,
  onSearch,
  placeholder = "Search...",
  suggestions = [],
  loading = false,
  onSuggestionClick,
  debounceMs = 300,
  className = "",
  autoFocus = false,
}: SearchInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Handle click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  const debouncedSearch = useCallback(
    (query: string) => {
      if (debounceMs > 0) {
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }
        const timeout = setTimeout(() => {
          onSearch?.(query);
        }, debounceMs);
        setDebounceTimeout(timeout);
      } else {
        onSearch?.(query);
      }
    },
    [debounceTimeout, debounceMs, onSearch]
  );

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setShowSuggestions(true);
    onChange?.(newValue);
    debouncedSearch(newValue);
  };

  // Handle clear
  const handleClear = () => {
    setInputValue("");
    setShowSuggestions(false);
    onChange?.("");
    onSearch?.("");
    inputRef.current?.focus();
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setInputValue(suggestion.label);
    setShowSuggestions(false);
    onSuggestionClick?.(suggestion);
    onChange?.(suggestion.label);
    onSearch?.(suggestion.label);
  };

  // Handle keydown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowSuggestions(false);
    } else if (e.key === "Enter") {
      setShowSuggestions(false);
      onSearch?.(inputValue);
    }
  };

  const hasSuggestions = suggestions.length > 0;
  const showDropdown = showSuggestions && hasSuggestions;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="input-with-icon text-sm w-full pr-10"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
        />
        {/* Loading or Clear Button */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
          ) : inputValue ? (
            <button
              onClick={handleClear}
              className="text-gray-500 hover:text-white transition-colors"
              type="button"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {showDropdown && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-gray-900 border border-gray-800 rounded-xl shadow-xl max-h-80 overflow-y-auto animate-fade-in">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800 transition-colors"
            >
              {suggestion.icon && (
                <div className="text-gray-400">{suggestion.icon}</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">
                  {suggestion.label}
                </p>
                {suggestion.description && (
                  <p className="text-xs text-gray-500 truncate">
                    {suggestion.description}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Keyboard Shortcut Hint Component
interface SearchShortcutProps {
  className?: string;
}

export function SearchShortcut({ className = "" }: SearchShortcutProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show shortcut hint on Ctrl+K or Cmd+K
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setVisible(true);
        // Focus the search input if it exists
        const searchInput = document.querySelector(
          'input[placeholder*="Search"]'
        ) as HTMLInputElement;
        searchInput?.focus();
      }
      if (e.key === "Escape") {
        setVisible(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-gray-400 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 ${className}`}
    >
      Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-white">Esc</kbd> to close
    </div>
  );
}

export default SearchInput;
