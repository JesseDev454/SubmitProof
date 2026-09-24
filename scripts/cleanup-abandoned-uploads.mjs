import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

const apply = process.argv.includes('--apply')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running cleanup.')
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
const { data: expired, error: expiredError } = await admin
  .from('submission_upload_reservations')
  .select('id, status, staging_object_path')
  .eq('status', 'reserved')
  .lt('expires_at', cutoff)
if (expiredError) throw expiredError

const finalizedCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
const { data: finalized, error: finalizedError } = await admin
  .from('submission_upload_reservations')
  .select('id, status, staging_object_path')
  .eq('status', 'finalized')
  .lt('updated_at', finalizedCutoff)
if (finalizedError) throw finalizedError

const candidates = [...(expired ?? []), ...(finalized ?? [])]
for (const reservation of candidates) {
  if (!apply) {
    process.stdout.write(`Would remove staging object ${reservation.staging_object_path}\n`)
    continue
  }

  const { error: removeError } = await admin.storage
    .from('submission-files')
    .remove([reservation.staging_object_path])
  if (removeError) {
    process.stderr.write(`Could not remove ${reservation.staging_object_path}: ${removeError.message}\n`)
    continue
  }
  if (reservation.status === 'reserved') {
    const { error } = await admin.rpc('mark_upload_reservation_expired', {
      p_reservation_id: reservation.id,
    })
    if (error) {
      process.stderr.write(`Removed ${reservation.staging_object_path}, but could not mark its reservation expired: ${error.message}\n`)
      continue
    }
  }
  process.stdout.write(`Removed staging object ${reservation.staging_object_path}\n`)
}

if (candidates.length === 0) process.stdout.write('No abandoned staging objects found.\n')
if (!apply) process.stdout.write('Dry run only. Re-run with --apply to remove objects.\n')
