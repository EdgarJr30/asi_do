import type {
  CandidateEducationDraft,
  CandidateExperienceDraft,
  CandidateLanguageDraft,
  CandidateLinkDraft,
  CandidateProfileFormValues,
  CandidateSkillDraft
} from '@/features/candidate-profile/lib/candidate-profile-schemas'

// Borrador local del editor de perfil candidato. Se guarda en IndexedDB (no en
// localStorage) porque incluye los archivos de CV pendientes de subir, que
// pueden pesar varios MB. Es best-effort: si el navegador no soporta o falla
// IndexedDB, el editor sigue funcionando sin persistencia de borrador.
const DRAFT_DB_NAME = 'asi-do-candidate-profile'
const DRAFT_DB_VERSION = 1
const DRAFT_STORE_NAME = 'profile-drafts'

export interface CandidateProfileDraft {
  formValues: CandidateProfileFormValues
  experiences: CandidateExperienceDraft[]
  educations: CandidateEducationDraft[]
  skills: CandidateSkillDraft[]
  languages: CandidateLanguageDraft[]
  links: CandidateLinkDraft[]
  stagedResumeFiles: File[]
  savedAt: number
}

function openDraftDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible en este entorno.'))
      return
    }

    const request = indexedDB.open(DRAFT_DB_NAME, DRAFT_DB_VERSION)

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DRAFT_STORE_NAME)) {
        request.result.createObjectStore(DRAFT_STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('No pudimos abrir la base local de borradores.'))
  })
}

async function runDraftTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
) {
  const database = await openDraftDatabase()

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(DRAFT_STORE_NAME, mode)
      const request = operation(transaction.objectStore(DRAFT_STORE_NAME))

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Falló la operación sobre el borrador local.'))
    })
  } finally {
    database.close()
  }
}

export async function loadCandidateProfileDraft(userId: string) {
  try {
    const draft = await runDraftTransaction<CandidateProfileDraft | undefined>('readonly', (store) => store.get(userId))

    return draft ?? null
  } catch {
    return null
  }
}

export async function saveCandidateProfileDraft(userId: string, draft: CandidateProfileDraft) {
  try {
    await runDraftTransaction('readwrite', (store) => store.put(draft, userId))
  } catch {
    // Persistencia best-effort: no interrumpimos la edición si falla.
  }
}

export async function clearCandidateProfileDraft(userId: string) {
  try {
    await runDraftTransaction('readwrite', (store) => store.delete(userId))
  } catch {
    // Persistencia best-effort: no interrumpimos la edición si falla.
  }
}
