import Link from "next/link";

import { loadStudentAssignments } from "@/lib/student/data";

function label(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Not recorded";
}

export default async function HistoryPage() {
  const assignments = (await loadStudentAssignments()).filter((assignment) => assignment.submission_id);

  return <div className="mx-auto flex max-w-5xl flex-col gap-6">
    <header>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Submission history</h1>
      <p className="mt-2 text-sm text-slate-500">Recorded workflow, fingerprint verification, and policy qualification for your assignments.</p>
    </header>
    {assignments.length ? <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <ul className="divide-y divide-slate-100">
        {assignments.map((assignment) => <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{assignment.course_code} · {assignment.course_name}</p>
            <h2 className="mt-1 truncate font-bold text-slate-900">{assignment.title}</h2>
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs capitalize text-slate-600">
              <div><dt className="inline font-semibold">Workflow: </dt><dd className="inline">{label(assignment.workflow_status)}</dd></div>
              <div><dt className="inline font-semibold">Verification: </dt><dd className="inline">{label(assignment.latest_upload?.verification_result)}</dd></div>
              <div><dt className="inline font-semibold">Policy: </dt><dd className="inline">{label(assignment.latest_upload?.policy_result)}</dd></div>
            </dl>
          </div>
          <Link href={`/student/assignments/${assignment.id}/receipt`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Open record</Link>
        </li>)}
      </ul>
    </section> : <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h2 className="font-semibold text-slate-900">No submission records yet</h2>
      <p className="mt-2 text-sm text-slate-500">When the server records a commitment or upload, its history will appear here.</p>
      <Link href="/student/assignments" className="mt-4 inline-flex text-sm font-semibold text-blue-700 hover:underline">Browse assignments</Link>
    </section>}
  </div>
}
