"use client";

import { useState, type FormEvent } from "react";

import { createClient } from "@/lib/auth/client";
import { profileSettingsSchema } from "@/lib/validation/profile";

type Props = {
  userId: string
  email: string
  fullName: string
  department: string | null
  phoneE164: string | null
}

export function ProfileForm({ userId, email, fullName, department, phoneE164 }: Props) {
  const [name, setName] = useState(fullName);
  const [departmentValue, setDepartmentValue] = useState(department ?? "");
  const [phone, setPhone] = useState(phoneE164 ?? "");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileMessage(null);
    setProfileError(null);
    const parsed = profileSettingsSchema.safeParse({
      fullName: name,
      department: departmentValue.trim() || null,
      phoneE164: phone.trim() || null,
    });
    if (!parsed.success) {
      setProfileError(parsed.error.issues[0]?.message ?? "Review your profile details.");
      return;
    }

    setSavingProfile(true);
    const { error } = await createClient().from("profiles").update({
      full_name: parsed.data.fullName,
      department: parsed.data.department,
      phone_e164: parsed.data.phoneE164,
    }).eq("id", userId);
    setSavingProfile(false);
    if (error) setProfileError(error.message);
    else setProfileMessage("Profile saved.");
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("Use at least 8 characters for your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The password confirmation does not match.");
      return;
    }

    setSavingPassword(true);
    const { error } = await createClient().auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) setPasswordError(error.message);
    else {
      setPasswordMessage("Password changed.");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return <div className="flex flex-col gap-6">
    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Profile details</h2>
      <form onSubmit={saveProfile} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Full name
          <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
        </label>
        <label className="text-sm font-semibold text-slate-700">Email
          <input value={email} readOnly disabled className="mt-1.5 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-500" />
        </label>
        <label className="text-sm font-semibold text-slate-700">Department
          <input value={departmentValue} onChange={(event) => setDepartmentValue(event.target.value)} maxLength={120} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
        </label>
        <label className="text-sm font-semibold text-slate-700">Registered phone (E.164)
          <input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" placeholder="+2348012345678" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
          <span className="mt-1 block text-xs font-normal text-slate-500">Used to bind fallback messages to your account. The number is not OTP-verified.</span>
        </label>
        {profileError && <p role="alert" className="sm:col-span-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{profileError}</p>}
        {profileMessage && <p role="status" className="sm:col-span-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{profileMessage}</p>}
        <div className="sm:col-span-2"><button type="submit" disabled={savingProfile} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{savingProfile ? "Saving…" : "Save profile"}</button></div>
      </form>
    </section>

    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Change password</h2>
      <form onSubmit={changePassword} className="mt-5 grid gap-4 sm:max-w-lg">
        <label className="text-sm font-semibold text-slate-700">New password
          <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" autoComplete="new-password" minLength={8} required className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
        </label>
        <label className="text-sm font-semibold text-slate-700">Confirm new password
          <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" minLength={8} required className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
        </label>
        {passwordError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{passwordError}</p>}
        {passwordMessage && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{passwordMessage}</p>}
        <button type="submit" disabled={savingPassword} className="w-fit rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{savingPassword ? "Updating…" : "Update password"}</button>
      </form>
    </section>
  </div>
}
