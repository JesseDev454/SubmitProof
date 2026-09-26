export function isAllowedFileType(file: { name: string; type: string }, allowedTypes: string[]): boolean {
  if (!allowedTypes.length) return true

  const mimeType = file.type.trim().toLowerCase()
  const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
  return allowedTypes.some((allowed) => {
    const normalized = allowed.trim().toLowerCase()
    return normalized === mimeType || normalized === extension
  })
}
