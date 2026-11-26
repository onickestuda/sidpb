import { NextRequest, NextResponse } from "next/server";
import { requireOrigin, settings } from "@/server/auth/config";
import { accessSession, invalidate } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join("/");
  if (path.some(part => !/^[a-zA-Z0-9_-]+$/.test(part)) || !/^(submissions|curation|admin)(\/|$)/.test(route))
    return NextResponse.json({ message: "Não encontrado." }, { status: 404 });
  if (!["GET", "HEAD"].includes(request.method)) {
    try { requireOrigin(request); } catch { return NextResponse.json({ message: "Origem inválida." }, { status: 403 }); }
  }
  try {
    const session = await accessSession();
    if (!session) return NextResponse.json({ message: "Sessão expirada. Entre novamente." }, { status: 401 });
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 25 * 1024 * 1024) return new NextResponse(null, { status: 413 });
    const headers = new Headers({ Authorization: `Bearer ${session.accessToken}` });
    const type = request.headers.get("content-type"); if (type) headers.set("Content-Type", type);
    const upstream = await fetch(`${settings().api}/api/${route}${request.nextUrl.search}`, {
      method: request.method, headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(60000),
      ...(!["GET", "HEAD"].includes(request.method) ? { body: request.body, duplex: "half" } : {}),
    } as RequestInit);
    if (upstream.status === 401) await invalidate();
    const output = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    for (const name of ["content-type", "content-disposition"]) { const value = upstream.headers.get(name); if (value) output.set(name, value); }
    return new NextResponse(upstream.body, { status: upstream.status, headers: output });
  } catch { return NextResponse.json({ message: "Serviço indisponível." }, { status: 503 }); }
}
export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
