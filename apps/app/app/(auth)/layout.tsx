import Link from "next/link"
import { Scale } from "lucide-react"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/40 flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <Link href="/login" className="flex items-center gap-2.5">
        <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
          <Scale className="size-5" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-lg font-semibold">Lawfficient</span>
        </div>
      </Link>
      {children}
      <p className="text-muted-foreground text-xs">For authorized firm staff only.</p>
    </div>
  )
}
