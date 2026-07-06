import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import '@/lib/i18n/config'

afterEach(() => {
  cleanup()
})

// localStorage/sessionStorage: Node 26 expone un `localStorage` global experimental
// (undefined salvo que se pase `--localstorage-file`) que deja a `window.localStorage`
// sin implementación utilizable bajo jsdom, rompiendo cualquier test que lo use. Un
// Storage en memoria es determinista y no depende de la versión de Node.
class MemoryStorage implements Storage {
  #store = new Map<string, string>()

  get length() {
    return this.#store.size
  }

  clear() {
    this.#store.clear()
  }

  getItem(key: string) {
    return this.#store.has(key) ? this.#store.get(key)! : null
  }

  key(index: number) {
    return Array.from(this.#store.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.#store.delete(key)
  }

  setItem(key: string, value: string) {
    this.#store.set(key, String(value))
  }
}

function isStorageUsable(candidate: unknown): candidate is Storage {
  try {
    if (!candidate) {
      return false
    }
    const probe = '__storage_probe__'
    ;(candidate as Storage).setItem(probe, '1')
    ;(candidate as Storage).removeItem(probe)
    return true
  } catch {
    return false
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  const current = (() => {
    try {
      return (window as unknown as Record<string, unknown>)[name]
    } catch {
      return undefined
    }
  })()

  if (!isStorageUsable(current)) {
    const storage = new MemoryStorage()
    Object.defineProperty(window, name, { value: storage, writable: true, configurable: true })
    Object.defineProperty(globalThis, name, { value: storage, writable: true, configurable: true })
  }
}

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false
    })
  })
}

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = '0px'
  readonly thresholds = [0]

  disconnect() {
    return undefined
  }

  observe() {
    return undefined
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  unobserve() {
    return undefined
  }
}

if (!window.IntersectionObserver) {
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: MockIntersectionObserver
  })
}

if (!globalThis.IntersectionObserver) {
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    writable: true,
    value: MockIntersectionObserver
  })
}

Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: () => undefined
})
