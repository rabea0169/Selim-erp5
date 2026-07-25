import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BaseRepository } from '../base'

interface Row {
  id?: string
  name?: string
  date?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

const fetchMock = vi.fn()

function respondWith(body: unknown) {
  fetchMock.mockResolvedValueOnce({ json: async () => body })
}

function lastRequest() {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit | undefined]
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('BaseRepository routing', () => {
  it('resolves path and response keys from the built-in API map', async () => {
    const repo = new BaseRepository<Row>('workers')
    respondWith({ workers: [{ id: '1' }] })

    await repo.getAll()
    expect(lastRequest()[0]).toBe('/api/workers')
  })

  it('derives defaults for unmapped stores and honours explicit overrides', async () => {
    const derived = new BaseRepository<Row>('gadgets' as never)
    respondWith({ gadgets: [{ id: '1' }] })
    expect(await derived.getAll()).toHaveLength(1)
    expect(lastRequest()[0]).toBe('/api/gadgets')

    const explicit = new BaseRepository<Row>('gadgets' as never, '/api/things', 'things', 'thing')
    respondWith({ things: [{ id: '1' }, { id: '2' }] })
    expect(await explicit.getAll()).toHaveLength(2)
    expect(lastRequest()[0]).toBe('/api/things')
  })
})

describe('BaseRepository reads', () => {
  it('normalizes Date fields to ISO strings', async () => {
    const repo = new BaseRepository<Row>('workers')
    const date = new Date('2024-01-15T10:00:00.000Z')
    respondWith({ workers: [{ id: '1', createdAt: date }] })

    const [row] = await repo.getAll()
    expect(row.createdAt).toBe(date.toISOString())
  })

  it('defaults sales and purchases to an empty items array', async () => {
    const sales = new BaseRepository<Row>('sales')
    respondWith({ sales: [{ id: '1' }] })
    expect((await sales.getAll())[0]).toMatchObject({ items: [] })

    const purchases = new BaseRepository<Row>('purchases')
    respondWith({ purchases: [{ id: '1' }] })
    expect((await purchases.getAll())[0]).toMatchObject({ items: [] })
  })

  it('returns an empty list when the API reports an error', async () => {
    const repo = new BaseRepository<Row>('workers')
    respondWith({ error: 'فشل' })
    expect(await repo.getAll()).toEqual([])
  })

  it('falls back to the raw payload when the single key is absent', async () => {
    const repo = new BaseRepository<Row>('workers')
    respondWith({ id: '1', name: 'أحمد' })
    expect(await repo.getById('1')).toMatchObject({ id: '1', name: 'أحمد' })
    expect(lastRequest()[0]).toBe('/api/workers/1')
  })

  it('returns undefined when a record is missing or the request fails', async () => {
    const repo = new BaseRepository<Row>('workers')
    respondWith({ error: 'السجل غير موجود' })
    expect(await repo.getById('1')).toBeUndefined()

    respondWith({ error: 'فشل الاتصال' })
    expect(await repo.getById('1')).toBeUndefined()
  })

  it('builds a query string from the search filters', async () => {
    const repo = new BaseRepository<Row>('sales')
    respondWith({ sales: [] })
    await repo.search('أحمد', '2024-01-01', '2024-01-31')
    expect(lastRequest()[0]).toBe('/api/sales?q=%D8%A3%D8%AD%D9%85%D8%AF&from=2024-01-01&to=2024-01-31')

    respondWith({ sales: [] })
    await repo.search()
    expect(lastRequest()[0]).toBe('/api/sales')

    respondWith({ sales: [] })
    await repo.getByDateRange('2024-01-01', '2024-01-31')
    expect(lastRequest()[0]).toBe('/api/sales?from=2024-01-01&to=2024-01-31')
  })

  it('returns an empty list when search fails', async () => {
    const repo = new BaseRepository<Row>('sales')
    respondWith({ error: 'فشل' })
    expect(await repo.search('x')).toEqual([])
  })

  it('counts records via getAll', async () => {
    const repo = new BaseRepository<Row>('workers')
    respondWith({ workers: [{ id: '1' }, { id: '2' }] })
    expect(await repo.count()).toBe(2)
  })
})

describe('BaseRepository writes', () => {
  it('strips generated fields and serializes dates on create', async () => {
    const repo = new BaseRepository<Row>('workers')
    respondWith({ worker: { id: 'new' } })

    const date = new Date('2024-01-15T10:00:00.000Z')
    await repo.create({ id: 'ignored', createdAt: date, updatedAt: date, name: 'أحمد', date })

    const [url, init] = lastRequest()
    expect(url).toBe('/api/workers')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ name: 'أحمد', date: date.toISOString() })
  })

  it('propagates create errors', async () => {
    const repo = new BaseRepository<Row>('workers')
    respondWith({ error: 'فشل الحفظ' })
    await expect(repo.create({ name: 'أحمد' })).rejects.toThrow('فشل الحفظ')
  })

  it('keeps updatedAt but drops id and createdAt on update', async () => {
    const repo = new BaseRepository<Row>('workers')
    respondWith({ worker: { id: '1', name: 'أحمد' } })

    await repo.update('1', { id: 'ignored', createdAt: 'x', updatedAt: '2024-01-15', name: 'أحمد' })

    const [url, init] = lastRequest()
    expect(url).toBe('/api/workers/1')
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(String(init?.body))).toEqual({ updatedAt: '2024-01-15', name: 'أحمد' })
  })

  it('returns undefined when an update fails', async () => {
    const repo = new BaseRepository<Row>('workers')
    respondWith({ error: 'فشل' })
    expect(await repo.update('1', { name: 'أحمد' })).toBeUndefined()
  })

  it('deletes a record and a batch of records', async () => {
    const repo = new BaseRepository<Row>('workers')
    respondWith({ success: true })
    await repo.delete('1')
    expect(lastRequest()).toEqual(['/api/workers/1', expect.objectContaining({ method: 'DELETE' })])

    respondWith({ success: true })
    respondWith({ success: true })
    await repo.deleteMany(['1', '2'])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('propagates delete errors', async () => {
    const repo = new BaseRepository<Row>('workers')
    respondWith({ error: 'فشل الحذف' })
    await expect(repo.delete('1')).rejects.toThrow('فشل الحذف')
  })
})

describe('BaseRepository legacy helpers', () => {
  it('clear() is a no-op warning', async () => {
    const repo = new BaseRepository<Row>('workers')
    await expect(repo.clear()).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('getByIndex() falls back to getAll', async () => {
    const repo = new BaseRepository<Row>('workers')
    respondWith({ workers: [{ id: '1' }] })
    expect(await repo.getByIndex('name', 'أحمد')).toHaveLength(1)
    expect(lastRequest()[0]).toBe('/api/workers')
  })
})
