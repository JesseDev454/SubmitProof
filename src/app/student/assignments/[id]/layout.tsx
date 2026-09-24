import React from "react";
import Link from "next/link";
import { createClient } from "@/lib/auth/server";
import { SubmissionFlowProvider, AssignmentContextData } from "@/features/submissions/SubmissionFlowContext";

export default async function AssignmentFlowLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  let assignment: AssignmentContextData | null = null;
  let notFound = false;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        notFound = true;
      } else {
        const { data: raw } = await supabase
          .from("assignments")
          .select(`
            id,
            title,
            description,
            deadline_at,
            fallback_enabled,
            grace_period_minutes,
            allowed_file_types,
            max_file_size_bytes,
            courses (
              code,
              name
            )
          `)
          .eq("id", id)
          .maybeSingle();

        if (!raw) {
          notFound = true;
        } else {
          const courseRaw = Array.isArray(raw.courses) ? raw.courses[0] : raw.courses;
          assignment = {
            id: raw.id,
            title: raw.title,
            description: raw.description,
            deadline_at: raw.deadline_at,
            fallback_enabled: raw.fallback_enabled ?? false,
            grace_period_minutes: raw.grace_period_minutes ?? 0,
            allowed_file_types: raw.allowed_file_types ?? [],
            max_file_size_bytes: raw.max_file_size_bytes ?? 50 * 1024 * 1024,
            course_code: courseRaw?.code ?? "COURSE",
            course_name: courseRaw?.name ?? "Unknown Course",
          };
        }
      }
    } catch {
      // Keep going, use mock if it fails
    }
  }

  if (!assignment && !notFound) {
    assignment = {
      id,
      title: "Programming Assignment 3",
      course_code: "CS101",
      course_name: "Introduction to Computer Science",
      deadline_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      fallback_enabled: true,
      grace_period_minutes: 7 * 24 * 60,
      allowed_file_types: [".pdf", ".docx", ".zip", ".py"],
      max_file_size_bytes: 100 * 1024 * 1024,
      description: "Implement sorting algorithms and compare their performance.",
    };
  }

  if (notFound || !assignment) {
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

  return (
    <SubmissionFlowProvider assignment={assignment}>
      {children}
    </SubmissionFlowProvider>
  );
}
