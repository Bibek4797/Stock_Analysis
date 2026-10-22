import {
  fetchApiUsers,
  apiLogin,
  apiCreateUser,
  apiUpdateUser,
  apiDeleteUser,
} from '@/services/api'

export interface UserAccount {
  id: string
  userId: string
  password: string
  role: 'admin' | 'user'
  name: string
  createdAt: string
}

const STORAGE_KEY_USERS = 'qalpha_auth_users_v1'
const STORAGE_KEY_SESSION = 'qalpha_current_user_v1'

export const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'admin_root',
    userId: '1234',
    password: '1234',
    role: 'admin',
    name: 'Administrator',
    createdAt: '2026-10-22',
  },
  {
    id: 'user_default',
    userId: 'trader1',
    password: 'user123',
    role: 'user',
    name: 'Institutional Trader',
    createdAt: '2026-10-22',
  },
]

// ---------------------------------------------------------------------------
// Local Cache Accessors
// ---------------------------------------------------------------------------

export function getUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(DEFAULT_USERS))
      return DEFAULT_USERS
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
    }
    return DEFAULT_USERS
  } catch {
    return DEFAULT_USERS
  }
}

export function saveUsers(users: UserAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users))
  } catch (e) {
    console.error('Failed to save users to localStorage', e)
  }
}

export function getCurrentUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSION)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setCurrentUser(user: UserAccount | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_KEY_SESSION)
    }
  } catch (e) {
    console.error('Failed to set current user session', e)
  }
}

// ---------------------------------------------------------------------------
// Central Server Synchronization
// ---------------------------------------------------------------------------

/**
 * Syncs the local browser cache with the central backend server.
 * Any update made in Chrome, Edge, or another tab is pulled into this browser.
 */
export async function syncUsersWithServer(): Promise<UserAccount[]> {
  try {
    const serverUsers = await fetchApiUsers()
    if (Array.isArray(serverUsers) && serverUsers.length > 0) {
      saveUsers(serverUsers)
      // Check if current user session is still valid or updated
      const session = getCurrentUser()
      if (session) {
        const matched = serverUsers.find((u) => u.id === session.id || u.userId.toLowerCase() === session.userId.toLowerCase())
        if (matched) {
          setCurrentUser(matched)
        }
      }
      return serverUsers
    }
  } catch (err) {
    // Backend offline or running static standalone; continue using cached users cleanly
  }
  return getUsers()
}

// ---------------------------------------------------------------------------
// Authentication & Account Management
// ---------------------------------------------------------------------------

export async function login(
  userIdInput: string,
  passwordInput: string
): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
  const trimmedId = userIdInput.trim()

  // 1. First attempt central backend authentication
  try {
    const serverUser = await apiLogin(trimmedId, passwordInput)
    if (serverUser) {
      setCurrentUser(serverUser)
      // Sync all users in background
      syncUsersWithServer().catch(() => {})
      return { success: true, user: serverUser }
    }
  } catch (err: any) {
    // If backend explicitly rejected invalid credentials (401 / 400), return error
    if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
      return { success: false, error: err.message }
    }
    // If server is unreachable, fall back to local store
  }

  // 2. Offline / Local fallback validation
  const users = getUsers()
  const match = users.find(
    (u) => u.userId.toLowerCase() === trimmedId.toLowerCase() && u.password === passwordInput
  )

  if (match) {
    setCurrentUser(match)
    return { success: true, user: match }
  }

  return { success: false, error: 'Invalid User ID or password. Please verify credentials.' }
}

export function logout(): void {
  setCurrentUser(null)
}

export async function addUser(
  data: Omit<UserAccount, 'id' | 'createdAt'>
): Promise<{ success: boolean; error?: string }> {
  const users = getUsers()
  const trimmedId = data.userId.trim()

  if (!trimmedId) {
    return { success: false, error: 'User ID cannot be empty.' }
  }
  if (!data.password.trim()) {
    return { success: false, error: 'Password cannot be empty.' }
  }

  // Check collision locally first
  const existing = users.find((u) => u.userId.toLowerCase() === trimmedId.toLowerCase())
  if (existing) {
    return { success: false, error: `User ID "${trimmedId}" already exists.` }
  }

  const newUser: UserAccount = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: trimmedId,
    password: data.password,
    role: data.role,
    name: data.name.trim() || trimmedId,
    createdAt: new Date().toISOString().split('T')[0],
  }

  // Optimistic update locally
  saveUsers([...users, newUser])

  // Persist to central backend
  try {
    await apiCreateUser({
      userId: trimmedId,
      password: data.password,
      name: newUser.name,
      role: data.role,
    })
    await syncUsersWithServer()
  } catch (err: any) {
    console.warn('Central server create notice:', err.message)
  }

  return { success: true }
}

export async function updateUser(
  id: string,
  updates: Partial<Omit<UserAccount, 'id' | 'createdAt'>>
): Promise<{ success: boolean; error?: string }> {
  const users = getUsers()
  const targetIndex = users.findIndex((u) => u.id === id || u.userId.toLowerCase() === id.toLowerCase())
  if (targetIndex === -1) {
    return { success: false, error: 'Account not found.' }
  }

  if (updates.userId) {
    const trimmedId = updates.userId.trim()
    const duplicate = users.find(
      (u) => u.id !== id && u.userId.toLowerCase() === trimmedId.toLowerCase()
    )
    if (duplicate) {
      return { success: false, error: `User ID "${trimmedId}" is already in use.` }
    }
    updates.userId = trimmedId
  }

  const current = users[targetIndex]
  const updatedUser: UserAccount = {
    ...current,
    ...updates,
    name: updates.name?.trim() || current.name,
  }

  users[targetIndex] = updatedUser
  saveUsers(users)

  // If currently logged-in user was updated, update session too
  const sessionUser = getCurrentUser()
  if (sessionUser && (sessionUser.id === id || sessionUser.userId.toLowerCase() === current.userId.toLowerCase())) {
    setCurrentUser(updatedUser)
  }

  // Persist to central backend
  try {
    await apiUpdateUser(current.userId, {
      userId: updates.userId,
      password: updates.password,
      name: updates.name,
      role: updates.role,
    })
    await syncUsersWithServer()
  } catch (err: any) {
    console.warn('Central server update notice:', err.message)
  }

  return { success: true }
}

export async function deleteUser(
  id: string,
  currentUserId: string
): Promise<{ success: boolean; error?: string }> {
  const users = getUsers()
  const target = users.find((u) => u.id === id || u.userId.toLowerCase() === id.toLowerCase())
  if (!target) {
    return { success: false, error: 'Account not found.' }
  }

  if (target.userId.toLowerCase() === currentUserId.toLowerCase()) {
    return { success: false, error: 'Cannot delete the account you are currently logged into.' }
  }

  if (target.role === 'admin') {
    const adminCount = users.filter((u) => u.role === 'admin').length
    if (adminCount <= 1) {
      return { success: false, error: 'Cannot delete the sole remaining Administrator account.' }
    }
  }

  const remaining = users.filter((u) => u.id !== target.id)
  saveUsers(remaining)

  // Persist deletion to central backend
  try {
    await apiDeleteUser(target.userId, currentUserId)
    await syncUsersWithServer()
  } catch (err: any) {
    console.warn('Central server delete notice:', err.message)
  }

  return { success: true }
}
