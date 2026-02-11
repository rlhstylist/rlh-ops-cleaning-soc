const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Missing Supabase env vars: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

const defaultHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Supabase request failed: ${response.status}`)
  }

  if (response.status === 204) {
    return null as T
  }

  return (await response.json()) as T
}

export async function supabaseSelect<T>(table: string, query: string): Promise<T[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      ...defaultHeaders,
      'Content-Type': 'application/json',
    },
  })

  return parseResponse<T[]>(response)
}

export async function supabaseRpc<T>(fnName: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      ...defaultHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseResponse<T>(response)
}
