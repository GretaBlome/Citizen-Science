import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#EDE6D8] px-6 py-10 text-[#16305A]">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
        <img
          src="/logo.png"
          alt="Great Isles Initiative"
          className="h-24 w-24 rounded-full object-cover"
        />

        <h1 className="mt-8 text-4xl font-bold leading-tight">
          Seen a sea turtle in Saint Lucia?
        </h1>

        <p className="mt-4 text-lg leading-relaxed">
          Report your sighting and upload your photos now or later.
        </p>

        <p className="mt-3 leading-relaxed text-[#16305A]/80">
          We&apos;ll let you know whether the turtle matched one of our known
          individuals or represents a new identification.
        </p>

        <div className="mt-8">
          <Link
            href="/turtle-id"
            className="flex w-full items-center justify-center rounded-2xl bg-[#16305A] px-6 py-5 text-lg font-semibold text-white shadow-md transition hover:opacity-90"
          >
            Report a Turtle Sighting
          </Link>
        </div>

        <p className="mt-4 text-center text-sm text-[#16305A]/65">
          Registration takes less than 30 seconds.
        </p>
      </div>
    </main>
  );
}