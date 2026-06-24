import Link from "next/link"

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold sm:text-4xl">Lawfficient API</h1>
      <p className="text-fd-muted-foreground max-w-xl text-balance">
        The REST API behind Lawfficient — push and read leads, manage your firm&apos;s data, and
        subscribe to events. Per-firm API keys, header-based versioning, and cursor pagination.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/docs"
          className="bg-fd-primary text-fd-primary-foreground rounded-lg px-4 py-2 text-sm font-medium"
        >
          Read the docs
        </Link>
        <Link
          href="/docs/leads"
          className="border-fd-border rounded-lg border px-4 py-2 text-sm font-medium"
        >
          Leads API
        </Link>
      </div>
    </main>
  )
}
