import { notFound } from "next/navigation";

import { ProfileForm } from "./ProfileForm";
import { loadStudentProfile } from "@/lib/student/data";

export default async function ProfilePage() {
  const profile = await loadStudentProfile();
  if (!profile) notFound();

  return <div className="mx-auto flex max-w-4xl flex-col gap-6">
    <header>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Profile</h1>
      <p className="mt-2 text-sm text-slate-500">Manage the account details used for your SubmitProof records.</p>
    </header>
    <ProfileForm
      userId={profile.id}
      email={profile.email ?? ""}
      fullName={profile.full_name}
      department={profile.department}
      phoneE164={profile.phone_e164}
    />
  </div>
}
