import { PrismaClient } from '@prisma/client'

// 核心修复：在实例化之前，若检测无真实环境变量，直接在 Node 环境中注入 Dummy 地址
// 完美绕过 TypeScript 对 PrismaClientOptions 的严格类型校验
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://dummy:dummy@localhost:5432/dummy"
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
