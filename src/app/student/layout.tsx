import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/server";
import { StudentSidebar } from "@/components/student/StudentSidebar";
import { StudentHeader } from "@/components/student/StudentHeader";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let shouldRedirect = false;
  let displayName = "Student";
  let department = "Computer Science";

  // Use the Supabase server client (@/lib/auth/server) to get current session
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        shouldRedirect = true;
      } else {
        displayName = user.email || "Student";

        // Fetch the user's profile row (full_name) to pass into StudentHeader.
        // If the profiles table/row doesn't exist yet or query fails, fall back to email.
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, department")
            .eq("id", user.id)
            .single();

          if (profile?.full_name) {
            displayName = profile.full_name;
          }
          if (profile?.department) {
            department = profile.department;
          }
        } catch {
          // If query fails, silently keep auth email fallback
        }
      }
    } catch (err) {
      console.warn("Could not retrieve session in StudentLayout:", err);
      shouldRedirect = true;
    }
  } else {
    // When Supabase environment variables are not configured in local development,
    // provide sensible default student name so step 3 verification can be previewed without crashing.
    displayName = "Taylor Kim";
    department = "Computer Science";
  }

  if (shouldRedirect) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#F8FAFD] flex flex-col md:pl-64">
      {/* Left Sidebar */}
      <StudentSidebar />

      {/* Main shell with header + scrollable content */}
      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader displayName={displayName} subtitle={department} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
