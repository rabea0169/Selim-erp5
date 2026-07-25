import { describe, it, expect } from 'vitest'
import { ROLE_PERMISSIONS, hasPermission, withCompanyScope, type UserRole } from '@/lib/permissions'

const ACTIONS = [
  'create',
  'read',
  'update',
  'delete',
  'manageUsers',
  'manageSettings',
  'backup',
] as const

describe('hasPermission', () => {
  it('grants every action to owner and admin', () => {
    for (const role of ['owner', 'admin'] as UserRole[]) {
      for (const action of ACTIONS) {
        expect(hasPermission(role, action)).toBe(true)
      }
    }
  })

  it('lets a manager write and back up but not delete or administrate', () => {
    expect(hasPermission('manager', 'create')).toBe(true)
    expect(hasPermission('manager', 'update')).toBe(true)
    expect(hasPermission('manager', 'backup')).toBe(true)
    expect(hasPermission('manager', 'delete')).toBe(false)
    expect(hasPermission('manager', 'manageUsers')).toBe(false)
    expect(hasPermission('manager', 'manageSettings')).toBe(false)
  })

  it('restricts an employee to create/read/update', () => {
    expect(hasPermission('employee', 'create')).toBe(true)
    expect(hasPermission('employee', 'read')).toBe(true)
    expect(hasPermission('employee', 'update')).toBe(true)
    expect(hasPermission('employee', 'delete')).toBe(false)
    expect(hasPermission('employee', 'backup')).toBe(false)
  })

  it('gives a viewer read access only', () => {
    for (const action of ACTIONS) {
      expect(hasPermission('viewer', action)).toBe(action === 'read')
    }
  })

  it('denies everything for unknown or empty roles', () => {
    for (const action of ACTIONS) {
      expect(hasPermission('ghost', action)).toBe(false)
      expect(hasPermission('', action)).toBe(false)
    }
  })

  it('matches the ROLE_PERMISSIONS table for every role and action', () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as UserRole[]) {
      for (const action of ACTIONS) {
        expect(hasPermission(role, action)).toBe(ROLE_PERMISSIONS[role][action])
      }
    }
  })
})

describe('withCompanyScope', () => {
  it('adds the companyId without mutating the original filter', () => {
    const where = { status: 'active' }
    const scoped = withCompanyScope(where, 'company-1')

    expect(scoped).toEqual({ status: 'active', companyId: 'company-1' })
    expect(where).toEqual({ status: 'active' })
  })

  it('overrides an existing companyId', () => {
    expect(withCompanyScope({ companyId: 'other' }, 'company-1').companyId).toBe('company-1')
  })
})
