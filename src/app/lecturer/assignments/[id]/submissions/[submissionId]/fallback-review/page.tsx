import { redirect } from 'next/navigation'

type Props = { params: Promise<{ id: string; submissionId: string }> }

export default async function FallbackReviewPage({ params }: Props) {
  const { id, submissionId } = await params
  redirect(`/lecturer/assignments/${id}/submissions/${submissionId}`)
}
