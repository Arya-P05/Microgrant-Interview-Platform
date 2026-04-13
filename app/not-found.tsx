import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-zinc-500 text-sm mb-4">Page not found</p>
        <Link
          href="/round2"
          className="text-emerald-400 hover:text-emerald-300 text-sm"
        >
          Go to Round 2
        </Link>
        <span className="text-zinc-600 mx-2">·</span>
        <Link
          href="/round1"
          className="text-emerald-400 hover:text-emerald-300 text-sm"
        >
          Round 1
        </Link>
      </div>
    </div>
  );
}
