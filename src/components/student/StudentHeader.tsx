"use client";

interface StudentHeaderProps {
  displayName?: string;
  subtitle?: string;
  avatarUrl?: string;
}

export function StudentHeader({
  displayName = "Student",
  subtitle = "Computer Science",
  avatarUrl,
}: StudentHeaderProps) {
  // Get initials for fallback avatar
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 h-18 bg-white/95 backdrop-blur-xs border-b border-slate-100 px-6 sm:px-8 flex items-center justify-between">
      {/* Search Input (Visual only, non-functional) */}
      <div className="w-full max-w-md">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            readOnly
            placeholder="Search assignments, courses, or receipts..."
            className="w-full rounded-xl border border-slate-200/80 bg-slate-50/60 py-2 pl-10 pr-4 text-xs sm:text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none cursor-default shadow-2xs"
          />
        </div>
      </div>

      {/* Right: Notifications & User Menu */}
      <div className="flex items-center gap-4 sm:gap-6">
        {/* Notification Bell */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {/* Red notification dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
        </button>

        {/* User Profile Menu */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-100 cursor-pointer group">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-100"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center ring-2 ring-blue-50">
              {initials || "ST"}
            </div>
          )}

          <div className="hidden sm:flex flex-col text-left">
            <span className="text-sm font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
              {displayName}
            </span>
            <span className="text-xs text-slate-500 leading-tight">
              {subtitle}
            </span>
          </div>

          <svg
            className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors ml-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </header>
  );
}
