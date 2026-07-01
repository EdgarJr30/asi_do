import { supabase } from '@/lib/supabase/client'

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }

  return supabase
}

export async function createCompanyAssetUrl(path: string) {
  const client = requireSupabase()
  const response = await client.storage.from('company-assets').createSignedUrl(path, 60 * 10)

  if (response.error) {
    throw response.error
  }

  return response.data.signedUrl
}
