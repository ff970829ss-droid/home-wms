import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 核心修复：强制 Node.js 环境，防止 Prisma 在 Vercel 构建沙盒中崩溃
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: Request, context: any) {
  try {
    // 核心修复：防御 Vercel 构建期的无参数探测
    if (!context || !context.params) {
      return NextResponse.json({ error: 'Build Context' }, { status: 200 });
    }

    const params = await context.params;
    if (!params?.id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const item = await prisma.item.findUnique({ where: { id: params.id } });
    return NextResponse.json(item || {});
  } catch (error) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: any) {
  try {
    if (!context || !context.params) {
      return NextResponse.json({ error: 'Build Context' }, { status: 200 });
    }

    const params = await context.params;
    if (!params?.id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const body = await request.json();
    const item = await prisma.item.update({
      where: { id: params.id },
      data: body,
    });
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: any) {
  try {
    if (!context || !context.params) {
      return NextResponse.json({ error: 'Build Context' }, { status: 200 });
    }

    const params = await context.params;
    if (!params?.id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    await prisma.item.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
