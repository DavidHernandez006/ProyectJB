// src/lib/supabase/middleware.ts
//
// Refresca la sesión de Supabase en cada request y protege las rutas del
// grupo (dashboard). Se invoca desde middleware.ts en la raíz del proyecto.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const RUTAS_PROTEGIDAS = ['/dashboard', '/cv', '/ofertas', '/pipeline', '/alertas', '/configuracion', '/comparador', '/mercado']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: no eliminar este await. Refresca el token si expiró y evita
  // que se pierda la sesión de forma intermitente.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const esRutaProtegida = RUTAS_PROTEGIDAS.some((ruta) =>
    request.nextUrl.pathname.startsWith(ruta)
  )

  if (!user && esRutaProtegida) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
