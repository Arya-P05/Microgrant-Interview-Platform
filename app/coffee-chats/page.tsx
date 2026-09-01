import { HiOutlineLockClosed } from "react-icons/hi";

export default function CoffeeChatsHomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="border-b border-zinc-800 pb-6">
          <p className="text-xs font-medium uppercase text-emerald-300">
            Hack the North
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal">
            Coffee chats
          </h1>
          <p className="mt-2 text-sm text-zinc-500">Private invite required</p>
        </header>

        <section className="mt-10 flex min-h-64 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <div>
            <HiOutlineLockClosed className="mx-auto h-9 w-9 text-zinc-500" />
            <h2 className="mt-4 text-lg font-medium">Open your invite link</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
              Coffee chat booking is available through each student&apos;s
              private Hack the North invite link.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
