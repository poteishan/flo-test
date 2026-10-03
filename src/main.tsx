import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import './dark-mode.css';
import App from './App.tsx';

const FALLBACK_CLERK_KEY = 'pk_test_Y29uY2lzZS1jYXQtNjkxOS5jbGVyay5hY2NvdW50cy5kZXYk';
const envKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) as string | undefined;
const localKey = typeof window !== 'undefined' ? localStorage.getItem('devtrack_custom_clerk_key') : null;
const rawKey = (envKey && !envKey.includes('your_clerk') && envKey.trim().length > 0) ? envKey : (localKey || FALLBACK_CLERK_KEY);
const clerkPubKey = (rawKey && rawKey.startsWith('pk_')) ? rawKey.trim() : FALLBACK_CLERK_KEY;

const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.endsWith('.local'));

// Production Clerk keys (pk_live_*) are strictly locked to production domain (flo.protrack.club)
// On localhost, we automatically use the development key or test fallback so preview works seamlessly without white screens.
const effectiveClerkKey = (isLocalhost && clerkPubKey.startsWith('pk_live_'))
  ? ((import.meta.env.VITE_CLERK_DEV_PUBLISHABLE_KEY as string) || FALLBACK_CLERK_KEY)
  : clerkPubKey;

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ClerkErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[FLO] ClerkProvider failed to initialize. Falling back to local preview mode:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkErrorBoundary fallback={<App hasClerkKey={false} />}>
      {effectiveClerkKey ? (
        <ClerkProvider 
          publishableKey={effectiveClerkKey}
          localization={{
            signIn: {
              start: {
                title: 'Sign in to',
                subtitle: 'Welcome back! Please sign in to continue',
              },
            },
            signUp: {
              start: {
                title: 'Sign up to',
                subtitle: 'Welcome! Please fill in the details to get started',
              },
            },
          }}
          appearance={{
            layout: {
              logoPlacement: 'none',
              unsafe_disableDevelopmentModeWarnings: true,
            },
            variables: {
              colorPrimary: '#121417',
              colorBackground: '#FFFFFF',
              colorInputBackground: '#F9F8F5',
              colorText: '#121417',
              colorTextSecondary: '#5A606A',
            },
            elements: {
              modalBackdrop: 'bg-black/70 backdrop-blur-sm',
              modalContent: 'p-4',
              cardBox: 'border-2 border-[#121417] shadow-solid-lg rounded-3xl bg-white overflow-hidden',
              card: 'border-0 shadow-none bg-transparent rounded-3xl',
              headerTitle: 'text-xl font-black text-[#121417] flex items-center justify-center gap-1.5',
              headerSubtitle: 'text-xs text-[#5A606A] font-medium',
              formButtonPrimary: 'bg-[#EBF755] hover:bg-[#E2EF43] text-black font-extrabold border-2 border-[#121417] shadow-solid rounded-full',
              socialButtonsBlockButton: 'border-2 border-[#121417]/20 hover:border-[#121417] rounded-2xl transition-all shadow-2xs hover:shadow-xs',
              formFieldInput: 'border-2 border-[#121417]/20 focus:border-[#121417] rounded-xl bg-[#F9F8F5]',
              footer: 'bg-[#F9F8F5] border-t border-[#121417]/10',
              footerActionLink: 'text-[#121417] font-bold hover:underline',
              footerPages: 'hidden',
            }
          }}
        >
          <App hasClerkKey={true} />
        </ClerkProvider>
      ) : (
        <App hasClerkKey={false} />
      )}
    </ClerkErrorBoundary>
  </StrictMode>,
);

