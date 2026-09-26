import NotFoundContent from '@/components/shared/NotFoundContent'

export default function LecturerNotFound() {
  return (
    <NotFoundContent
      primaryHref="/lecturer"
      primaryLabel="Go to Dashboard"
      secondaryLinks={[
        { label: 'View Assignments', href: '/lecturer/assignments' },
        { label: 'Contact Support', href: '#' }, // TODO: Implement support page
      ]}
    />
  )
}
