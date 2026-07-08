import { supabase } from '@/lib/supabase/client'

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }

  return supabase
}

/** URL pública estable de un asset de empresa (bucket público, no requiere firmar). */
export function createCompanyAssetUrl(path: string) {
  const client = requireSupabase()

  return client.storage.from('company-assets').getPublicUrl(path).data.publicUrl
}
