
import { useState, type FormEvent } from 'react'
import {
  Activity,
  ArrowRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react'

const PUBLIC_DEMO_PASSWORD = 'HeyPQSY@6734#tq'

interface DemoAccessProps {
  onAuthenticated: () => void
}

export function DemoAccess({ onAuthenticated }: DemoAccessProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleCopyPassword() {
    try {
      await navigator.clipboard.writeText(PUBLIC_DEMO_PASSWORD)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Unable to copy password. Please copy it manually.')
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!password.trim()) {
      setError('Please enter the demo access password.')
      return
    }

    if (password !== PUBLIC_DEMO_PASSWORD) {
      setError('Incorrect password. Please try again.')
      return
    }

    setError('')
    onAuthenticated()
  }

  return (
    <main className="sentra-grid-bg relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B1220] px-4 py-10 text-[#F8FAFC]">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-sky-500/[0.07] blur-[120px]" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-400/10">
            <Activity className="h-6 w-6 text-sky-400" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-[0.18em]">SENTRA</h1>
            <p className="text-[10px] tracking-[0.22em] text-slate-400">
              DISASTER INTELLIGENCE SYSTEM
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-[#26364A] bg-[#141F30]/95 p-7 shadow-2xl shadow-black/30 sm:p-9">
          <div className="mb-7">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10">
              <ShieldCheck className="h-5 w-5 text-sky-400" />
            </div>

            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">
              Public Demo Access
            </p>

            <h2 className="text-2xl font-semibold">Welcome to SENTRA</h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Use the shared demo password below to explore the live emergency
              operations command center.
            </p>
          </div>

          <div className="mb-6 rounded-lg border border-sky-400/20 bg-sky-400/5 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-sky-400">
              Public Demo Password
            </p>

            <div className="flex items-center justify-between gap-3">
              <code className="break-all text-sm font-semibold text-white">
                {PUBLIC_DEMO_PASSWORD}
              </code>

              <button
                type="button"
                onClick={handleCopyPassword}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-[#26364A] px-3 py-2 text-xs text-slate-300 transition hover:bg-[#19283B] hover:text-white"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="demo-password"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Enter demo password
              </label>

              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                <input
                  id="demo-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter access password"
                  autoComplete="off"
                  className="h-12 w-full rounded-lg border border-[#26364A] bg-[#0B1220] pl-10 pr-12 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/10"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-200"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-3 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!password.trim()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 text-sm font-semibold text-[#07111F] transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Access SENTRA
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-7 border-t border-[#26364A] pt-5">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <LockKeyhole className="h-3.5 w-3.5" />
              Public interactive demo environment
            </div>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-slate-600">
          Anticipate. Alert. Protect.
        </p>
      </div>
    </main>
  )
}
