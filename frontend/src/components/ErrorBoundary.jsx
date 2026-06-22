import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error("UI crash:", error, errorInfo);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error?.message || String(this.state.error);
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 dark:border-red-400/25 dark:bg-red-500/15 dark:text-red-200">
          <p className="text-sm font-semibold">The UI crashed while rendering.</p>
          <p className="mt-2 text-sm">
            Error: <span className="font-mono">{message}</span>
          </p>
          <p className="mt-3 text-xs text-red-700/90 dark:text-red-200/80">
            Open DevTools Console to see the full stack trace.
          </p>
        </div>
      </div>
    );
  }
}

