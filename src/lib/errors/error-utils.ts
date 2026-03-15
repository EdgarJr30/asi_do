function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function toOptionalNumber(value: unknown) {
  return typeof value === 'number' ? value : null
}

export interface ErrorDetails {
  errorCode: string | null
  errorMessage: string
  stack: string | null
  metadata: Record<string, unknown>
}

export function extractErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    return {
      errorCode: error.name || 'Error',
      errorMessage: error.message,
      stack: error.stack ?? null,
      metadata: {}
    }
  }

  if (typeof error === 'string') {
    return {
      errorCode: 'Error',
      errorMessage: error,
      stack: null,
      metadata: {}
    }
  }

  if (isRecord(error)) {
    const message =
      toOptionalString(error.message) ??
      toOptionalString(error.error_description) ??
      toOptionalString(error.details) ??
      'Ocurrio un error inesperado.'
    const errorCode =
      toOptionalString(error.code) ??
      toOptionalString(error.name) ??
      (toOptionalNumber(error.status) !== null ? String(error.status) : null)

    return {
      errorCode,
      errorMessage: message,
      stack: toOptionalString(error.stack),
      metadata: {
        details: toOptionalString(error.details),
        hint: toOptionalString(error.hint),
        status: toOptionalNumber(error.status),
        statusText: toOptionalString(error.statusText)
      }
    }
  }

  return {
    errorCode: 'UnknownError',
    errorMessage: 'Ocurrio un error inesperado.',
    stack: null,
    metadata: {}
  }
}

export function toErrorMessage(error: unknown) {
  return extractErrorDetails(error).errorMessage
}

export function toControlledError(error: unknown, fallbackMessage?: string) {
  const details = extractErrorDetails(error)

  return new Error(fallbackMessage ?? details.errorMessage, {
    cause: error
  })
}
