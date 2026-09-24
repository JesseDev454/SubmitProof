import Link from "next/link";
import { createClient } from "@/lib/auth/server";
import { SubmissionChecklist } from "@/components/student/SubmissionChecklist";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  deadline_at: string;
  fallback_enabled: boolean;
  grace_period_minutes: number;
  allowed_file_types: string[];
  max_file_size_bytes: number;
  course_id: string;
  created_by: string | null;
  course_code: string;
  course_name: string;
  lecturer_name: string | null;
}

interface Submission {
  id: string;
  status: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDeadline(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    return `${date}\n${time} (Your local time)`;
  } catch {
    return iso;
  }
}

function formatDeadlineButton(iso: string): string {
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      ", " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return iso;
  }
}

function formatFileSizeMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${Math.round(mb)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function formatGracePeriod(minutes: number): string {
  if (!minutes || minutes <= 0) return "No grace period";
  const days = Math.round(minutes / (60 * 24));
  if (days === 1) return "1 day after deadline";
  if (days > 1) return `${days} days after deadline`;
  const hours = Math.round(minutes / 60);
  return hours <= 1 ? "1 hour after deadline" : `${hours} hours after deadline`;
}

function formatGracePeriodShort(minutes: number): string {
  if (!minutes || minutes <= 0) return "no grace period";
  const days = Math.round(minutes / (60 * 24));
  if (days === 1) return "1 day";
  if (days > 1) return `${days} days`;
  const hours = Math.round(minutes / 60);
  return hours <= 1 ? "1 hour" : `${hours} hours`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AssignmentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let assignment: Assignment | null = null;
  let existingSubmission: Submission | null = null;
  let notFound = false;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        notFound = true;
      } else {
        // ── Fetch the assignment + course + lecturer ───────────────────────
        try {
          const { data: raw } = await supabase
            .from("assignments")
            .select(
              `
              id,
              title,
              description,
              deadline_at,
              fallback_enabled,
              grace_period_minutes,
              allowed_file_types,
              max_file_size_bytes,
              course_id,
              created_by,
              courses (
                code,
                name
              ),
              profiles!assignments_created_by_fkey (
                full_name
              )
            `
            )
            .eq("id", id)
            .maybeSingle();

          if (!raw) {
            notFound = true;
          } else {
            // Verify student is enrolled in this course
            try {
              const { data: enrollment } = await supabase
                .from("enrollments")
                .select("id")
                .eq("student_id", user.id)
                .eq("course_id", raw.course_id)
                .maybeSingle();

              if (!enrollment) {
                notFound = true;
              }
            } catch {
              // If enrollments table doesn't exist yet, allow access in dev
            }

            if (!notFound) {
              const courseRaw = Array.isArray(raw.courses) ? raw.courses[0] : raw.courses;
              const profileRaw = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles;

              assignment = {
                id: raw.id,
                title: raw.title,
                description: raw.description ?? null,
                deadline_at: raw.deadline_at,
                fallback_enabled: raw.fallback_enabled ?? false,
                grace_period_minutes: raw.grace_period_minutes ?? 0,
                allowed_file_types: raw.allowed_file_types ?? [],
                max_file_size_bytes: raw.max_file_size_bytes ?? 50 * 1024 * 1024,
                course_id: raw.course_id,
                created_by: raw.created_by ?? null,
                course_code: courseRaw?.code ?? "COURSE",
                course_name: courseRaw?.name ?? "Unknown Course",
                lecturer_name: profileRaw?.full_name ?? null,
              };

              // Fetch existing submission for this student + assignment
              try {
                const { data: sub } = await supabase
                  .from("submissions")
                  .select("id, status")
                  .eq("assignment_id", id)
                  .eq("student_id", user.id)
                  .maybeSingle();
                existingSubmission = sub ?? null;
              } catch {
                // submissions table may not exist yet
              }
            }
          }
        } catch {
          // assignment table may not exist yet — show dev preview state
        }
      }
    } catch {
      // Supabase not configured
    }
  }

  // ── Dev-mode placeholder when Supabase not configured ──────────────────────
  if (!assignment && !notFound) {
    assignment = {
      id,
      title: "Programming Assignment 3",
      description:
        "In this assignment, you will implement and evaluate common sorting algorithms.\n\nWrite a report comparing the performance of at least three sorting algorithms (e.g. Bubble Sort, Merge Sort, Quick Sort). Include time complexity analysis, experimental results, and a discussion of your findings.",
      deadline_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      fallback_enabled: true,
      grace_period_minutes: 7 * 24 * 60,
      allowed_file_types: [".pdf", ".docx", ".zip", ".py"],
      max_file_size_bytes: 50 * 1024 * 1024,
      course_id: "course-1",
      created_by: null,
      course_code: "CS101",
      course_name: "Introduction to Computer Science",
      lecturer_name: "Dr. Amanda Chen",
    };
  }

  // ── Not Found State ─────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900">Assignment not found</h1>
        <p className="text-sm text-slate-500 max-w-xs">
          This assignment doesn&apos;t exist, or you&apos;re not enrolled in its course.
        </p>
        <Link
          href="/student/assignments"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Assignments
        </Link>
      </div>
    );
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const deadlineLines = formatDeadline(assignment!.deadline_at).split("\n");
  const deadlineForButton = formatDeadlineButton(assignment!.deadline_at);
  const gracePeriodLabel = formatGracePeriod(assignment!.grace_period_minutes);
  const gracePeriodShort = formatGracePeriodShort(assignment!.grace_period_minutes);
  const fileTypesLabel =
    assignment!.allowed_file_types.length > 0
      ? assignment!.allowed_file_types.join(", ")
      : "Any format";
  const fileSizeLabel = formatFileSizeMb(assignment!.max_file_size_bytes);

  // Parse description paragraphs
  const descriptionParagraphs = (assignment!.description ?? "No instructions provided.")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Back Link ──────────────────────────────────────────────────────── */}
      <Link
        href="/student/assignments"
        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline w-fit"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Assignments
      </Link>

      {/* ── Title Section ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
            {assignment!.course_code} — {assignment!.course_name.toUpperCase()}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight mb-2">
            {assignment!.title}
          </h1>
          {descriptionParagraphs[0] && (
            <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
              {descriptionParagraphs[0]}
            </p>
          )}
        </div>

        {/* Fallback badge */}
        {assignment!.fallback_enabled ? (
          <div className="shrink-0 flex items-center gap-3 bg-emerald-50 border border-emerald-200/80 rounded-2xl px-4 py-3 shadow-sm self-start">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-emerald-800 text-sm">Fallback Enabled</div>
              <div className="text-xs text-emerald-600">Submit with confidence.</div>
            </div>
          </div>
        ) : (
          <div className="shrink-0 flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 shadow-sm self-start">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-slate-600 text-sm">Fallback Disabled</div>
              <div className="text-xs text-slate-400">Standard submission only.</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Info Bar ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100">
          {/* Lecturer */}
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] text-slate-400 mb-0.5 font-medium">Lecturer</div>
              <div className="text-sm font-bold text-slate-900 leading-snug">
                {assignment!.lecturer_name ?? "—"}
              </div>
            </div>
          </div>

          {/* Deadline */}
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] text-slate-400 mb-0.5 font-medium">Deadline</div>
              <div className="text-sm font-bold text-slate-900 leading-snug">{deadlineLines[0]}</div>
              {deadlineLines[1] && (
                <div className="text-[11px] text-slate-500 mt-0.5">{deadlineLines[1]}</div>
              )}
            </div>
          </div>

          {/* Allowed Files */}
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] text-slate-400 mb-0.5 font-medium">Allowed Files</div>
              <div className="text-sm font-bold text-slate-900 leading-snug">{fileTypesLabel}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Max file size: {fileSizeLabel}</div>
            </div>
          </div>

          {/* Grace Period */}
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] text-slate-400 mb-0.5 font-medium">Grace Period</div>
              <div className="text-sm font-bold text-slate-900 leading-snug">{gracePeriodLabel}</div>
              {assignment!.fallback_enabled && (
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Available with a verified fallback commitment.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* ── Left Column ──────────────────────────────────────────────────── */}
        <div className="xl:col-span-8 flex flex-col gap-5">
          {/* Assignment Instructions */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h2 className="font-bold text-slate-900 text-base">Assignment Instructions</h2>
            </div>

            <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed">
              {descriptionParagraphs.map((para, idx) => (
                <p key={idx} className={idx > 0 ? "mt-3" : ""}>
                  {para}
                </p>
              ))}
            </div>

            {/*
              TODO: Goodluck may need to add a structured "requirements" field
              (e.g. a JSON array of strings) to the assignments table if "Your report
              should include:" bullet lists are needed for the demo. For now this
              sub-section is intentionally omitted — description is free text only.
            */}
          </section>

          {/* Submission Checklist (client component for interactivity) */}
          <SubmissionChecklist
            assignmentId={id}
            allowedFileTypes={assignment!.allowed_file_types}
            maxFileSizeBytes={assignment!.max_file_size_bytes}
            deadlineFormatted={deadlineForButton}
            hasExistingSubmission={!!existingSubmission}
          />
        </div>

        {/* ── Right Column ─────────────────────────────────────────────────── */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          {/* How Fallback Works */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-blue-700 text-sm leading-tight">
                  How Fallback Works for This Assignment
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Life happens. We&apos;ve got you covered.</p>
              </div>
            </div>

            <ol className="flex flex-col gap-3.5 mt-4">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <span className="text-sm font-bold text-slate-900 block">Commit before the deadline</span>
                  <span className="text-xs text-slate-500 leading-snug">
                    Click &ldquo;Start Submission&rdquo; and verify your intent to submit. This creates a timestamped record.
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <span className="text-sm font-bold text-slate-900 block">Upload after the deadline</span>
                  <span className="text-xs text-slate-500 leading-snug">
                    If needed, you can still upload your file within {gracePeriodShort} after the deadline.
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <span className="text-sm font-bold text-slate-900 block">We&apos;ll match your file</span>
                  <span className="text-xs text-slate-500 leading-snug">
                    Your submission will be accepted if it matches your pre-deadline commitment (same course, assignment, and file type).
                  </span>
                </div>
              </li>
            </ol>

            {/* TODO: No help-center route exists yet — replace # once /help/fallback is created */}
            <Link
              href="#"
              className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Learn more about fallback
            </Link>
          </section>

          {/*
            Course Resources card:
            TODO: Goodluck needs to add a `resources` field to the assignments table
            (e.g. a JSON array of { name: string; url: string; type: "pdf"|"link"|... })
            if this feature is needed for the demo. Currently omitted since the PRD's
            assignments schema doesn't include it.
          */}

          {/* Submission Tips */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Submission Tips</h3>
            </div>

            <ul className="flex flex-col gap-2.5">
              {[
                "Double-check that your file opens correctly.",
                "Include your name and student ID in the report.",
                `Compress large files if needed (max ${fileSizeLabel}).`,
                `Need help? Contact ${assignment!.lecturer_name ? assignment!.lecturer_name.replace(/^Dr\.?\s+/, "") : "your lecturer"} or visit the course forum.`,
              ].map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-xs text-slate-600 leading-snug">{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
