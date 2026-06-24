import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link
            to={user?.role === "REVIEWER" ? "/reviewer" : "/"}
            className="text-base font-semibold text-gray-900 shrink-0"
          >
            ApprovalFlow
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm text-gray-500 truncate hidden sm:block">
              {user?.name}{" "}
              <span className="ml-1 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                {user?.role}
              </span>
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-900 shrink-0"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
