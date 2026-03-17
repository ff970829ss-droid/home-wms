import { NextResponse } from "next/server";

export const runtime = "nodejs";

type UpstreamResponse = {
  name?: unknown;
  title?: unknown;
  product_name?: unknown;
  brand?: unknown;
  category?: unknown;
  categories?: unknown;
};

function pickString(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === "string") {
      const s = v.trim();
      if (s) return s;
    }
  }
  return undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") ?? "").trim();
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  // Public barcode API (best-effort). We proxy it to avoid CORS issues.
  const upstreamUrl = `https://node.v6.navy/api/barcode?code=${encodeURIComponent(code)}`;

  let upstream: unknown;
  try {
    const res = await fetch(upstreamUrl, {
      // Some free endpoints can be flaky; avoid caching.
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ code, found: false }, { status: 200 });
    }
    upstream = (await res.json()) as unknown;
  } catch {
    return NextResponse.json({ error: "barcode lookup failed" }, { status: 502 });
  }

  const obj = (typeof upstream === "object" && upstream !== null
    ? (upstream as Record<string, unknown>)
    : {}) as UpstreamResponse & Record<string, unknown>;

  const name = pickString(obj.name, obj.title, obj.product_name);
  const brand = pickString(obj.brand);
  const category = pickString(obj.category, obj.categories);

  if (!name && !brand && !category) {
    return NextResponse.json({ code, found: false }, { status: 200 });
  }

  return NextResponse.json(
    {
      code,
      found: true,
      name: name ?? undefined,
      brand: brand ?? undefined,
      category: category ?? undefined,
      raw: obj,
    },
    { status: 200 },
  );
}

