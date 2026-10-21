import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('LMP Studio ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-[#0a0d12] text-slate-200 p-6 select-none">
          <div className="max-w-md w-full bg-[#121824] border border-amber-500/40 rounded-xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <AlertTriangle size={24} />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-100">
                {this.props.fallbackTitle || 'Workspace Rendering Glitch'}
              </h2>
              <p className="text-xs text-slate-400">
                {this.state.error?.message || 'An unexpected error occurred while rendering the workspace.'}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-md"
              >
                <RotateCcw size={14} />
                <span>Recover & Continue</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
