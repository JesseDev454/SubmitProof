export function isSimulatorEnabled(
  nodeEnv: string | undefined,
  enabledFlag: string | undefined,
): boolean {
  return nodeEnv !== 'production' && enabledFlag === 'true'
}
