type GetEnvironmentVariable = (name: string) => string | undefined

export function resolveResendConfig(getEnvironmentVariable: GetEnvironmentVariable) {
  return {
    apiKey: getEnvironmentVariable('RESEND_API_KEY') ?? '',
    fromAddress: getEnvironmentVariable('EMAIL_FROM_ADDRESS') ?? ''
  }
}

export function resolveResendWebhookSecret(getEnvironmentVariable: GetEnvironmentVariable) {
  return getEnvironmentVariable('RESEND_WEBHOOK_SECRET') ?? ''
}
