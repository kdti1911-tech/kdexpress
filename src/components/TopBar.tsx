"use client";

import { useRouter } from "next/navigation";
import type { AuthUser } from "@/lib/auth";

export default function TopBar({ user }: { user: NonNullable<AuthUser> }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-2">
        <a
          href="/tracking"
          target="_blank"
          className="text-sm text-green-700 hover:underline"
        >
          Public Tracking
        </a>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          Welcome, <strong>{user.name}</strong>
        </span>
        {user.branch && (
          <span className="text-xs bg-green-50 text-blue-700 px-2 py-1 rounded-full">
            {user.branch.name}
          </span>
        )}
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
