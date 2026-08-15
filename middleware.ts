import { type NextRequest } from 'next/server'
import { updateSession } from '@/src/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Corre en todas las rutas excepto:
     * - archivos estáticos de _next
     * - favicon e imágenes
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
