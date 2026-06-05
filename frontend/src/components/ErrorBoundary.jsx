// src/components/ErrorBoundary.jsx
import { Component } from "react";
import { Link } from "react-router-dom";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
    this.setState({ info });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-20 bg-scai-bg">
        <div className="max-w-lg w-full text-center">
          {/* Ether Authority logo */}
          <img
            src="/ether-authority-logo.svg"
            alt="Ether Authority"
            className="h-10 mx-auto mb-8 opacity-60"
          />

          <div className="glass-card border border-scai-error/30 p-8">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-extrabold text-scai-text mb-3">
              Something went wrong
            </h1>
            <p className="text-sm text-scai-muted mb-2 leading-relaxed">
              An unexpected error occurred in the application. Your wallet and funds are safe.
            </p>
            {this.state.error?.message && (
              <pre className="mt-4 mb-6 text-left text-xs text-scai-error/80 bg-scai-error/5 border border-scai-error/20 rounded-lg p-3 overflow-auto max-h-32 font-mono">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, info: null });
                  window.location.href = "/";
                }}
                className="btn-primary"
              >
                Return Home
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn-outline"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
