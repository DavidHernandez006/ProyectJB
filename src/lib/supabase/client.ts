// src/lib/supabase/client.ts
//
// Cliente de Supabase para Client Components ("use client").
// Usa la anon key; las políticas RLS aplican normalmente según el usuario
// autenticado en el navegador.

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
