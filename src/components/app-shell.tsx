"use client"

import { usePathname } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isRoom = pathname.startsWith("/room/")

  return (
    <>
      <div className={isRoom ? "" : "pb-[calc(3.5rem+env(safe-area-inset-bottom))]"}>
        {children}
      </div>
      <BottomNav />
    </>
  )
}
