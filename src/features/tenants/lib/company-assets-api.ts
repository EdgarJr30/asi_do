import { deriveThumbnailPath } from '@/lib/uploads/media'
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

/**
 * URL de la miniatura del asset. Los logos se muestran como máximo a 56px, así
 * que el original de 768x768 solo se necesita si la miniatura no existe (logos
 * SVG o subidos antes de esta optimización).
 */
export function createCompanyAssetThumbnailUrl(path: string) {
  return createCompanyAssetUrl(deriveThumbnailPath(path))
}
