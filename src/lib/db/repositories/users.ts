import { BaseRepository } from './base'
import type { User } from '../types'

class UserRepository extends BaseRepository<User> {
  constructor() {
    // users ليس لها API path في API_MAP - لا تحتاجها
    super('users', '/api/auth/users', 'users', 'user')
  }

  async hasAnyUser(): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/register')
      const data = await res.json()
      return data.hasUsers === true
    } catch {
      return false
    }
  }

  async createWithPassword(_data: any): Promise<User> {
    // إنشاء المستخدمين يتم عبر /api/auth/register
    throw new Error('استخدم /api/auth/register لإنشاء مستخدم')
  }

  async verifyPassword(_username: string, _password: string): Promise<User | null> {
    // التحقق يتم عبر /api/auth/login
    return null
  }
}

export const userRepository = new UserRepository()
