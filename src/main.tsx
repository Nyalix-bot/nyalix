// Global error handlers (captures runtime errors even before React mounts)
window.onerror = (message, source, lineno, colno, error) => {
  const msg = String(message || "Unknown error");
  const stack = (error && error.stack) || `${source}:${lineno}:${colno}`;
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '0';
  el.style.width = '100%';
  el.style.zIndex = '999999';
  el.style.background = 'rgba(0,0,0,0.85)';
  el.style.color = 'white';
  el.style.padding = '1rem';
  el.style.fontFamily = 'system-ui, sans-serif';
  el.style.whiteSpace = 'pre-wrap';
  el.textContent = `Error: ${msg}\n${stack}`;
  document.body.appendChild(el);
  return false;
};

window.onunhandledrejection = (event) => {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '0';
  el.style.width = '100%';
  el.style.zIndex = '999999';
  el.style.background = 'rgba(0,0,0,0.85)';
  el.style.color = 'white';
  el.style.padding = '1rem';
  el.style.fontFamily = 'system-ui, sans-serif';
  el.style.whiteSpace = 'pre-wrap';
  el.textContent = `Unhandled Rejection: ${String(event.reason)}`;
  document.body.appendChild(el);
};

import React, { Component, ErrorInfo } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

class RootErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Show errors in console and also keep it visible for debugging.
    console.error("Root error boundary caught:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="pt-20 min-h-screen bg-background flex items-center justify-center">
          <div className="bg-card rounded-xl border border-border p-8 shadow-luxury max-w-lg">
            <h1 className="text-xl font-bold text-foreground mb-4">Application error</h1>
            <p className="text-sm text-muted-foreground mb-4">An unexpected error occurred while rendering the app.</p>
            <pre className="text-xs text-red-500 bg-muted p-3 rounded-lg overflow-x-auto">{this.state.error.message}</pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
