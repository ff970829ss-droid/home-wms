export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, context: any) {
  try {
    // 核心修复：必须 await context.params
    const params = await context.params;
    if (!params?.id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const item = await prisma.item.findUnique({ where: { id: params.id } });
    return NextResponse.json(item || {});
  } catch (error) {
    // 拦截所有崩溃，返回标准 JSON，防止打断 Vercel 构建
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: any) {
  try {
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
    const params = await context.params;
    if (!params?.id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    await prisma.item.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

