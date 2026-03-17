import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// 智能初始化逻辑：没密码时用替身，有密码时动真格
const getPrismaClient = () => {
  if (!process.env.DATABASE_URL) {
    console.warn(
      "⚠️ 警告: 未检测到 DATABASE_URL。如果是在构建期，这是正常的。已启用替身规避崩溃。",
    );
    // 安全替身：无论 Next.js 怎么预渲染，都统一返回 null
    return new Proxy(
      {},
      {
        get: () =>
          new Proxy(
            {},
            {
              get: () => () => Promise.resolve(null),
            },
          ),
      },
    ) as any;
  }
  return new PrismaClient();
};

// 明确声明类型，防止 TypeScript 报错
export const prisma: PrismaClient = globalForPrisma.prisma ?? getPrismaClient();

if (process.env.NODE_ENV !== 'production' && process.env.DATABASE_URL) {
  globalForPrisma.prisma = prisma;
}
