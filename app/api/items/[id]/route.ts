export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const item = await prisma.item.findUnique({
    where: { id },
  });

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PATCH(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const updated = await prisma.item.updateMany({
    where: {
      id,
      quantity: { gt: 0 },
    },
    data: {
      quantity: { decrement: 1 },
    },
  });

  if (updated.count === 0) {
    const existing = await prisma.item.findUnique({
      where: { id },
      select: { id: true, quantity: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "quantity is already 0" },
      { status: 409 },
    );
  }

  const item = await prisma.item.findUnique({
    where: { id },
  });

  return NextResponse.json(item);
}

