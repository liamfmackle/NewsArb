import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-[var(--muted)] mb-6">page not found</p>
      <Link href="/">
        <Button>go home</Button>
      </Link>
    </div>
  );
}
