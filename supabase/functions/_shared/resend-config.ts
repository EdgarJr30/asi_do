type GetEnvironmentVariable = (name: string) => string | undefined

export function resolveResendConfig(getEnvironmentVariable: GetEnvironmentVariable) {
  return {
    apiKey: getEnvironmentVariable('RESEND_API_KEY_DEV') ?? '',
    fromAddress: getEnvironmentVariable('EMAIL_FROM_ADDRESS_DEV') ?? ''
  }
}

export function resolveResendWebhookSecret(getEnvironmentVariable: GetEnvironmentVariable) {
  return getEnvironmentVariable('RESEND_WEBHOOK_SECRET_DEV') ?? ''
}
