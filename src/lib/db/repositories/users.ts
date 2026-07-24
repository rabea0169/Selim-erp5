import bcrypt from 'bcryptjs'
import { BaseRepository } from './base'
import type { User } from '../types'

class UserRepository extends BaseRepository<User> {
  constructor() {
    super('users', true)
  }

  async getByUsername(username: string): Promise<User | undefined> {
    const db = await this.getDB()
    return db.getFromIndex('users', 'by-username', username)
  }

  async hasAnyUser(): Promise<boolean> {
    const count = await this.count()
    return count > 0
  }

  async createWithPassword(data: {
    username: string
    password: string
    name: string
    role?: string
    companyId?: string
    phone?: string
    securityQuestion?: string
    securityAnswer?: string
  }): Promise<User> {
    const passwordHash = await bcrypt.hash(data.password, 10)
    return this.create({
      username: data.username,
      passwordHash,
      name: data.name,
      role: (data.role || 'admin') as User['role'],
      companyId: data.companyId || '',
      phone: data.phone,
      securityQuestion: data.securityQuestion,
      securityAnswerHash: data.securityAnswer ? await bcrypt.hash(data.securityAnswer.toLowerCase(), 10) : undefined,
    })
  }

  async verifyPassword(username: string, password: string): Promise<User | null> {
    const user = await this.getByUsername(username)
    if (!user) return null
    const valid = await bcrypt.compare(password, user.passwordHash)
    return valid ? user : null
  }
}

export const userRepository = new UserRepository()
