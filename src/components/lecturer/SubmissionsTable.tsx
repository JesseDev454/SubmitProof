import Link from 'next/link'

export type SubmissionRow = {
  id: string
  studentName: string
  studentEmail: string
  workflowStatus: string
  commitmentCount: number
  latestCommitmentAt: string | null
  upload: {
    id: string
    verificationResult: string
    policyResult: string
    uploadedAt: string
  } | null
  reviewDecision: string | null
}

function Result({ value }: { value: string }) {
  const tone = value === 'match' || value === 'qualifies' || value === 'accepted'
    ? 'bg-green-100 text-green-800'
    : value === 'mismatch' || value === 'does_not_qualify' || value === 'flagged'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-gray-100 text-gray-700'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{value.replaceAll('_', ' ')}</span>
}

export default function SubmissionsTable({ rows, totalStudents, assignmentId }: {
  rows: SubmissionRow[]
  totalStudents: number
  assignmentId: string
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-gray-100 px-5 py-4">
        <div><h2 className="text-base font-semibold text-gray-900">Student evidence</h2><p className="mt-1 text-xs text-gray-500">{rows.length} evidence records · {totalStudents} enrolled students</p></div>
      </header>
      {rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-gray-500">No submission or fallback evidence has been recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Workflow</th><th className="px-5 py-3">Verification</th><th className="px-5 py-3">Fallback policy</th><th className="px-5 py-3">Lecturer decision</th><th className="px-5 py-3">Evidence</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-5 py-4"><p className="font-medium text-gray-900">{row.studentName || 'Student'}</p><p className="text-xs text-gray-500">{row.studentEmail}</p></td>
                  <td className="px-5 py-4"><Result value={row.workflowStatus} /></td>
                  <td className="px-5 py-4"><Result value={row.upload?.verificationResult ?? 'pending'} /></td>
                  <td className="px-5 py-4"><Result value={row.upload?.policyResult ?? 'pending'} /></td>
                  <td className="px-5 py-4"><Result value={row.reviewDecision ?? 'not reviewed'} /></td>
                  <td className="px-5 py-4"><Link href={`/lecturer/assignments/${assignmentId}/submissions/${row.id}`} className="font-semibold text-blue-700 hover:underline">Review details</Link><p className="mt-1 text-xs text-gray-500">{row.commitmentCount} commitment{row.commitmentCount === 1 ? '' : 's'}{row.latestCommitmentAt ? ` · ${new Date(row.latestCommitmentAt).toLocaleString()}` : ''}</p></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
