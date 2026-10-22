import React, { useState, useMemo, useEffect } from 'react'
import {
  Shield,
  User,
  Plus,
  Trash2,
  Edit2,
  Search,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
} from 'lucide-react'
import {
  getUsers,
  addUser,
  updateUser,
  deleteUser,
  syncUsersWithServer,
  type UserAccount,
} from '@/lib/auth'
import { Chip, Panel, Stat, TD, TH } from '@/components/ui'
import { cx } from '@/lib/format'

interface AdminScreenProps {
  currentUser: UserAccount
  onUserSessionUpdate: (updated: UserAccount) => void
}

export function AdminScreen({ currentUser, onUserSessionUpdate }: AdminScreenProps) {
  const [users, setUsers] = useState<UserAccount[]>(() => getUsers())
  const [search, setSearch] = useState('')
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})

  // Modal State for Add / Edit User
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null)
  const [modalUserId, setModalUserId] = useState('')
  const [modalPassword, setModalPassword] = useState('')
  const [modalName, setModalName] = useState('')
  const [modalRole, setModalRole] = useState<'admin' | 'user'>('user')
  const [modalError, setModalError] = useState<string | null>(null)

  // Refresh user list from storage & central server
  const reloadUsers = async () => {
    const list = await syncUsersWithServer()
    setUsers(list)
  }

  useEffect(() => {
    reloadUsers()
  }, [])

  // Filtered users list
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.userId.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    )
  }, [users, search])

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Open modal to add user
  const handleOpenAddUser = () => {
    setEditingUser(null)
    setModalUserId('')
    setModalPassword('')
    setModalName('')
    setModalRole('user')
    setModalError(null)
    setIsModalOpen(true)
  }

  // Open modal to edit existing user
  const handleOpenEditUser = (user: UserAccount) => {
    setEditingUser(user)
    setModalUserId(user.userId)
    setModalPassword(user.password)
    setModalName(user.name)
    setModalRole(user.role)
    setModalError(null)
    setIsModalOpen(true)
  }

  // Submit Modal (Add or Edit)
  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)

    if (editingUser) {
      // Edit
      const res = await updateUser(editingUser.id, {
        userId: modalUserId,
        password: modalPassword,
        name: modalName,
        role: modalRole,
      })
      if (res.success) {
        setIsModalOpen(false)
        await reloadUsers()
        // If current logged-in user was updated, notify parent state immediately
        if (editingUser.id === currentUser.id || editingUser.userId === currentUser.userId) {
          onUserSessionUpdate({
            ...currentUser,
            userId: modalUserId.trim(),
            password: modalPassword,
            name: modalName.trim() || modalUserId.trim(),
            role: modalRole,
          })
        }
      } else {
        setModalError(res.error || 'Failed to update user account.')
      }
    } else {
      // Add
      const res = await addUser({
        userId: modalUserId,
        password: modalPassword,
        name: modalName,
        role: modalRole,
      })
      if (res.success) {
        setIsModalOpen(false)
        await reloadUsers()
      } else {
        setModalError(res.error || 'Failed to create user account.')
      }
    }
  }

  // Delete User
  const handleDeleteUser = async (id: string, targetUserId: string) => {
    if (confirm(`Are you sure you want to permanently delete user "${targetUserId}"?`)) {
      const res = await deleteUser(id, currentUser.userId)
      if (res.success) {
        await reloadUsers()
      } else {
        alert(res.error || 'Failed to delete user.')
      }
    }
  }

  const adminCount = users.filter((u) => u.role === 'admin').length
  const userCount = users.filter((u) => u.role === 'user').length

  return (
    <div className="mx-auto max-w-[1680px] space-y-4 p-3 animate-fade-in">
      {/* ── 1. Top Header ────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1 pt-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[17px] font-semibold tracking-tight text-fg">
              System Administration
            </h1>
            <span className="rounded-[4px] border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[10.5px] font-bold text-accent">
              ADMIN CONTROL
            </span>
          </div>
          <p className="mt-0.5 text-[11.5px] text-fg-3">
            Manage user accounts, roles, credentials, and authentication access policies
          </p>
        </div>

        <div className="flex items-center gap-3 text-[11.5px] text-fg-3">
          <span>
            Logged in as{' '}
            <strong className="text-fg font-mono">{currentUser.userId}</strong>
          </span>
          <span className="h-4 w-px bg-line-2" />
          <Chip tone="accent" dot>
            Administrator
          </Chip>
        </div>
      </div>

      {/* ── 2. Stat Overview Strip ───────────────────────────── */}
      <section className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        <Stat
          label="Total Authorized Accounts"
          value={<span className="num">{users.length}</span>}
          sub="Registered directory members"
        />
        <Stat
          label="Administrators"
          value={<span className="num">{adminCount}</span>}
          sub="Full security privileges"
          tone="accent"
        />
        <Stat
          label="Institutional Traders"
          value={<span className="num">{userCount}</span>}
          sub="Standard terminal access"
          tone="up"
        />
      </section>

      {/* ── 3. Full-Width User Accounts Directory ────────────── */}
      <Panel
        title={
          <div className="flex items-center gap-2">
            <UserCheck className="size-4 text-up" />
            <span>User Accounts Directory</span>
            <span className="num text-[11px] text-fg-4">({users.length})</span>
          </div>
        }
        right={
          <button
            onClick={handleOpenAddUser}
            className="flex h-7 items-center gap-1.5 rounded-md bg-accent px-2.5 text-[11.5px] font-semibold text-canvas transition-opacity hover:opacity-90 shadow-sm"
          >
            <Plus className="size-3.5" />
            <span>Add User</span>
          </button>
        }
        bodyClassName="flex flex-col"
      >
        {/* Search bar */}
        <div className="border-b border-line p-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by User ID, Name, or Role..."
              className="h-8 w-full rounded-md border border-line bg-canvas pl-8 pr-3 text-[12px] text-fg outline-none focus:border-accent placeholder:text-fg-4"
            />
          </div>
        </div>

        {/* Table */}
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-line text-[10.5px] uppercase tracking-wider text-fg-4">
              <tr>
                <th className={TH}>User ID</th>
                <th className={TH}>Name</th>
                <th className={TH}>Role</th>
                <th className={TH}>Password</th>
                <th className={TH}>Created</th>
                <th className={cx(TH, 'text-right')}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredUsers.map((u) => {
                const isCurrentUser = u.userId === currentUser.userId
                const showPass = visiblePasswords[u.id] || false
                return (
                  <tr key={u.id} className="transition-colors hover:bg-surface-2">
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <span className="num font-semibold text-fg">{u.userId}</span>
                        {isCurrentUser && (
                          <span className="rounded bg-accent/20 px-1 py-0.2 text-[9.5px] font-bold text-accent">
                            YOU
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={TD}>
                      <span className="text-fg-2">{u.name}</span>
                    </td>
                    <td className={TD}>
                      <Chip tone={u.role === 'admin' ? 'accent' : 'up'} dot>
                        {u.role === 'admin' ? 'Administrator' : 'Trader'}
                      </Chip>
                    </td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <span className="num text-fg-3 font-mono">
                          {showPass ? u.password : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(u.id)}
                          className="text-fg-4 hover:text-fg-2"
                          title={showPass ? 'Hide Password' : 'Show Password'}
                        >
                          {showPass ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                        </button>
                      </div>
                    </td>
                    <td className={cx(TD, 'num text-fg-4 text-[11px]')}>{u.createdAt}</td>
                    <td className={cx(TD, 'text-right')}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEditUser(u)}
                          className="flex size-7 items-center justify-center rounded border border-line text-fg-3 transition-colors hover:border-accent/40 hover:bg-surface-3 hover:text-accent"
                          title="Edit User ID & Password"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.userId)}
                          disabled={isCurrentUser}
                          className="flex size-7 items-center justify-center rounded border border-line text-fg-3 transition-colors hover:border-down/40 hover:bg-down/10 hover:text-down disabled:opacity-20 disabled:hover:border-line disabled:hover:bg-transparent disabled:hover:text-fg-3"
                          title={isCurrentUser ? 'Cannot delete logged in account' : 'Delete Account'}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-fg-4">
                    No accounts match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ── 4. Modal: Add or Edit User ────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
          <div className="flex w-full max-w-md flex-col rounded-xl border border-line bg-surface shadow-2xl overflow-hidden">
            <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4 bg-surface-2">
              <div className="flex items-center gap-2">
                <User className="size-4 text-accent" />
                <h3 className="text-[13px] font-semibold text-fg">
                  {editingUser ? `Edit Account: ${editingUser.userId}` : 'Add New Account'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded p-1 text-fg-4 hover:bg-surface-3 hover:text-fg"
              >
                <X className="size-4" />
              </button>
            </header>

            <form onSubmit={handleModalSubmit} className="p-4 space-y-3.5">
              {modalError && (
                <div className="flex items-center gap-2 rounded-lg border border-down/30 bg-down/10 p-2.5 text-[11.5px] text-down">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="mb-1 block text-[11px] font-medium text-fg-3">
                  User ID (Login Identifier)
                </label>
                <input
                  type="text"
                  required
                  value={modalUserId}
                  onChange={(e) => setModalUserId(e.target.value)}
                  placeholder="e.g. 1234, trader2, risk_manager"
                  className="num h-8 w-full rounded-md border border-line bg-canvas px-2.5 text-[12px] text-fg outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-fg-3">
                  Password
                </label>
                <input
                  type="text"
                  required
                  value={modalPassword}
                  onChange={(e) => setModalPassword(e.target.value)}
                  placeholder="Set account password"
                  className="num h-8 w-full rounded-md border border-line bg-canvas px-2.5 text-[12px] text-fg outline-none focus:border-accent font-mono"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-fg-3">
                  Full Name / Designation
                </label>
                <input
                  type="text"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder="e.g. Lead Administrator / Senior Trader"
                  className="h-8 w-full rounded-md border border-line bg-canvas px-2.5 text-[12px] text-fg outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-fg-3">
                  Role & Permissions
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalRole('user')}
                    className={cx(
                      'flex items-center justify-center gap-2 rounded-lg border p-2 text-[11.5px] font-medium transition-colors',
                      modalRole === 'user'
                        ? 'border-up/50 bg-up/10 text-up font-semibold'
                        : 'border-line bg-canvas text-fg-3 hover:bg-surface-2'
                    )}
                  >
                    <User className="size-3.5" />
                    <span>Trader (User)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalRole('admin')}
                    className={cx(
                      'flex items-center justify-center gap-2 rounded-lg border p-2 text-[11.5px] font-medium transition-colors',
                      modalRole === 'admin'
                        ? 'border-accent/50 bg-accent/10 text-accent font-semibold'
                        : 'border-line bg-canvas text-fg-3 hover:bg-surface-2'
                    )}
                  >
                    <Shield className="size-3.5" />
                    <span>Administrator</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded px-3 py-1.5 text-[11.5px] font-medium text-fg-3 hover:bg-surface-2 hover:text-fg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-accent px-4 py-1.5 text-[11.5px] font-semibold text-canvas shadow transition-opacity hover:opacity-90"
                >
                  {editingUser ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
