import Link from "next/link";

import { loadStudentAssignments } from "@/lib/student/data";

export default async function ReceiptsPage() {
  const assignments = (await loadStudentAssignments()).filter((assignment) => assignment.submission_id);

  return <div className="mx-auto flex max-w-5xl flex-col gap-6">
    <header>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Receipts</h1>
      <p className="mt-2 text-sm text-slate-500">Open a receipt for evidence recorded by SubmitProof.</p>
    </header>
    {assignments.length ? <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      {assignments.map((assignment) => <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{assignment.course_code} · {assignment.course_name}</p>
          <h2 className="mt-1 font-bold text-slate-900">{assignment.title}</h2>
          <p className="mt-1 text-xs capitalize text-slate-500">Workflow: {assignment.workflow_status?.replaceAll("_", " ") ?? "Not recorded"}</p>
        </div>
        <Link href={`/student/assignments/${assignment.id}/receipt`} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">View receipt</Link>
      </li>)}
    </ul> : <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h2 className="font-semibold text-slate-900">No receipts yet</h2>
      <p className="mt-2 text-sm text-slate-500">A receipt becomes available when your submission evidence is recorded.</p>
      <Link href="/student/assignments" className="mt-4 inline-flex text-sm font-semibold text-blue-700 hover:underline">Browse assignments</Link>
    </section>}
  </div>
}
