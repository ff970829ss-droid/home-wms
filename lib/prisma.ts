import { PrismaClient } from '@prisma/client';

const isBuildPhase = 
  process.env.npm_lifecycle_event === 'build' || 
  process.env.NEXT_PHASE === 'phase-production-build' || 
  process.env.CI === '1';

const buildTimeMock = new Proxy({}, {
  get: () => new Proxy({}, {
    get: () => () => Promise.resolve([])
  })
});

const globalForPrisma = globalThis as unknown as { prismaInstance: PrismaClient | undefined };

// 核心修改：追加 : any 类型声明，强制 TypeScript 放行
export const prisma: any = isBuildPhase
  ? buildTimeMock
  : new Proxy({}, {
      get: (_, prop) => {
        if (!globalForPrisma.prismaInstance) {
          globalForPrisma.prismaInstance = new PrismaClient();
        }
        return (globalForPrisma.prismaInstance as any)[prop];
      }
    });
