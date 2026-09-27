import { redirect } from 'next/navigation'

import ProfileSettingsForm, { type ProfileNotificationPreferences } from '@/components/shared/ProfileSettingsForm'
import { createClient } from '@/lib/auth/server'

const DEFAULT_PREFERENCES: ProfileNotificationPreferences = {
  email_assignment_reminders: true,
  email_submission_confirmations: true,
  email_fallback_attention: true,
  email_product_updates: false,
}

export default async function StudentProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [profileResult, preferencesResult] = await Promise.all([
    supabase.from('profiles').select('full_name, email, department, phone_e164, role').eq('id', user.id).maybeSingle(),
    supabase.from('notification_preferences').select('email_assignment_reminders, email_submission_confirmations, email_fallback_attention, email_product_updates').eq('user_id', user.id).maybeSingle(),
  ])
  if (profileResult.error) throw profileResult.error
  if (preferencesResult.error) throw preferencesResult.error
  if (!profileResult.data || profileResult.data.role !== 'student') redirect('/lecturer')

  return <ProfileSettingsForm initialData={{
    fullName: profileResult.data.full_name,
    email: profileResult.data.email ?? user.email ?? '',
    phoneE164: profileResult.data.phone_e164,
    department: profileResult.data.department,
    roleLabel: 'Student',
    notificationPreferences: preferencesResult.data ?? DEFAULT_PREFERENCES,
  }} />
}
