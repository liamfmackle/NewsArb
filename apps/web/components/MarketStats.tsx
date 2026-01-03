import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { TrendingUp, Users, Clock, Activity } from "lucide-react";
import type { Market } from "@/lib/api";

interface MarketStatsProps {
  market: Market;
}

export function MarketStats({ market }: MarketStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm">Total Pool</span>
        </div>
        <p className="text-2xl font-semibold">
          {formatCurrency(market.totalPool)}
        </p>
      </div>

      <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Users className="h-4 w-4" />
          <span className="text-sm">Participants</span>
        </div>
        <p className="text-2xl font-semibold">{market.participantCount}</p>
      </div>

      <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Clock className="h-4 w-4" />
          <span className="text-sm">Created</span>
        </div>
        <p className="text-2xl font-semibold">
          {formatRelativeTime(new Date(market.createdAt))}
        </p>
      </div>

      <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Activity className="h-4 w-4" />
          <span className="text-sm">Status</span>
        </div>
        <p className="text-2xl font-semibold capitalize">{market.status}</p>
      </div>
    </div>
  );
}
