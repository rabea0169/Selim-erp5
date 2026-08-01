import 'dotenv/config'
import { PrismaClient } from '../../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prismaServer: PrismaClient | undefined
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter, log: ['error'] })
}

export const db = globalForPrisma.prismaServer ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaServer = db
