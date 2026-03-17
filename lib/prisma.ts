import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      // 核心：若构建期无真实环境变量，注入 Dummy 地址防止实例化崩溃
      url: process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy"
    }
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
