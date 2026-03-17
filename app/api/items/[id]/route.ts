import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 官方标准：明确告知框架此路由为动态渲染，禁止构建期预加载
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: any) {
  try {
    const params = await context.params;
    if (!params?.id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const item = await prisma.item.findUnique({ where: { id: params.id } });
    return NextResponse.json(item || {});
  } catch (error) {
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
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
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: any) {
  try {
    const params = await context.params;
    if (!params?.id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    await prisma.item.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  }
}
