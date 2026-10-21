import React, { useState } from 'react'
import { Lock, User, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react'
import { login, type UserAccount } from '@/lib/auth'

interface LoginScreenProps {
  onLoginSuccess: (user: UserAccount) => void
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    setTimeout(() => {
      const res = login(userId, password)
      if (res.success && res.user) {
        onLoginSuccess(res.user)
      } else {
        setError(res.error || 'Invalid User ID or password. Access denied.')
      }
      setIsSubmitting(false)
    }, 250)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas p-4 text-fg selection:bg-accent/30 selection:text-white">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-40 -top-40 size-[480px] rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 size-[480px] rounded-full bg-up/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-[400px]">
        {/* Header branding */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-1.5 shadow-sm">
            <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
              <rect width="20" height="20" rx="4" fill="#4D8DFF" />
              <path
                d="M5 13.5 8.5 9l2.5 2.5L15 6.5"
                stroke="#08090C"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[14px] font-bold tracking-[0.08em] text-fg">Q-ALPHA</span>
            <span className="h-3 w-px bg-line-2" />
            <span className="text-[11px] font-medium text-fg-3">NSE Terminal Gate</span>
          </div>

          <h1 className="mt-4 text-[21px] font-semibold tracking-tight text-fg">
            Sign In to Institutional Terminal
          </h1>
          <p className="mt-1 text-[12px] text-fg-3">
            Enter your assigned User ID and password to proceed
          </p>
        </div>

        {/* Auth card */}
        <div className="rounded-xl border border-line bg-surface p-6 shadow-2xl backdrop-blur-sm">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-down/30 bg-down/10 px-3.5 py-2.5 text-[12px] text-down animate-fade-in">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 flex items-center justify-between text-[11.5px] font-medium text-fg-3">
                <span>User ID</span>
                <span className="text-[10px] text-fg-4">Required</span>
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3 size-4 text-fg-4" />
                <input
                  type="text"
                  autoFocus
                  required
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter User ID"
                  className="num h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-[13px] text-fg transition-colors focus:border-accent focus:outline-none placeholder:text-fg-4"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 flex items-center justify-between text-[11.5px] font-medium text-fg-3">
                <span>Password</span>
                <span className="text-[10px] text-fg-4">Case-sensitive</span>
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 size-4 text-fg-4" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="num h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-10 text-[13px] text-fg transition-colors focus:border-accent focus:outline-none placeholder:text-fg-4"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-fg-4 transition-colors hover:text-fg-2"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !userId.trim() || !password}
              className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[13px] font-semibold text-canvas shadow transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Verifying Credentials…' : 'Enter Terminal'}</span>
              <ArrowRight className="size-4" />
            </button>
          </form>
        </div>

        {/* Security watermark footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-fg-4">
          <ShieldCheck className="size-3.5 text-up" />
          <span>Strict Role-Based Access Control · Encrypted Credentials</span>
        </div>
      </div>
    </div>
  )
}
