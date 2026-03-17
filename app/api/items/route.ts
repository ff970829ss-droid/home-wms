export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export async function GET() {
  const prisma = getPrisma();
  const items = await prisma.item.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const prisma = getPrisma();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, location, quantity, barcode } = body as {
    name?: unknown;
    location?: unknown;
    quantity?: unknown;
    barcode?: unknown;
  };

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof location !== "string" || location.trim().length === 0) {
    return NextResponse.json({ error: "location is required" }, { status: 400 });
  }

  let normalizedQuantity: number | undefined;
  if (quantity !== undefined) {
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      return NextResponse.json(
        { error: "quantity must be a non-negative integer" },
        { status: 400 },
      );
    }
    normalizedQuantity = quantity;
  }

  let normalizedBarcode: string | undefined;
  if (barcode !== undefined) {
    if (barcode === null) {
      normalizedBarcode = undefined;
    } else if (typeof barcode !== "string") {
      return NextResponse.json({ error: "barcode must be a string" }, { status: 400 });
    } else {
      const b = barcode.trim();
      if (b.length > 0) normalizedBarcode = b;
    }
  }

  const created = await prisma.item.create({
    data: {
      name: name.trim(),
      location: location.trim(),
      ...(normalizedBarcode === undefined ? {} : { barcode: normalizedBarcode }),
      ...(normalizedQuantity === undefined ? {} : { quantity: normalizedQuantity }),
    },
  });

  return NextResponse.json(created, { status: 201 });
}

