import Link from 'next/link'

import { SubmissionFlowProvider } from '@/features/submissions/SubmissionFlowContext'
import { loadStudentAssignment } from '@/lib/student/data'

export default async function AssignmentFlowLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const assignment = await loadStudentAssignment(id)

  if (!assignment) {
    return <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-bold text-slate-900">Assignment not found</h1>
      <p className="text-sm text-slate-500">This assignment is unavailable to your account.</p>
      <Link href="/student/assignments" className="font-semibold text-blue-700 hover:underline">Back to assignments</Link>
    </div>
  }

  return <SubmissionFlowProvider assignment={{
    id: assignment.id,
    title: assignment.title,
    course_code: assignment.course_code,
    course_name: assignment.course_name,
    deadline_at: assignment.deadline_at,
    allowed_file_types: assignment.allowed_file_types,
    max_file_size_bytes: assignment.max_file_size_bytes,
    fallback_enabled: assignment.fallback_enabled,
    grace_period_minutes: assignment.grace_period_minutes,
    description: assignment.description,
    assignment_status: assignment.assignment_status,
  }}>{children}</SubmissionFlowProvider>
}
