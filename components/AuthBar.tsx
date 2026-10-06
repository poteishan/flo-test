import React from 'react';
import { 
  SignedIn, 
  SignedOut, 
  SignInButton, 
  SignUpButton, 
  UserButton 
} from '@clerk/clerk-react';
import { LogIn, UserPlus, Sparkles } from 'lucide-react';

interface AuthBarProps {
  hasClerkKey: boolean;
}

export const AuthBar: React.FC<AuthBarProps> = ({ hasClerkKey }) => {
  if (hasClerkKey) {
    return (
      <div className="flex items-center gap-2">
        <SignedOut>
          <div className="flex items-center gap-1.5">
            <SignInButton mode="modal">
              <button className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-[#121417] hover:bg-black/5 transition-colors">
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            </SignInButton>

            <SignUpButton mode="modal">
              <button className="flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#D4E4FC] hover:bg-[#C2DBFB] text-[#121417] border border-[#121417]/20 shadow-sm transition-all hover:scale-105">
                <UserPlus className="w-3.5 h-3.5" />
                <span>Sign Up</span>
              </button>
            </SignUpButton>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="flex items-center pl-1">
            <UserButton 
              appearance={{
                elements: {
                  userButtonAvatarBox: 'w-8 h-8 ring-2 ring-[#121417] shadow-xs hover:scale-105 transition-all',
                }
              }}
              afterSignOutUrl="/"
            />
          </div>
        </SignedIn>
      </div>
    );
  }

  // Fallback demo mode indicator
  return (
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF755] border border-[#121417]/20 text-black text-[11px] font-bold">
      <Sparkles className="w-3 h-3" />
      <span>Guest Demo</span>
    </div>
  );
};
