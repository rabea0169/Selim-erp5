import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prismaServer: PrismaClient | undefined
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL!
  const pool = new Pool({ connectionString: databaseUrl })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter, log: ['error'] })
}

export const db = globalForPrisma.prismaServer ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaServer = db
