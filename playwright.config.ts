import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

import { defineConfig, devices } from '@playwright/test'

const cli = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const status = spawnSync(cli, ['supabase', 'status', '--output', 'env'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  shell: process.platform === 'win32',
  windowsHide: true,
})
if (status.status !== 0) {
  throw new Error('Playwright needs the local Supabase stack. Start it with `npm run db:start` and reset it with `npm run db:reset`.')
}

const localConfig = Object.fromEntries(status.stdout.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^([A-Z0-9_]+)="?([^"\r\n]*)"?$/)
  return match ? [[match[1], match[2]]] : []
}))
const supabaseUrl = localConfig.API_URL ?? localConfig.SUPABASE_URL
const anonKey = localConfig.ANON_KEY
const serviceRoleKey = localConfig.SERVICE_ROLE_KEY
if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('Local Supabase status did not provide the URL and keys required for browser tests.')
}
if (!['localhost', '127.0.0.1'].includes(new URL(supabaseUrl).hostname)) {
  throw new Error('Browser tests refuse to run against a non-local Supabase instance.')
}
process.env.E2E_SUPABASE_URL = supabaseUrl
process.env.E2E_SUPABASE_ANON_KEY = anonKey
process.env.E2E_SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey

const port = process.env.SUBMITPROOF_E2E_PORT ?? '3102'
const baseURL = `http://127.0.0.1:${port}`
const nextBinary = resolve('node_modules/next/dist/bin/next')
const command = `"${process.execPath}" "${nextBinary}" dev --hostname 127.0.0.1 --port ${port}`
const appEnvironment = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  ENABLE_SIMULATED_SMS: 'true',
  NEXT_PUBLIC_ENABLE_SIMULATED_SMS: 'true',
  E2E_SUPABASE_URL: supabaseUrl,
  E2E_SUPABASE_ANON_KEY: anonKey,
  E2E_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command,
    url: `${baseURL}/api/health`,
    env: appEnvironment,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
