import { PrismaClient } from '@prisma/client';

// 1. 精准识别 Vercel 构建环境
const isBuildPhase =
  process.env.npm_lifecycle_event === 'build' ||
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.CI === '1';

// 2. 构建期的“黑洞替身”：无论 Next.js 怎么扫描、调用，都只返回空数组，绝对不报错
const buildTimeMock = new Proxy(
  {},
  {
    get: () =>
      new Proxy(
        {},
        {
          get: () => () => Promise.resolve([]),
        },
      ),
  },
) as unknown as PrismaClient;

// 3. 运行时的全局单例缓存
const globalForPrisma = globalThis as unknown as {
  prismaInstance: PrismaClient | undefined;
};

// 4. 终极防御导出：打包时用替身，上线后才真正连接数据库
export const prisma = isBuildPhase
  ? buildTimeMock
  : new Proxy({} as PrismaClient, {
      get: (_: unknown, prop: string | symbol) => {
        // 只有当 API 被真正访问时，才执行耗时的数据库初始化
        if (!globalForPrisma.prismaInstance) {
          globalForPrisma.prismaInstance = new PrismaClient();
        }
        return (globalForPrisma.prismaInstance as any)[prop];
      },
    });
