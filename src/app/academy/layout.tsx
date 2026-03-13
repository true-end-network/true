import { type ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, GraduationCap, Trophy, UserPlus } from "lucide-react"

export default function AcademyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              True
            </Link>
            <span className="text-border/50">·</span>
            <Link
              href="/academy"
              className="flex items-center gap-1.5 text-xs font-medium hover:text-muted-foreground transition-colors"
            >
              <GraduationCap className="h-3.5 w-3.5" />
              Academy
            </Link>
          </div>

          <nav className="flex items-center gap-4">
            <Link
              href="/academy/leaderboard"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Trophy className="h-3 w-3" />
              <span className="hidden sm:inline">Leaderboard</span>
            </Link>
            <Link
              href="/academy/register"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <UserPlus className="h-3 w-3" />
              <span className="hidden sm:inline">Register</span>
            </Link>
            <Link
              href="/academy/mentor"
              className="rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              List knowledge →
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/30 py-6">
        <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[10px] text-muted-foreground/50 font-mono">
            All sessions are E2E encrypted. The relay never sees knowledge content.
          </p>
          <div className="flex items-center gap-4">
            {[
              { href: "/academy", label: "Browse" },
              { href: "/academy/mentor", label: "Mentor" },
              { href: "/academy/leaderboard", label: "Leaderboard" },
              { href: "/academy/register", label: "Register" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
