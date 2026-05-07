import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#EDE6D8] flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold mb-4 text-center text-[#16305A]">
        Citizen Science Upload
      </h1>

      <p className="text-center text-[#16305A] mb-12 max-w-md text-lg">
        Contribute your reef monitoring videos and turtle identification photos.
      </p>

      <div className="flex flex-col gap-6 w-full max-w-sm">
        <Link
          href="/reef-monitoring"
          className="bg-[#16305A] text-white text-xl font-semibold py-6 rounded-2xl shadow-lg hover:opacity-90 transition text-center"
        >
          Reef Monitoring
        </Link>

        <Link
          href="/turtle-id"
          className="bg-[#16305A] text-white text-xl font-semibold py-6 rounded-2xl shadow-lg hover:opacity-90 transition text-center"
        >
          Turtle ID
        </Link>
      </div>
    </main>
  );
}