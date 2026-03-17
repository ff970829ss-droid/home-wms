"use client";

import { Scan, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

type Item = {
  id: string;
  barcode?: string | null;
  name: string;
  location: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
};

type ApiError = { error: string };

function isApiError(x: unknown): x is ApiError {
  return typeof x === "object" && x !== null && "error" in x;
}

export default function HomePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState<string>("0");
  const [barcode, setBarcode] = useState<string>("");

  const [isSaving, startSaving] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [barcodeHint, setBarcodeHint] = useState<string | null>(null);

  async function loadItems(options?: { showLoading?: boolean }) {
    const showLoading = options?.showLoading ?? false;
    setError(null);
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/items", { cache: "no-store" });
      const data: unknown = await res.json();
      if (!res.ok) {
        setError(isApiError(data) ? data.error : "Failed to load items");
        return;
      }
      setItems(Array.isArray(data) ? (data as Item[]) : []);
    } catch {
      setError("Failed to load items");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems({ showLoading: true });
  }, []);

  useEffect(() => {
    if (!isDrawerOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isDrawerOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      return (
        it.name.toLowerCase().includes(q) || it.location.toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  function resetForm() {
    setName("");
    setLocation("");
    setQuantity("0");
    setBarcode("");
    setBarcodeHint(null);
  }

  function normalizeQuantity(raw: string): number | undefined {
    const trimmed = raw.trim();
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return undefined;
    return n;
  }

  function toastError(message: string) {
    setError(message);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onFieldFocus(e: React.FocusEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const n = name.trim();
    const l = location.trim();
    if (!n) return toastError("名称不能为空");
    if (!l) return toastError("位置不能为空");

    const q = normalizeQuantity(quantity);
    if (q === undefined) return toastError("初始数量必须是非负整数");

    startSaving(async () => {
      try {
        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: n,
            location: l,
            quantity: q,
            ...(barcode.trim() ? { barcode: barcode.trim() } : {}),
          }),
        });

        const data: unknown = await res.json();
        if (!res.ok) {
          toastError(isApiError(data) ? data.error : "保存失败");
          return;
        }

        resetForm();
        setIsDrawerOpen(false);
        await loadItems();
      } catch {
        toastError("保存失败");
      }
    });
  }

  function guessLocationFromCategory(category: string | undefined): string | null {
    if (!category) return null;
    const c = category.toLowerCase();
    // Very small heuristic, best-effort.
    if (/(kitchen|food|饮料|食品|厨房|调料|米|面|油)/i.test(c)) return "厨房";
    if (/(bath|toilet|卫生间|洗护|纸|清洁|清洗)/i.test(c)) return "卫生间";
    if (/(bed|sleep|卧室|床上|被|枕)/i.test(c)) return "卧室";
    if (/(balcony|阳台|晾晒|洗衣)/i.test(c)) return "阳台";
    return null;
  }

  async function lookupBarcode(code: string) {
    setScannerError(null);
    setBarcodeHint(null);
    setBarcode(code);

    try {
      const res = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`, {
        cache: "no-store",
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        setBarcodeHint("查询失败，请手动输入名称");
        return;
      }

      if (
        typeof data === "object" &&
        data !== null &&
        "found" in data &&
        (data as { found: unknown }).found === true
      ) {
        const d = data as { name?: unknown; brand?: unknown; category?: unknown };
        const n =
          typeof d.name === "string" && d.name.trim()
            ? d.name.trim()
            : typeof d.brand === "string" && d.brand.trim()
              ? d.brand.trim()
              : "";
        if (n) setName(n);

        const guessed =
          typeof d.category === "string" ? guessLocationFromCategory(d.category) : null;
        if (guessed && !location.trim()) setLocation(guessed);

        return;
      }

      setBarcodeHint("未找到商品信息，请手动输入名称");
    } catch {
      setBarcodeHint("查询失败，请手动输入名称");
    }
  }

  useEffect(() => {
    if (!isScannerOpen) return;

    let cancelled = false;
    let qr: any | null = null;

    async function start() {
      setScannerError(null);
      try {
        const mod = await import("html5-qrcode");
        if (cancelled) return;
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = mod as any;

        qr = new Html5Qrcode("barcode-reader");
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
        ].filter(Boolean);

        await qr.start(
          { facingMode: "environment" },
          {
            fps: 12,
            qrbox: { width: 250, height: 180 },
            ...(formatsToSupport.length ? { formatsToSupport } : {}),
          },
          async (decodedText: string) => {
            if (cancelled) return;
            // Best-effort vibration feedback.
            if (navigator.vibrate) navigator.vibrate(40);

            const code = decodedText.trim();
            // Stop camera first to prevent repeated scans.
            try {
              await qr?.stop?.();
              await qr?.clear?.();
            } catch {
              // ignore
            }
            qr = null;
            setIsScannerOpen(false);
            await lookupBarcode(code);
          },
          () => {
            // ignore decode errors (keeps scanning)
          },
        );
      } catch {
        setScannerError("无法打开摄像头，请检查权限或使用 HTTPS");
      }
    }

    void start();

    return () => {
      cancelled = true;
      (async () => {
        try {
          await qr?.stop?.();
        } catch {
          // ignore
        }
        try {
          await qr?.clear?.();
        } catch {
          // ignore
        }
        qr = null;
      })();
    };
  }, [isScannerOpen]);

  async function decrement(id: string) {
    setError(null);
    setBusyId(id);

    try {
      const res = await fetch(`/api/items/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
      });

      const data: unknown = await res.json();
      if (!res.ok) {
        toastError(isApiError(data) ? data.error : "扣减失败");
        return;
      }

      await loadItems();
    } catch {
      toastError("扣减失败");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-[100svh] bg-white text-zinc-900">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 pb-[max(6rem,env(safe-area-inset-bottom))]">
        <header className="sticky top-0 z-30 -mx-5 mb-6 border-b border-zinc-200 bg-white/90 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">家庭物资管理</h1>
              <p className="text-sm text-zinc-500">
                极简 · 黑白灰 · 录入 / 搜索 / 扣减
              </p>
            </div>

            <div className="w-full sm:w-72">
              <label className="block text-xs font-medium text-zinc-600">
                搜索（名称 / 位置）
              </label>
              <div className="relative mt-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="名称 / 位置"
                  className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-4 pr-16 text-base outline-none ring-0 transition focus:border-zinc-400 sm:text-sm"
                />
                {query.trim().length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    aria-label="清空搜索"
                    title="清空"
                  >
                    清空
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
              {error}
            </div>
          ) : null}
        </header>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-800">
              物品列表
            </h2>
            <div className="flex items-center gap-3">
              <div className="text-xs text-zinc-500">
                {loading ? "加载中…" : `${filtered.length} / ${items.length}`}
              </div>
              <button
                type="button"
                onClick={() => void loadItems({ showLoading: true })}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                刷新
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500">
                正在加载…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500">
                暂无物品。先在上方录入一条吧。
              </div>
            ) : (
              filtered.map((it) => (
                <div
                  key={it.id}
                  className={
                    it.quantity === 0
                      ? "group rounded-2xl border border-zinc-200 bg-zinc-50 p-2.5 text-zinc-500 sm:p-3"
                      : "group rounded-2xl border border-zinc-200 bg-white p-2.5 sm:p-3"
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold text-zinc-900 sm:text-base">
                          {it.name}
                        </div>
                        <div className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-700 sm:text-xs">
                          {it.location}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 sm:text-sm">
                        库存：{" "}
                        <span
                          className={
                            it.quantity === 0
                              ? "font-semibold text-zinc-400"
                              : "font-semibold text-zinc-900"
                          }
                        >
                          {it.quantity}
                        </span>
                        {it.quantity === 0 ? (
                          <span className="ml-2 rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 sm:text-xs">
                            已耗尽
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <button
                      onClick={() => void decrement(it.id)}
                      disabled={busyId === it.id || it.quantity === 0}
                      className="inline-flex h-12 w-20 shrink-0 items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-white text-lg font-black tracking-tight text-zinc-900 transition hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 sm:w-24 sm:text-xl"
                      aria-label={`扣减 ${it.name} 库存 -1`}
                      title="-1"
                    >
                      {busyId === it.id ? (
                        <>
                          <span
                            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/25 border-t-zinc-900 group-hover:border-white/25 group-hover:border-t-white"
                            aria-hidden
                          />
                          -1
                        </>
                      ) : (
                        "-1"
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <footer className="mt-10 text-xs text-zinc-400">
          API：<span className="font-mono">/api/items</span> ·{" "}
          <span className="font-mono">/api/items/:id</span>
        </footer>
      </div>

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsDrawerOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-2xl font-black text-white shadow-lg shadow-zinc-900/20 ring-1 ring-black/10 transition hover:bg-black active:scale-[0.98] sm:bottom-8 sm:right-8"
        aria-label="添加物品"
        title="添加"
      >
        +
      </button>

      {/* Bottom Drawer */}
      {isDrawerOpen ? (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="录入物品"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="关闭"
          />

          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto w-full max-w-3xl">
              <div className="rounded-t-3xl border border-zinc-200 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
                <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-200" />

                <div className="mb-4 flex items-center justify-between">
                  <div className="text-base font-semibold tracking-tight text-zinc-900">
                    录入物品
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    关闭
                  </button>
                </div>

                <form onSubmit={onCreate} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600">
                      名称
                    </label>
                    <div className="mt-2 flex items-stretch gap-2">
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onFocus={onFieldFocus}
                        autoFocus
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none transition focus:border-zinc-400"
                        placeholder="洗衣液"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setScannerError(null);
                          setIsScannerOpen(true);
                        }}
                        className="inline-flex w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-800 transition hover:bg-zinc-50 active:bg-zinc-100"
                        aria-label="扫码录入"
                        title="扫码"
                      >
                        <Scan className="h-5 w-5" aria-hidden />
                      </button>
                    </div>
                    {barcode.trim() ? (
                      <div className="mt-2 text-xs text-zinc-500">
                        条码：<span className="font-mono text-zinc-700">{barcode}</span>
                      </div>
                    ) : null}
                    {barcodeHint ? (
                      <div className="mt-2 text-xs font-medium text-zinc-700">
                        {barcodeHint}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600">
                      位置
                    </label>
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      onFocus={onFieldFocus}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none transition focus:border-zinc-400"
                      placeholder="阳台"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["厨房", "卫生间", "卧室", "阳台"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setLocation(preset)}
                          className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200"
                          aria-label={`填入位置：${preset}`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600">
                      初始数量
                    </label>
                    <input
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      inputMode="numeric"
                      onFocus={onFieldFocus}
                      className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none transition focus:border-zinc-400"
                      placeholder=""
                    />
                  </div>

                  <button
                    disabled={isSaving}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    type="submit"
                  >
                    {isSaving ? (
                      <>
                        <span
                          className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                          aria-hidden
                        />
                        保存中…
                      </>
                    ) : (
                      "保存"
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Scanner Overlay */}
      {isScannerOpen ? (
        <div className="fixed inset-0 z-[60] bg-black/80">
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">扫码</div>
              <button
                type="button"
                onClick={() => setIsScannerOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15 active:bg-white/20"
                aria-label="关闭扫码"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="mt-4 flex-1">
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black">
                <div id="barcode-reader" className="w-full" />
                {/* Viewfinder */}
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="h-44 w-72 rounded-2xl border-2 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                </div>
              </div>

              {scannerError ? (
                <div className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/90">
                  {scannerError}
                </div>
              ) : (
                <div className="mt-4 text-xs text-white/70">
                  对准条形码，识别成功会自动填充。
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

