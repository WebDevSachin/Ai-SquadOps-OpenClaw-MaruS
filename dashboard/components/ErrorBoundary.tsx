"use client";

import React, { Component, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button, Card } from "./ui";
import Link from "next/link";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        this.props.fallback || (
          <div className="min-h-[400px] flex items-center justify-center p-4">
            <Card className="max-w-lg w-full text-center p-8">
              <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Something went wrong
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                We&apos;re sorry, but there was an error loading this page. 
                This might be due to a temporary issue with our servers.
              </p>
              
              {process.env.NODE_ENV === "development" && this.state.error && (
                <div className="mb-6 text-left">
                  <details className="bg-gray-900 rounded-lg p-4">
                    <summary className="text-sm text-red-400 cursor-pointer font-medium">
                      Error Details (Development Only)
                    </summary>
                    <pre className="mt-2 text-xs text-gray-400 overflow-auto max-h-40">
                      {this.state.error.toString()}
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </details>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={this.handleReload}
                  leftIcon={<RefreshCw className="w-4 h-4" />}
                >
                  Reload Page
                </Button>
                <Link href="/">
                  <Button variant="secondary" leftIcon={<Home className="w-4 h-4" />}>
                    Go Home
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to catch errors
export function useErrorHandler() {
  return (error: Error) => {
    console.error("Caught error:", error);
    // Could also send to error tracking service
  };
}
