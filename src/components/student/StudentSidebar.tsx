"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  name: string;
  href: string;
  icon: (active: boolean) => React.ReactNode;
}

const navItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/student",
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-colors ${active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    name: "Assignments",
    href: "/student/assignments",
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-colors ${active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    name: "Receipts",
    href: "/student/receipts",
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-colors ${active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
        <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
        <path d="M12 17V7" />
      </svg>
    ),
  },
  {
    name: "History",
    href: "/student/history",
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-colors ${active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    name: "Profile",
    href: "/student/profile",
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-colors ${active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export function StudentSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-100 flex-col justify-between select-none">
      {/* Top: Logo & Nav */}
      <div className="flex flex-col">
        {/* Brand Logo Header */}
        <div className="px-6 py-6 border-b border-slate-100/60">
          <Link href="/student" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <svg
                className="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" />
                <path d="m9 12 2 2 4-4" stroke="#2563EB" strokeWidth="2.5" fill="none" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 text-lg leading-tight tracking-tight">
                SubmitProof
              </span>
              <span className="text-[11px] text-slate-400 leading-tight">
                Your work. Always counts.
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation items */}
        <nav className="p-4 flex flex-col gap-1.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/student"
                ? pathname === "/student"
                : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-50/80 text-blue-600 font-semibold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {item.icon(isActive)}
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Pinned Block: Learning without limits */}
      <div className="p-6 border-t border-slate-100">
        <div className="w-16 h-8 text-blue-300 mb-2">
          {/* Stylized Mountain Graphic */}
          <svg viewBox="0 0 80 40" fill="none" className="w-full h-full">
            <path
              d="M10 35 L30 10 L45 25 L65 5 L75 35 Z"
              stroke="#93C5FD"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M30 10 L38 20 L45 15 L55 28"
              stroke="#BFDBFE"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h4 className="font-extrabold text-slate-900 text-sm leading-tight tracking-tight">
          Learning without limits.
        </h4>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          SubmitProof helps you stay on track — online or offline.
        </p>
      </div>
    </aside>
  );
}
