import { basePath } from "@/lib/publicConfig";
export type ApiEnvelope<T> = T | { data: T }

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.details = details
  }
}

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  ""
).replace(/\/$/, "")

type QueryValue = string | number | boolean | null | undefined | Array<string | number | boolean>

export function apiUrl(path: string) {
  if (/^\/api\/(submissions|curation|admin)(\/|$)/.test(path)) {
    const base = basePath;
    return `${base}/api/bff/${path.slice(5)}`;
  }
  return `${API_BASE_URL}${path}`;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  params?: Record<string, QueryValue>
  body?: unknown
  timeoutMs?: number
}

function buildUrl(path: string, params?: Record<string, QueryValue>) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin
  const url = new URL(apiUrl(normalizedPath), origin)

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return

    if (Array.isArray(value)) {
      if (value.length > 0) url.searchParams.set(key, value.join(","))
      return
    }

    url.searchParams.set(key, String(value))
  })

  return url.toString()
}

function unwrapEnvelope<T>(payload: ApiEnvelope<T>): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data
  }

  return payload as T
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL && !/^\/api\/(submissions|curation|admin)(\/|$)/.test(path)) {
    throw new ApiError("NEXT_PUBLIC_API_URL nao foi configurado.", 0)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000)
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData

  try {
    const response = await fetch(buildUrl(path, options.params), {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      // O navegador define o boundary de multipart; não definir Content-Type manualmente.
      body: isFormData ? options.body as FormData : options.body ? JSON.stringify(options.body) : undefined,
      // O timeout vale mesmo quando o chamador (ex.: react-query) envia o próprio signal.
      signal: options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal,
    })

    const text = await response.text()
    const payload = text ? JSON.parse(text) : null

    if (!response.ok) {
      if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("sidpb-session-expired"));
      throw new ApiError(
        payload?.message ?? `Erro ${response.status} ao chamar ${path}.`,
        response.status,
        payload
      )
    }

    return unwrapEnvelope<T>(payload as ApiEnvelope<T>)
  } finally {
    clearTimeout(timeout)
  }
}
