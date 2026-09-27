import Link from 'next/link'
import SignOutButton from '@/components/shared/SignOutButton'

interface LecturerHeaderProps {
  displayName: string
  subtitle: string
}

export default function LecturerHeader({ displayName, subtitle }: LecturerHeaderProps) {
  const initials = displayName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <p className="text-sm text-gray-500">Assignment evidence and review</p>
      <div className="flex items-center gap-3">
        <Link href="/lecturer/profile" className="flex items-center gap-2.5 rounded-lg p-1 hover:bg-gray-50" aria-label="Open profile and settings">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{initials || 'L'}</span>
          <span className="flex flex-col text-left leading-tight"><span className="text-[13px] font-semibold text-gray-900">{displayName}</span><span className="text-[11px] text-gray-400">{subtitle || 'Lecturer'}</span></span>
        </Link>
        <SignOutButton className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60" />
      </div>
    </header>
  )
}
