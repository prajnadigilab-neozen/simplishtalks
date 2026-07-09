
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    // Explicitly declaring state type to satisfy stricter linting
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        const { hasError } = this.state;
        const { children, fallback } = this.props;

        if (hasError) {
            if (fallback) return fallback;

            return (
                <div className="min-h-[60vh] flex items-center justify-center p-8 text-center animate-in zoom-in-95">
                    <div className="bg-white dark:bg-slate-800 p-10 md:p-14 rounded-[3rem] border-4 border-amber-400 shadow-2xl max-w-md w-full">
                        <span className="text-7xl md:text-8xl mb-8 block">🛠️</span>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tighter">Something went wrong</h2>
                        <p className="text-slate-500 dark:text-slate-400 font-bold mb-10 text-sm leading-relaxed">
                            ನಿಮ್ಮ ಕ್ಷಮೆ ಇರಲಿ, ಏನೋ ತೊಂದರೆಯಾಗಿದೆ.<br />
                            (Sorry, something went wrong on our end.)
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-blue-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg shadow-blue-900/20"
                        >
                            Restart App
                        </button>
                    </div>
                </div>
            );
        }

        return children;
    }
}

export default ErrorBoundary;
