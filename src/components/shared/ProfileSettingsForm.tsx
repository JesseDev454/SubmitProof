'use client'

import { useState } from 'react'

import { createClient } from '@/lib/auth/client'

export type ProfileNotificationPreferences = {
  email_assignment_reminders: boolean
  email_submission_confirmations: boolean
  email_fallback_attention: boolean
  email_product_updates: boolean
}

export type ProfileSettingsData = {
  fullName: string
  email: string
  phoneE164: string | null
  department: string | null
  roleLabel: 'Student' | 'Lecturer'
  notificationPreferences: ProfileNotificationPreferences
}

function apiMessage(body: unknown, fallback: string) {
  return typeof body === 'object' && body !== null && 'error' in body
    && typeof body.error === 'object' && body.error !== null && 'message' in body.error && typeof body.error.message === 'string'
    ? body.error.message
    : fallback
}

export default function ProfileSettingsForm({ initialData }: { initialData: ProfileSettingsData }) {
  const supabase = createClient()
  const [fullName, setFullName] = useState(initialData.fullName)
  const [department, setDepartment] = useState(initialData.department ?? '')
  const [phoneE164, setPhoneE164] = useState(initialData.phoneE164 ?? '')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [preferences, setPreferences] = useState(initialData.notificationPreferences)
  const [preferencesBusy, setPreferencesBusy] = useState(false)
  const [preferencesMessage, setPreferencesMessage] = useState<string | null>(null)
  const [preferencesError, setPreferencesError] = useState<string | null>(null)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  async function saveProfile() {
    setProfileBusy(true)
    setProfileError(null)
    setProfileMessage(null)
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          department: department.trim() || null,
          phoneE164: phoneE164.trim() || null,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(apiMessage(body, `Profile update failed (${response.status}).`))
      setProfileMessage('Profile saved.')
    } catch (caught) {
      setProfileError(caught instanceof Error ? caught.message : 'Profile update failed.')
    } finally {
      setProfileBusy(false)
    }
  }

  async function savePreferences() {
    setPreferencesBusy(true)
    setPreferencesError(null)
    setPreferencesMessage(null)
    try {
      const response = await fetch('/api/profile/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailAssignmentReminders: preferences.email_assignment_reminders,
          emailSubmissionConfirmations: preferences.email_submission_confirmations,
          emailFallbackAttention: preferences.email_fallback_attention,
          emailProductUpdates: preferences.email_product_updates,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(apiMessage(body, `Preference update failed (${response.status}).`))
      setPreferencesMessage('Notification preferences saved.')
    } catch (caught) {
      setPreferencesError(caught instanceof Error ? caught.message : 'Preferences could not be saved.')
    } finally {
      setPreferencesBusy(false)
    }
  }

  async function updatePassword() {
    setPasswordBusy(true)
    setPasswordError(null)
    setPasswordMessage(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      setShowPasswordForm(false)
      setPasswordMessage('Password updated.')
    } catch (caught) {
      setPasswordError(caught instanceof Error ? caught.message : 'Password update failed.')
    } finally {
      setPasswordBusy(false)
    }
  }

  const fields: Array<{ key: keyof ProfileNotificationPreferences; label: string; description: string }> = [
    { key: 'email_assignment_reminders', label: 'Assignment reminders', description: 'One reminder when a published assignment is due within 24 hours.' },
    { key: 'email_submission_confirmations', label: 'Submission confirmations', description: 'Email when a commitment is recorded or an upload is finalized.' },
    { key: 'email_fallback_attention', label: 'Fallback attention', description: 'Email when fallback evidence needs review or is flagged.' },
    { key: 'email_product_updates', label: 'Product updates', description: 'Opt in to occasional product news. No campaign is currently scheduled.' },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header><p className="text-sm text-gray-500">Your account</p><h1 className="mt-1 text-3xl font-bold text-gray-900">Profile & settings</h1><p className="mt-2 text-sm text-gray-600">Update your profile, email preferences, and password.</p></header>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{initialData.roleLabel}</p><h2 className="mt-1 text-xl font-semibold text-gray-900">{initialData.email}</h2><p className="mt-1 text-sm text-gray-500">Your sign-in email is managed by Supabase Auth and cannot be changed here.</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{initialData.roleLabel}</span></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="profile-name" className="mb-1 block text-sm font-medium text-gray-700">Name</label><input id="profile-name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={200} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
          <div><label htmlFor="profile-department" className="mb-1 block text-sm font-medium text-gray-700">Department</label><input id="profile-department" value={department} onChange={(event) => setDepartment(event.target.value)} maxLength={120} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
          <div className="sm:col-span-2"><label htmlFor="profile-phone" className="mb-1 block text-sm font-medium text-gray-700">Phone number</label><input id="profile-phone" type="tel" value={phoneE164} onChange={(event) => setPhoneE164(event.target.value)} placeholder="+2348012345678" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /><p className="mt-1 text-xs text-gray-500">Use international E.164 format. This number is bound to fallback messages, but is not OTP-verified.</p></div>
        </div>
        {profileError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{profileError}</p>}
        {profileMessage && <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{profileMessage}</p>}
        <button type="button" onClick={() => void saveProfile()} disabled={profileBusy} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{profileBusy ? 'Saving…' : 'Save profile'}</button>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div><h2 className="text-lg font-semibold text-gray-900">Email notifications</h2><p className="mt-1 text-sm text-gray-500">These preferences control transactional email and the separate product updates opt-in.</p></div>
        <div className="mt-4 divide-y divide-gray-100">{fields.map((field) => <label key={field.key} className="flex items-start justify-between gap-4 py-4"><span><span className="block text-sm font-medium text-gray-800">{field.label}</span><span className="mt-1 block text-xs text-gray-500">{field.description}</span></span><input type="checkbox" checked={preferences[field.key]} onChange={(event) => setPreferences((current) => ({ ...current, [field.key]: event.target.checked }))} aria-label={field.label} className="mt-1 h-4 w-4" /></label>)}</div>
        {preferencesError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{preferencesError}</p>}
        {preferencesMessage && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{preferencesMessage}</p>}
        <button type="button" onClick={() => void savePreferences()} disabled={preferencesBusy} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{preferencesBusy ? 'Saving…' : 'Save notification preferences'}</button>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Password</h2><p className="mt-1 text-sm text-gray-500">Update the password used for your email sign-in.</p>
        {passwordError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{passwordError}</p>}
        {passwordMessage && <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{passwordMessage}</p>}
        {!showPasswordForm ? <button type="button" onClick={() => setShowPasswordForm(true)} className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">Change password</button> : <div className="mt-4 flex flex-wrap gap-2"><input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" className="min-w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm" /><button type="button" disabled={passwordBusy || newPassword.length < 8} onClick={() => void updatePassword()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{passwordBusy ? 'Updating…' : 'Update password'}</button><button type="button" onClick={() => { setShowPasswordForm(false); setNewPassword('') }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold">Cancel</button></div>}
      </section>

      <p className="rounded-lg bg-gray-50 p-4 text-xs text-gray-500">Institution SSO, profile photos, account deletion, and support chat are not available in this MVP.</p>
    </div>
  )
}
