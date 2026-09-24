import Link from "next/link";
import { createClient } from "@/lib/auth/server";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AssignmentListRow {
  id: string;
  title: string;
  description: string | null;
  course_code: string;
  course_name: string;
  deadline_at: string;
  fallback_enabled: boolean;
  submissionStatus?: "VERIFIED_MATCH" | "SUBMITTED" | "FALLBACK_COMMITTED" | "AWAITING_FULL_UPLOAD" | "HASH_MISMATCH" | "GRACE_PERIOD_EXPIRED" | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  submissionStatus: AssignmentListRow["submissionStatus"],
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AssignmentsPage() {
  const now = new Date();
  
  let allAssignments: AssignmentListRow[] = [];

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
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
              .order("deadline_at", { ascending: true });

            if (assignments) {
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

              allAssignments = assignments.map((a: {
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
                  submissionStatus: (submissionMap.get(a.id) as AssignmentListRow["submissionStatus"]) ?? null,
                };
              });
            }
          }
        } catch { /* table may not exist yet */ }
      }
    } catch { /* Supabase not configured / no session */ }
  }

  // ── Dev-mode placeholder when Supabase not configured or no tables ───────
  if (allAssignments.length === 0) {
    allAssignments = [
      {
        id: "mock-1",
        title: "Programming Assignment 3",
        description: "Implement sorting algorithms and compare their performance.",
        course_code: "CS101",
        course_name: "Introduction to Computer Science",
        deadline_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
        fallback_enabled: true,
        submissionStatus: null,
      },
      {
        id: "mock-2",
        title: "Midterm Essay on Modernism",
        description: "A 2000-word essay on the impacts of Modernist literature.",
        course_code: "EN204",
        course_name: "Modern English Literature",
        deadline_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        fallback_enabled: false,
        submissionStatus: null,
      },
      {
        id: "mock-3",
        title: "Database Normalization Worksheet",
        description: "Normalize the provided schemas up to 3NF.",
        course_code: "CS302",
        course_name: "Database Systems",
        deadline_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Past due
        fallback_enabled: true,
        submissionStatus: "SUBMITTED",
      }
    ];
  }

  const upcomingAssignments = allAssignments.filter(a => new Date(a.deadline_at) > now);
  const pastAssignments = allAssignments.filter(a => new Date(a.deadline_at) <= now);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Assignments
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage and submit your coursework.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {/* Upcoming Section */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Upcoming Assignments
              <span className="ml-2 py-0.5 px-2 bg-slate-200 text-slate-700 rounded-full text-xs font-semibold">
                {upcomingAssignments.length}
              </span>
            </h2>
          </div>
          
          {upcomingAssignments.length === 0 ? (
             <div className="px-6 py-12 text-center">
               <p className="font-semibold text-slate-700 text-sm">No upcoming assignments</p>
               <p className="text-xs text-slate-400 mt-1">You&apos;re all caught up!</p>
             </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {upcomingAssignments.map((assignment) => (
                <AssignmentRow key={assignment.id} assignment={assignment} />
              ))}
            </div>
          )}
        </section>

        {/* Past Section */}
        {pastAssignments.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden opacity-80">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-bold text-slate-600 text-base flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Past Assignments
                <span className="ml-2 py-0.5 px-2 bg-slate-200 text-slate-600 rounded-full text-xs font-semibold">
                  {pastAssignments.length}
                </span>
              </h2>
            </div>
            
            <div className="divide-y divide-slate-50">
              {pastAssignments.map((assignment) => (
                <AssignmentRow key={assignment.id} assignment={assignment} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function AssignmentRow({ assignment }: { assignment: AssignmentListRow }) {
  const initials = getCourseInitials(assignment.course_code);
  const colorClass = getInitialsBgColor(initials);
  const statusInfo = deriveAssignmentStatus(assignment.submissionStatus);

  return (
    <Link
      href={`/student/assignments/${assignment.id}`}
      className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors group"
    >
      {/* Course badge */}
      <div className={`w-12 h-12 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 ${colorClass}`}>
        {initials}
      </div>

      {/* Assignment info */}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 mb-0.5">
          {assignment.course_code} — {assignment.course_name}
        </div>
        <div className="font-bold text-slate-900 text-base truncate mb-0.5">
          {assignment.title}
        </div>
        {assignment.description && (
          <div className="text-xs text-slate-500 truncate">
            {assignment.description}
          </div>
        )}
      </div>

      {/* Badges and Dates */}
      <div className="flex flex-col items-end gap-1.5 shrink-0 ml-4">
        <div className="flex items-center gap-2">
          {assignment.fallback_enabled && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider shrink-0 whitespace-nowrap">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
              </svg>
              Fallback Enabled
            </span>
          )}
          <span className={`text-[11px] uppercase tracking-wider shrink-0 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100 ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
          </svg>
          <span className="whitespace-nowrap font-medium text-slate-600">
            Due {formatDeadline(assignment.deadline_at)}
          </span>
        </div>
      </div>

      <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
