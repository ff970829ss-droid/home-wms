import { PrismaClient } from '@prisma/client';

// 核心防御：如果 Vercel 打包机拿不到环境变量，塞入一个绝对安全的【假地址】。
// 这样既不会泄露真实密码，又能完美骗过 Prisma 的初始化非空校验。
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://dummy:dummy@localhost:5432/dummy";
}

// 官方标准单例模式，没有任何 TypeScript 违规操作
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
