"use client";
import Link from "next/link";
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main role="alert"><p className="eyebrow">Unable to save</p><h1>That change could not be completed.</h1><p>Please review the fields and try again. If the problem continues, contact A’Dash support.</p><button onClick={reset}>Try again</button> <Link href="/dashboard">Back to overview</Link></main>;
}
