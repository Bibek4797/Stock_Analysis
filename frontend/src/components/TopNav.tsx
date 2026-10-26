import { cx } from '@/lib/format'
import type { MarketStatus } from '@/lib/hooks'
import { StatusDot } from './ui'
import type { UserAccount } from '@/lib/auth'
import { Shield, User, LogOut } from 'lucide-react'

export type Tab = 'terminal' | 'risk' | 'portfolio' | 'verification' | 'admin'

const BASE_TABS: Array<{ id: Tab; label: string; key: string }> = [
  { id: 'terminal', label: 'Terminal', key: '1' },
  { id: 'risk', label: 'Returns & Risk', key: '2' },
  { id: 'portfolio', label: 'Portfolio Manager', key: '3' },
  { id: 'verification', label: 'Model Verification', key: '4' },
]

export function TopNav({
  tab,
  onTab,
  time,
  status,
  busy,
  currentUser,
  onLogout,
}: {
  tab: Tab
  onTab: (t: Tab) => void
  time: string
  status: MarketStatus
  busy: boolean
  currentUser?: UserAccount | null
  onLogout?: () => void
}) {
  const open = status === 'OPEN'
  const statusTone = open ? 'up' : status === 'PRE-OPEN' ? 'warn' : 'neutral'

  const tabs = currentUser?.role === 'admin'
    ? [...BASE_TABS, { id: 'admin' as Tab, label: 'Admin', key: '5' }]
    : BASE_TABS

  return (
    <div className="sticky top-0 z-30">
      <nav className="flex h-12 items-center border-b border-line bg-surface px-4">
        <div className="flex flex-1 items-center gap-3">
          <div className="flex items-center gap-2">
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
            <span className="text-[14px] font-bold tracking-[0.06em] text-fg">
              Q-ALPHA
            </span>
          </div>
          <span className="hidden h-4 w-px bg-line-2 xl:block" />
          <span className="hidden text-[12px] text-fg-3 xl:block">
            NSE Equity &amp; Portfolio Terminal
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Workspace"
          className="flex h-full items-stretch"
        >
          {tabs.map((t) => {
            const active = t.id === tab
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => onTab(t.id)}
                className={cx(
                  'relative flex items-center gap-2 px-3 text-[12.5px] font-medium transition-colors md:px-4',
                  active ? 'text-fg' : 'text-fg-3 hover:text-fg-2',
                )}
              >
                <span
                  className={cx(
                    'num hidden text-[10px] sm:inline',
                    active ? 'text-accent' : 'text-fg-4',
                  )}
                >
                  {t.key}
                </span>
                {t.label}
                {t.id === 'admin' && (
                  <span className="rounded bg-accent/20 px-1 py-0.2 text-[9px] font-bold text-accent uppercase">
                    Secured
                  </span>
                )}
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent md:inset-x-4" />
                )}
              </button>
            )
          })}
        </div>

        <div className="flex flex-1 items-center justify-end gap-3 sm:gap-4">
          <div className="hidden items-center gap-2 text-[12px] md:flex">
            <StatusDot tone={statusTone} pulse={open} />
            <span className={open ? 'text-fg-2' : 'text-fg-3'}>
              {open
                ? 'NSE live'
                : status === 'PRE-OPEN'
                  ? 'Pre-open'
                  : 'Market closed'}
            </span>
          </div>
          <span className="num hidden text-[12px] text-fg-2 lg:inline">
            {time} <span className="text-fg-3">IST</span>
          </span>

          {currentUser && (
            <div className="flex items-center gap-2 border-l border-line pl-3">
              <div className="flex items-center gap-1.5 text-[11.5px]">
                <span className="flex size-6 items-center justify-center rounded-full bg-surface-2 text-fg-3 border border-line">
                  {currentUser.role === 'admin' ? (
                    <Shield className="size-3 text-accent" />
                  ) : (
                    <User className="size-3 text-up" />
                  )}
                </span>
                <span className="font-mono font-medium text-fg hidden sm:inline">
                  {currentUser.userId}
                </span>
                <span
                  className={cx(
                    'rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider',
                    currentUser.role === 'admin'
                      ? 'bg-accent/15 text-accent border border-accent/30'
                      : 'bg-up/15 text-up border border-up/30'
                  )}
                >
                  {currentUser.role}
                </span>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Sign out of terminal"
                  className="flex size-7 items-center justify-center rounded-md border border-line text-fg-3 transition-colors hover:border-down/40 hover:bg-down/10 hover:text-down"
                >
                  <LogOut className="size-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </nav>
      <div className="relative h-px overflow-hidden" aria-hidden>
        {busy && (
          <div className="absolute inset-y-0 left-0 w-2/5 animate-indeterminate bg-accent" />
        )}
      </div>
    </div>
  )
}
