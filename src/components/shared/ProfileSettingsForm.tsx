'use client'

import { useState } from 'react'
import { createClient } from '@/lib/auth/client'

export interface ProfileSettingsFormProps {
  userId: string
  initialData: {
    fullName: string
    email: string
    phone: string | null
    roleLabel: string
    contextLabel: string
    displayId: string | null
    schoolAccountName: string | null
    schoolAccountConnected: boolean
  }
}

type NotificationKey = 'assignments' | 'confirmations' | 'fallback' | 'updates'

export default function ProfileSettingsForm({
  userId,
  initialData,
}: ProfileSettingsFormProps) {
  const supabase = createClient()

  // ── State ─────────────────────────────────────────────────────────────────

  const [phone, setPhone] = useState(initialData.phone ?? '')
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneSavedMsg, setPhoneSavedMsg] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const [notifications, setNotifications] = useState<Record<NotificationKey, boolean>>({
    assignments: true,
    confirmations: true,
    fallback: true,
    updates: false,
  })

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordUpdating, setPasswordUpdating] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function savePhone() {
    setPhoneSaving(true)
    setPhoneError(null)
    setPhoneSavedMsg(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone })
        .eq('id', userId)

      if (error) throw error

      setPhoneSavedMsg('Phone number saved successfully.')
      setTimeout(() => setPhoneSavedMsg(null), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save phone number.'
      setPhoneError(msg)
      console.error('Phone save error:', err)
    } finally {
      setPhoneSaving(false)
    }
  }

  async function updatePassword() {
    if (!newPassword.trim()) {
      setPasswordError('Password cannot be empty.')
      return
    }

    setPasswordUpdating(true)
    setPasswordError(null)
    setPasswordSuccess(null)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      setPasswordSuccess('Password updated successfully.')
      setNewPassword('')
      setShowPasswordForm(false)
      setTimeout(() => setPasswordSuccess(null), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update password.'
      setPasswordError(msg)
      console.error('Password update error:', err)
    } finally {
      setPasswordUpdating(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Profile section header */}
      <div>
        <p className="text-sm text-gray-500">Your Account</p>
        <h1 className="text-3xl font-bold text-gray-900">Profile & Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your account, preferences, and security settings.
        </p>
      </div>

      {/* Profile card with avatar */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex gap-6">
          {/* Avatar */}
          <div className="relative">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-400 to-blue-600 text-2xl font-bold text-white">
              {initialData.fullName
                .split(' ')
                .slice(0, 2)
                .map(n => n[0])
                .join('')
                .toUpperCase() || '?'}
            </div>
            <button
              disabled
              title="Photo upload not yet implemented"
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 shadow-sm hover:bg-gray-50 disabled:opacity-50 cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-2xl font-bold text-gray-900">{initialData.fullName}</p>
              <p className="text-sm text-gray-600">{initialData.email}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {initialData.roleLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                {initialData.contextLabel}
              </span>
              {initialData.displayId && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  {initialData.roleLabel === 'Lecturer' ? 'ID:' : 'Student ID:'} {initialData.displayId}
                </span>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-600">{initialData.email}</span>
                <span className="text-xs text-gray-400">Primary email address</span>
              </div>
            </div>

            {initialData.phone && (
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="text-sm text-gray-600">{initialData.phone}</span>
                <span className="text-xs text-gray-400">Used for fallback notifications</span>
              </div>
            )}
          </div>

          <button
            disabled
            title="Edit profile not yet implemented"
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-not-allowed transition-colors"
          >
            Edit Profile
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Phone number */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700">Phone Number</p>
              <p className="text-xs text-gray-500">Used for fallback submission notifications</p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  onClick={savePhone}
                  disabled={phoneSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {phoneSaving ? 'Saving…' : 'Save'}
                </button>
              </div>

              {phoneSavedMsg && (
                <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-2.5">
                  <svg className="h-4 w-4 mt-0.5 shrink-0 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                  <p className="text-xs text-green-700">{phoneSavedMsg}</p>
                </div>
              )}

              {phoneError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
                  <svg className="h-4 w-4 mt-0.5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs text-red-700">{phoneError}</p>
                </div>
              )}
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-sm font-semibold text-gray-700">Notification Preferences</p>
            </div>
            <p className="mb-4 text-xs text-gray-500">Choose how you want to be notified about your submissions and account.</p>

            {/* TODO: Notification preferences — local state only for now. Once Goodluck adds a
                jsonb preferences column to the profiles table, wire this up to persist. */}

            <div className="space-y-3">
              {[
                { key: 'assignments' as NotificationKey, label: 'Assignment reminders', description: 'Get notified about upcoming deadlines' },
                { key: 'confirmations' as NotificationKey, label: 'Submission confirmations', description: 'Receive a confirmation after each submission' },
                { key: 'fallback' as NotificationKey, label: 'Fallback notifications', description: 'Get notified if a submission needs attention' },
                { key: 'updates' as NotificationKey, label: 'Product updates', description: 'Occasional news and feature updates' },
              ].map(pref => (
                <div key={pref.key} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{pref.label}</p>
                    <p className="text-xs text-gray-500">{pref.description}</p>
                  </div>
                  <button
                    onClick={() => setNotifications(prev => ({ ...prev, [pref.key]: !prev[pref.key] }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      notifications[pref.key] ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        notifications[pref.key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* School Account */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5.5m0 0H9m11 0v-3.5a6.5 6.5 0 10-13 0V21" />
              </svg>
              <p className="text-sm font-semibold text-gray-700">School Account</p>
            </div>
            <p className="mb-4 text-xs text-gray-500">Your school account lets you access your courses and submit assignments.</p>

            {initialData.schoolAccountName ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{initialData.schoolAccountName}</p>
                    <p className="text-xs text-gray-600">{initialData.email}</p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold gap-1 ${
                      initialData.schoolAccountConnected
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className={`h-2 w-2 rounded-full ${initialData.schoolAccountConnected ? 'bg-green-600' : 'bg-gray-400'}`} />
                    {initialData.schoolAccountConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>

                <div className="text-xs text-gray-500">
                  Last synced: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>

                {initialData.schoolAccountConnected && (
                  <button
                    disabled
                    title="Disconnect functionality not yet implemented"
                    className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50 cursor-not-allowed"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">No school account linked.</p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Security Settings */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-sm font-semibold text-gray-700">Security Settings</p>
            </div>
            <p className="mb-4 text-xs text-gray-500">Keep your account secure and in your control.</p>

            <div className="space-y-3">
              {/* Password */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Password</p>
                    <p className="text-xs text-gray-600">Change your password regularly</p>
                  </div>
                  <button
                    onClick={() => setShowPasswordForm(!showPasswordForm)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    Update Password
                  </button>
                </div>

                {showPasswordForm && (
                  <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={updatePassword}
                        disabled={passwordUpdating || !newPassword.trim()}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                      >
                        {passwordUpdating ? 'Updating…' : 'Update'}
                      </button>
                      <button
                        onClick={() => {
                          setShowPasswordForm(false)
                          setNewPassword('')
                          setPasswordError(null)
                        }}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>

                    {passwordError && (
                      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
                        <svg className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-xs text-red-700">{passwordError}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Two-factor authentication */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Two-factor authentication</p>
                    <p className="text-xs text-gray-600">Add an extra layer of security</p>
                  </div>
                  <span className="text-xs font-medium text-gray-500">Not enabled</span>
                </div>
              </div>

              {/* Active sessions */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <a href="#" className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Active sessions</p>
                    <p className="text-xs text-gray-600">Manage your logged-in devices</p>
                  </div>
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>

              {/* Account activity */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <a href="#" className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Account activity</p>
                    <p className="text-xs text-gray-600">View recent sign-ins and security events</p>
                  </div>
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Privacy & Data */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-sm font-semibold text-gray-700">Privacy & Data</p>
            </div>
            <p className="mb-4 text-xs text-gray-500">Control how your data is used.</p>

            <div className="space-y-3">
              {[
                { label: 'Profile visibility', description: 'Control who can see your profile information' },
                { label: 'Data & privacy', description: 'Learn how we protect your data' },
                { label: 'Delete account', description: 'Permanently delete your account and data' },
              ].map(item => (
                <a
                  key={item.label}
                  href="#"
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4 hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                    <p className="text-xs text-gray-600">{item.description}</p>
                  </div>
                  <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Need Help */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 mt-0.5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-blue-900">Need Help?</p>
              <p className="text-xs text-blue-800">If you have any questions or need assistance, our team is here to help.</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <a
              href="#"
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Contact Support
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Visit Help Center
            </a>
          </div>
        </div>
      </div>

      {/* Closing quote */}
      <div className="text-center space-y-2 pt-4">
        <p className="text-sm text-gray-600 italic">
          &quot;A more organized you,
          <br />
          a brighter tomorrow.&quot;
        </p>
        <p className="text-xs font-semibold text-gray-700">— SubmitProof</p>
      </div>
    </div>
  )
}

{/* TODO: Once student screens merge, create src/app/student/profile/page.tsx following this same
    server-fetch-then-render pattern, with roleLabel='Student' and contextLabel=course. */}
