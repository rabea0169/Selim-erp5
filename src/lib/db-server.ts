import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prismaServer: PrismaClient | undefined
}

export const db = globalForPrisma.prismaServer ?? new PrismaClient({
  log: ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaServer = db
