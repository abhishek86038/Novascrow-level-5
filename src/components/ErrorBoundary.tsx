import React from "react";
import { captureError } from "../services/monitoring";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    captureError(error, { errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0D1C] text-[#F4F6FF] flex items-center justify-center p-6">
          <div className="bg-[#12162B] border border-red-500/50 rounded-2xl p-8 max-w-md text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 text-3xl font-black">!</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-slate-400 text-sm mb-6">
              We've captured the error and our team has been notified.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-xl transition"
            >
              Reload Page
            </button>
            {this.state.error && (
              <pre className="mt-6 text-left text-xs bg-[#0A0D1C] p-4 rounded-lg overflow-x-auto text-red-400">
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
