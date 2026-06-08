"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@rabbitty/ui";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-12">
          <div className="mx-auto max-w-2xl rounded-2xl border border-neutral-200 bg-white p-8 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-100">
                <AlertTriangle className="h-6 w-6 text-danger-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  Algo salió mal
                </h2>
                <p className="text-neutral-500">
                  Se produjo un error inesperado. Por favor, intenta de nuevo.
                </p>
              </div>
            </div>

            <div className="mb-6 rounded-xl bg-danger-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-danger-700">
                Error:
              </h3>
              <p className="text-sm text-danger-600">
                {this.state.error?.message}
              </p>
               <p className="mt-1 text-xs text-neutral-400">
                 {this.state.error?.stack
                   ?.split("\n")
                   .slice(1, 4)
                   .map((line) => line.trim())
                   .join(" | ")}
               </p>
            </div>

             <div className="flex flex-col gap-3">
               <Button
                 onClick={this.handleReset}
                 className="flex items-center justify-center gap-2"
               >
                 <RefreshCw className="h-4 w-4" />
                 Reintentar
               </Button>
               <Button
                 onClick={this.handleReload}
                 className="text-sm"
               >
                 Recargar página
               </Button>
             </div>

            <details className="mt-6 text-xs text-neutral-400">
              <summary className="cursor-pointer hover:text-neutral-600">
                Ver detalles técnicos
              </summary>
              <div className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-neutral-100 p-4 font-mono">
                {this.state.error?.stack}
              </div>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
