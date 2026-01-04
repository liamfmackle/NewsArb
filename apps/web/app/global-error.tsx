"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0a] text-white antialiased">
        <div className="flex flex-col items-center justify-center min-h-screen font-sans">
          <h1 className="text-2xl font-bold mb-4">something went wrong</h1>
          <button
            onClick={reset}
            className="px-5 py-2 bg-[#d4af37] text-black font-medium rounded-md hover:bg-[#a08928] transition-colors"
          >
            try again
          </button>
        </div>
      </body>
    </html>
  );
}
