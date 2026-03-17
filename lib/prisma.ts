import { PrismaClient } from '@prisma/client'
const prismaClientSingleton = () => new PrismaClient()
type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>
const globalForPrisma = globalThis as unknown as { prisma: PrismaClientSingleton | undefined }

// 关键修复：构建阶段跳过初始化
const isBuilding = process.env.NEXT_PHASE === 'phase-production-build'
export const prisma = isBuilding 
  ? ({} as PrismaClientSingleton) 
  : (globalForPrisma.prisma ?? prismaClientSingleton())

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

