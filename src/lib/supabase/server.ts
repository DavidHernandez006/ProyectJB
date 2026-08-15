// src/lib/supabase/server.ts
//
// Cliente de Supabase para Server Components, Server Actions y Route Handlers.
//
// IMPORTANTE: `cookies()` de next/headers es async en Next.js 15+, por lo que
// `createClient()` también debe ser async y llamarse con `await` en cada uso:
//
//   const supabase = await createClient()
//
// Usa la anon key -> las políticas RLS aplican automáticamente según el
// usuario autenticado (a diferencia del cliente service role de abajo, que
// las salta por completo y solo debe usarse en operaciones privilegiadas
// como el scraper o los crons).

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // `setAll` fue llamado desde un Server Component sin permiso de
            // escritura sobre cookies. Se puede ignorar si el middleware ya
            // se encarga de refrescar la sesión en cada request.
          }
        },
      },
    }
  )
}

/**
 * Cliente con la service role key. Salta RLS por completo.
 * Reservado para operaciones privilegiadas del backend: el scraper
 * escribiendo en `job_offers`, los crons de alertas, etc. NUNCA usarlo en
 * rutas que respondan directamente a acciones de un usuario autenticado.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
