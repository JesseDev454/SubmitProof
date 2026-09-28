export function buildSmsComposerLink(destination: string, message: string): string | null {
  const normalizedDestination = destination.trim()
  if (!/^\+?[0-9]{3,20}$/.test(normalizedDestination) || message.length === 0) return null

  return `sms:${normalizedDestination}?body=${encodeURIComponent(message)}`
}
