import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import AssignmentSettingsForm from '@/components/lecturer/AssignmentSettingsForm'
import { createClient } from '@/lib/auth/server'

type Props = { params: Promise<{ id: string }> }

export default async function AssignmentSettingsPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: assignment, error } = await supabase
    .from('assignments')
    .select('id, title, description, status, current_policy_version_id')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!assignment) notFound()

  if (assignment.status !== 'draft' || !assignment.current_policy_version_id) {
    return (
      <section className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-semibold text-amber-900">Published policy is locked</h1>
        <p className="mt-2 text-sm text-amber-800">Assignment settings can only be changed while the assignment is a draft. Existing evidence keeps its original policy version.</p>
        <Link href={`/lecturer/assignments/${id}`} className="mt-4 inline-flex text-sm font-semibold text-blue-700 underline">Return to assignment</Link>
      </section>
    )
  }
  const { data: policy, error: policyError } = await supabase
    .from('assignment_policy_versions')
    .select('*')
    .eq('id', assignment.current_policy_version_id)
    .maybeSingle()
  if (policyError) throw policyError
  if (!policy) notFound()

  return <AssignmentSettingsForm initial={{
    id: assignment.id,
    title: assignment.title,
    description: assignment.description,
    policy: {
      deadlineAt: policy.deadline_at,
      fallbackEnabled: policy.fallback_enabled,
      gracePeriodMinutes: policy.grace_period_minutes,
      allowedMimeTypes: policy.allowed_mime_types,
      maxFileSizeBytes: policy.max_file_size_bytes,
    },
  }} />
}
