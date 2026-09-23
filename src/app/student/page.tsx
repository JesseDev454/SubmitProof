import Link from "next/link";
import { createClient } from "@/lib/auth/server";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface AssignmentDueSoon {
  id: string;
  title: string;
  description: string | null;
  course_code: string;
  course_name: string;
  deadline_at: string;
  fallback_enabled: boolean;
  submissionStatus?: "VERIFIED_MATCH" | "SUBMITTED" | "FALLBACK_COMMITTED" | "AWAITING_FULL_UPLOAD" | "HASH_MISMATCH" | "GRACE_PERIOD_EXPIRED" | null;
}

interface RecentSubmission {
  id: string;
  created_at: string;
  status: string;
  assignment_title: string;
  course_code: string;
  details?: string;
}

interface StatCounts {
  upcoming: number;
  fallbackCommitted: number;
  verified: number;
  needsAttention: number;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDeadline(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      "\n" +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function getCourseInitials(courseCode: string): string {
  return courseCode.replace(/[0-9]/g, "").slice(0, 2).toUpperCase() || "??";
}

function getInitialsBgColor(initials: string): string {
  const colors: Record<string, string> = {
    CS: "bg-blue-100 text-blue-700",
    EN: "bg-purple-100 text-purple-700",
    MA: "bg-emerald-100 text-emerald-700",
    BI: "bg-rose-100 text-rose-700",
    PH: "bg-orange-100 text-orange-700",
    HI: "bg-amber-100 text-amber-700",
  };
  return colors[initials] ?? "bg-slate-100 text-slate-700";
}

function deriveAssignmentStatus(
  submissionStatus: AssignmentDueSoon["submissionStatus"],
): { label: string; className: string } {
  if (!submissionStatus) return { label: "Not Started", className: "text-slate-500" };
  switch (submissionStatus) {
    case "VERIFIED_MATCH":
    case "SUBMITTED":
      return { label: "Ready", className: "text-blue-600 font-semibold" };
    case "FALLBACK_COMMITTED":
    case "AWAITING_FULL_UPLOAD":
      return { label: "In Progress", className: "text-amber-600 font-semibold" };
    case "HASH_MISMATCH":
    case "GRACE_PERIOD_EXPIRED":
      return { label: "Needs Attention", className: "text-rose-600 font-semibold" };
    default:
      return { label: "In Progress", className: "text-amber-600 font-semibold" };
  }
}

function getSubmissionStatusPill(status: string): React.ReactNode {
  switch (status) {
    case "VERIFIED_MATCH":
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
          <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          Verified Match
        </span>
      );
    case "SUBMITTED":
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
          <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          Submitted
        </span>
      );
    case "FALLBACK_COMMITTED":
    case "AWAITING_FULL_UPLOAD":
      return (
        <span className="inline-flex items-center gap-1.5 text-blue-600 font-semibold text-xs">
          <span className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            </svg>
          </span>
          Fallback Committed
        </span>
      );
    case "HASH_MISMATCH":
    case "GRACE_PERIOD_EXPIRED":
      return (
        <span className="inline-flex items-center gap-1.5 text-rose-600 font-semibold text-xs">
          <span className="w-4 h-4 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-[10px]">!</span>
          Mismatch
        </span>
      );
    default:
      return (
        <span className="text-slate-500 text-xs font-medium">{status}</span>
      );
  }
}

function getSubmissionDetails(status: string): string {
  switch (status) {
    case "VERIFIED_MATCH": return "Matched and accepted";
    case "SUBMITTED": return "Received by server";
    case "FALLBACK_COMMITTED":
    case "AWAITING_FULL_UPLOAD": return "Will sync when online";
    case "HASH_MISMATCH": return "Needs your attention";
    case "GRACE_PERIOD_EXPIRED": return "Grace period ended";
    default: return "â€”";
  }
}

