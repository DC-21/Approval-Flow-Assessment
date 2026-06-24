import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate(user.role === "REVIEWER" ? "/reviewer" : "/");
    return null;
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* ── Left: animated panel ── */}
      <div className="relative hidden md:flex flex-1 flex-col items-center justify-center overflow-hidden animate-gradient"
        style={{
          background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e, #1a1a2e, #16213e)",
        }}
      >
        {/* floating blobs */}
        <div
          className="animate-drift1 absolute w-96 h-96 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, #7c3aed, #4f46e5)", top: "10%", left: "5%" }}
        />
        <div
          className="animate-drift2 absolute w-80 h-80 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #06b6d4, #3b82f6)", bottom: "15%", right: "5%" }}
        />
        <div
          className="animate-drift3 absolute w-64 h-64 rounded-full opacity-25 blur-2xl"
          style={{ background: "radial-gradient(circle, #ec4899, #8b5cf6)", bottom: "35%", left: "25%" }}
        />

        {/* grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* copy */}
        <div className="relative z-10 text-center px-10 select-none">
          <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-3">
            ApprovalFlow
          </h2>
          <p className="text-white/50 text-sm leading-relaxed max-w-xs">
            Streamline your review and approval process with a simple, modern workflow.
          </p>
        </div>
      </div>

      {/* ── Right: form ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 bg-white">
        <div className="w-full max-w-sm animate-fade-up">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-sm text-gray-400 mb-8">Sign in to your account to continue.</p>

          {error && (
            <div className="mb-5 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-0 py-2 border-0 border-b border-gray-200 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-indigo-500 transition-colors bg-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-0 py-2 border-0 border-b border-gray-200 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-indigo-500 transition-colors bg-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
