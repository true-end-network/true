import Link from "next/link"
import { ArrowLeft, GraduationCap } from "lucide-react"

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
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
          <Link
            href="/academy/mentor"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            List knowledge →
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/30 py-6">
        <p className="text-center text-[10px] text-muted-foreground/50 font-mono">
          All sessions are E2E encrypted. The relay never sees knowledge content.
        </p>
      </footer>
    </div>
  )
}
