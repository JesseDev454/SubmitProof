import { redirect } from "next/navigation";

import { StudentHeader } from "@/components/student/StudentHeader";
import { StudentSidebar } from "@/components/student/StudentSidebar";
import { createClient } from "@/lib/auth/server";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, department, role")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !profile) redirect("/login");
  if (profile.role === "lecturer") redirect("/lecturer");

  return <div className="min-h-screen bg-[#F8FAFD] md:pl-64">
    <StudentSidebar />
    <div className="flex min-h-screen min-w-0 flex-col">
      <StudentHeader displayName={profile.full_name || user.email || "Student"} subtitle={profile.department || "Student"} />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  </div>
}
