'use client'

import { apiGet, apiPost } from '../../api-client'
import type { User } from '../types'

/**
 * User repository — API-based (no IndexedDB).
 * Handles auth/user operations via /api/auth endpoints.
 */
const userRepository = {
  /** Check whether any users exist in the system */
  async hasAnyUser(): Promise<boolean> {
    const res: any = await apiGet('/api/auth/register')
    return !!res?.hasUsers
  },

  /** Get user by username (calls register endpoint for status) */
  async getUsername(username: string): Promise<User | undefined> {
    const res: any = await apiGet('/api/auth/register')
    if (!res || !res.hasUsers) return undefined
    // Server-side lookup — this is primarily for register status check.
    // Direct user lookup by username isn't exposed via a public endpoint;
    // authentication is handled via verifyPassword.
    return undefined
  },

  /** Register / create a new user with password */
  async createWithPassword(data: { username: string; password: string; name: string; role?: string }): Promise<User> {
    return await apiPost<User>('/api/auth/register', data)
  },

  /** Verify credentials and return the user */
  async verifyPassword(username: string, password: string): Promise<User | null> {
    try {
      const res: any = await apiPost('/api/auth/login', { username, password })
      return res?.user ?? res ?? null
    } catch {
      return null
    }
  },
}

export { userRepository }