// â”€â”€â”€ Dashboard Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default async function StudentDashboardPage() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = getGreeting(hour);

  // â”€â”€ Fetch with graceful fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let firstName = "Taylor";
  let dueSoon: AssignmentDueSoon[] = [];
  let recentSubmissions: RecentSubmission[] = [];
  const statsMutable: StatCounts = { upcoming: 0, fallbackCommitted: 0, verified: 0, needsAttention: 0 };

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Resolve first name
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single();
          if (profile?.full_name) {
            firstName = profile.full_name.split(" ")[0];
          }
        } catch { /* table may not exist yet */ }

        // â”€â”€ Due Soon: assignments in the future for enrolled courses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        try {
          const { data: enrollments } = await supabase
            .from("enrollments")
            .select("course_id")
            .eq("student_id", user.id);

          const courseIds = (enrollments ?? []).map((e: { course_id: string }) => e.course_id);

          if (courseIds.length > 0) {
            const { data: assignments } = await supabase
              .from("assignments")
              .select(`
                id,
                title,
                description,
                deadline_at,
                fallback_enabled,
                courses (
                  code,
                  name
                )
              `)
              .in("course_id", courseIds)
              .gt("deadline_at", now.toISOString())
              .order("deadline_at", { ascending: true })
              .limit(3);

            if (assignments) {
              // Get student's submissions for these assignments
              const assignmentIds = assignments.map((a: { id: string }) => a.id);
              const { data: mySubmissions } = await supabase
                .from("submissions")
                .select("assignment_id, status")
                .eq("student_id", user.id)
                .in("assignment_id", assignmentIds);

              const submissionMap = new Map<string, string>();
              (mySubmissions ?? []).forEach((s: { assignment_id: string; status: string }) => {
                submissionMap.set(s.assignment_id, s.status);
              });

              dueSoon = assignments.map((a: {
                id: string;
                title: string;
                description: string | null;
                deadline_at: string;
                fallback_enabled: boolean;
                courses: { code: string; name: string } | { code: string; name: string }[];
              }) => {
                const course = Array.isArray(a.courses) ? a.courses[0] : a.courses;
                return {
                  id: a.id,
                  title: a.title,
                  description: a.description,
                  course_code: course?.code ?? "??",
                  course_name: course?.name ?? "Unknown Course",
                  deadline_at: a.deadline_at,
                  fallback_enabled: a.fallback_enabled ?? false,
                  submissionStatus: (submissionMap.get(a.id) as AssignmentDueSoon["submissionStatus"]) ?? null,
                };
              });
            }
          }
        } catch { /* table may not exist yet */ }

        // â”€â”€ Recent Submission Activity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        try {
          const { data: subs } = await supabase
            .from("submissions")
            .select(`
              id,
              created_at,
              status,
              assignments (
                title,
                courses (
                  code
                )
              )
            `)
            .eq("student_id", user.id)
            .order("created_at", { ascending: false })
            .limit(4);

          if (subs) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            recentSubmissions = (subs as any[]).map((s) => {
              const assignment = Array.isArray(s.assignments) ? s.assignments[0] : s.assignments;
              const coursesRaw = assignment?.courses;
              const course = Array.isArray(coursesRaw) ? coursesRaw[0] : coursesRaw;
              return {
                id: s.id as string,
                created_at: s.created_at as string,
                status: s.status as string,
                assignment_title: (assignment?.title ?? "Unknown Assignment") as string,
                course_code: (course?.code ?? "??") as string,
                details: getSubmissionDetails(s.status as string),
              };
            });
          }
        } catch { /* table may not exist yet */ }

        // â”€â”€ Stats (computed from submissions) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        try {
          const { data: allSubs } = await supabase
            .from("submissions")
            .select("status, assignment_id")
            .eq("student_id", user.id);

          if (allSubs) {
            statsMutable.fallbackCommitted = allSubs.filter((s: { status: string }) =>
              s.status === "FALLBACK_COMMITTED" || s.status === "AWAITING_FULL_UPLOAD"
            ).length;
            statsMutable.verified = allSubs.filter((s: { status: string }) =>
              s.status === "VERIFIED_MATCH"
            ).length;
            statsMutable.needsAttention = allSubs.filter((s: { status: string }) =>
              s.status === "HASH_MISMATCH" || s.status === "GRACE_PERIOD_EXPIRED"
            ).length;
          }

          // Upcoming: assignments in the future for enrolled courses with no submission
          const { data: enrollments2 } = await supabase
            .from("enrollments")
            .select("course_id")
            .eq("student_id", user.id);
          const courseIds2 = (enrollments2 ?? []).map((e: { course_id: string }) => e.course_id);

          if (courseIds2.length > 0) {
            const { count } = await supabase
              .from("assignments")
              .select("id", { count: "exact", head: true })
              .in("course_id", courseIds2)
              .gt("deadline_at", now.toISOString());

            const submittedIds = new Set((allSubs ?? []).map((s: { assignment_id: string }) => s.assignment_id));
            statsMutable.upcoming = Math.max(0, (count ?? 0) - submittedIds.size);
          }
        } catch { /* table may not exist yet */ }
      }
    } catch { /* Supabase not configured / no session */ }
  }

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="flex flex-col gap-6">
      {/* â”€â”€ Greeting Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm text-slate-500 font-medium mb-0.5">
            {greeting}, {firstName} ðŸ‘‹
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Student Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Submit with confidence. Even when you&apos;re offline.
          </p>
        </div>
        {/* Decorative Quote â€” static */}
        <div className="hidden xl:block text-right shrink-0 max-w-[220px]">
          <span className="text-sm italic text-slate-600 block leading-snug">
            &ldquo;Different connections. Same opportunities.&rdquo;
          </span>
          <span className="text-xs text-slate-400 block mt-1">â€” SubmitProof</span>
        </div>
      </div>

      {/* â”€â”€ 4 Stat Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Upcoming */}
        <Link
          href="/student/assignments"
          className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-extrabold text-slate-900">{statsMutable.upcoming}</div>
            <div className="text-xs font-semibold text-slate-700 leading-tight mt-0.5">Upcoming Assignments</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {statsMutable.upcoming === 0 ? "All caught up!" : `Next due in ${dueSoon[0] ? Math.ceil((new Date(dueSoon[0].deadline_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) + " days" : "soon"}`}
            </div>
          </div>
          <svg className="w-4 h-4 text-slate-300 ml-auto shrink-0 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Fallback Committed */}
        <Link
          href="/student/history"
          className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-emerald-100 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-100/70 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-extrabold text-slate-900">{statsMutable.fallbackCommitted}</div>
            <div className="text-xs font-semibold text-slate-700 leading-tight mt-0.5">Fallback Committed</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Saved offline, ready to sync</div>
          </div>
          <svg className="w-4 h-4 text-slate-300 ml-auto shrink-0 group-hover:text-emerald-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Verified */}
        <Link
          href="/student/receipts"
          className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-green-100 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-green-100/70 text-green-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-extrabold text-slate-900">{statsMutable.verified}</div>
            <div className="text-xs font-semibold text-slate-700 leading-tight mt-0.5">Verified</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Successfully matched</div>
          </div>
          <svg className="w-4 h-4 text-slate-300 ml-auto shrink-0 group-hover:text-green-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Needs Attention */}
        <Link
          href="/student/history"
          className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-amber-100 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-100/70 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-extrabold text-slate-900">{statsMutable.needsAttention}</div>
            <div className="text-xs font-semibold text-slate-700 leading-tight mt-0.5">Needs Attention</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Check for mismatches</div>
          </div>
          <svg className="w-4 h-4 text-slate-300 ml-auto shrink-0 group-hover:text-amber-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* â”€â”€ Main content grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left content: Due Soon + Recent Activity */}
        <div className="xl:col-span-8 flex flex-col gap-6">

          {/* â”€â”€ Due Soon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <h2 className="font-bold text-slate-900 text-base">Due Soon</h2>
              </div>
              <Link
                href="/student/assignments"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
              >
                View all assignments
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>

            {dueSoon.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <p className="font-semibold text-slate-700 text-sm">No upcoming assignments</p>
                <p className="text-xs text-slate-400 mt-1">You&apos;re all caught up! Check back later.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {dueSoon.map((assignment) => {
                  const initials = getCourseInitials(assignment.course_code);
                  const colorClass = getInitialsBgColor(initials);
                  const statusInfo = deriveAssignmentStatus(assignment.submissionStatus);

                  return (
                    <Link
                      key={assignment.id}
                      href={`/student/assignments/${assignment.id}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors group"
                    >
                      {/* Course badge */}
                      <div className={`w-10 h-10 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 ${colorClass}`}>
                        {initials}
                      </div>

                      {/* Assignment info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-slate-400 mb-0.5">
                          {assignment.course_code} â€” {assignment.course_name}
                        </div>
                        <div className="font-bold text-slate-900 text-sm truncate">
                          {assignment.title}
                        </div>
                        {assignment.description && (
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {assignment.description}
                          </div>
                        )}
                      </div>

                      {/* Due date */}
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                        </svg>
                        <span className="whitespace-nowrap">Due<br />{formatDeadline(assignment.deadline_at)}</span>
                      </div>

                      {/* Fallback pill */}
                      {assignment.fallback_enabled && (
                        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 whitespace-nowrap">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                          </svg>
                          Fallback Enabled
                        </span>
                      )}

                      {/* Status */}
                      <span className={`hidden sm:block text-xs shrink-0 ${statusInfo.className}`}>
                        â€¢ {statusInfo.label}
                      </span>

                      <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* â”€â”€ Recent Submission Activity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h2 className="font-bold text-slate-900 text-base">Recent Submission Activity</h2>
              </div>
              <Link
                href="/student/history"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
              >
                View all activity
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>

            {recentSubmissions.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <p className="font-semibold text-slate-700 text-sm">No submissions yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Your submission history will appear here once you&apos;ve submitted your first assignment.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Date &amp; Time</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500">Course</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500">Assignment</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500">Status</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 hidden sm:table-cell">Details</th>
                      <th className="px-3 py-3 w-6" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentSubmissions.map((sub) => {
                      const dt = formatDateTime(sub.created_at).split("\n");
                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <div className="text-xs text-slate-700 font-medium">{dt[0]}</div>
                            <div className="text-[11px] text-slate-400">{dt[1]}</div>
                          </td>
                          <td className="px-3 py-3.5">
                            <span className="text-xs font-semibold text-slate-700">{sub.course_code}</span>
                          </td>
                          <td className="px-3 py-3.5 max-w-[160px]">
                            <span className="text-xs text-slate-700 line-clamp-2">{sub.assignment_title}</span>
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            {getSubmissionStatusPill(sub.status)}
                          </td>
                          <td className="px-3 py-3.5 hidden sm:table-cell">
                            <span className="text-xs text-slate-500">{sub.details}</span>
                          </td>
                          <td className="px-3 py-3.5">
                            <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right column: Connectivity Tips + How Fallback Works */}
        <div className="xl:col-span-4 flex flex-col gap-4">

          {/* Connectivity Tips */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Connectivity Tips</h3>
                <p className="text-[11px] text-slate-500">Stay on track, anywhere</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Simple ways to make the most of SubmitProof during low connectivity.
            </p>
            <ol className="flex flex-col gap-3">
              {[
                { n: 1, title: "Enable fallback before going offline", desc: "Turn it on for each assignment." },
                { n: 2, title: "Keep your files small", desc: "PDFs work best in low bandwidth." },
                { n: 3, title: "Wait for verification", desc: "We'll match your submission when you're back online." },
                { n: 4, title: "Check your receipts", desc: "You'll get a confirmation for every fallback submission." },
              ].map(({ n, title, desc }) => (
                <li key={n} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {n}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">{title}</span>
                    <span className="text-[11px] text-slate-500">{desc}</span>
                  </div>
                </li>
              ))}
            </ol>
            <Link
              href="/student/assignments"
              className="mt-4 w-full flex items-center justify-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl py-2.5 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
              Learn more tips â†’
            </Link>
          </section>

          {/* How Fallback Works */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">How fallback works</h3>
                <p className="text-[11px] text-slate-500">Your work is safe, even without internet.</p>
              </div>
            </div>
            <ol className="flex flex-col gap-3">
              {[
                { n: 1, title: "Submit offline", desc: "Your assignment is securely stored on your device." },
                { n: 2, title: "Get a receipt", desc: "You'll see a fallback confirmation right away." },
                { n: 3, title: "Auto-sync later", desc: "When you're back online, we securely upload it." },
                { n: 4, title: "We verify the match", desc: "Your file is checked and matched with the assignment." },
              ].map(({ n, title, desc }) => (
                <li key={n} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {n}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">{title}</span>
                    <span className="text-[11px] text-slate-500">{desc}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
