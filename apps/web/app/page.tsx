import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TrendingUp, Zap, Users } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      <section className="text-center py-20 max-w-3xl">
        <h1 className="text-5xl font-bold tracking-tight mb-6">
          Back Breaking News
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          Stake on news stories you believe will go viral. Early backers earn
          proportional returns as more users join the market.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/stories">
            <Button size="lg">Explore Stories</Button>
          </Link>
          <Link href="/stories/submit">
            <Button size="lg" variant="outline">
              Submit a Story
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-8 py-16 w-full max-w-5xl">
        <div className="flex flex-col items-center text-center p-6 rounded-lg border bg-card">
          <TrendingUp className="h-12 w-12 mb-4 text-primary" />
          <h3 className="text-lg font-semibold mb-2">Spot Trends Early</h3>
          <p className="text-muted-foreground">
            Discover breaking stories before they hit mainstream. Back your
            instincts on what will go viral.
          </p>
        </div>
        <div className="flex flex-col items-center text-center p-6 rounded-lg border bg-card">
          <Zap className="h-12 w-12 mb-4 text-primary" />
          <h3 className="text-lg font-semibold mb-2">Early Backer Advantage</h3>
          <p className="text-muted-foreground">
            The earlier you stake, the larger your potential return as later
            participants enter the market.
          </p>
        </div>
        <div className="flex flex-col items-center text-center p-6 rounded-lg border bg-card">
          <Users className="h-12 w-12 mb-4 text-primary" />
          <h3 className="text-lg font-semibold mb-2">Crowd Intelligence</h3>
          <p className="text-muted-foreground">
            See what the crowd believes will trend. Market signals reveal
            collective attention predictions.
          </p>
        </div>
      </section>
    </div>
  );
}
