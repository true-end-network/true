"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Home, Users, Calendar, Bot } from "lucide-react"

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/contacts", icon: Users, label: "Contacts" },
  { href: "/schedule", icon: Calendar, label: "Schedule" },
  { href: "/skill", icon: Bot, label: "Skill" },
]

export function BottomNav() {
  const pathname = usePathname()

  // Hide on room observe page (fullscreen experience)
  if (pathname.startsWith("/room/")) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
