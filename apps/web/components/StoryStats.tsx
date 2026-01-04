import { formatKudos, formatRelativeTime } from "@/lib/utils";
import { Star, Users, Clock, Activity } from "lucide-react";
import type { Story, StoryCluster } from "@/lib/api";

interface StoryStatsProps {
  story: Story | StoryCluster["story"];
  discovererCount: number;
  kudosPool: number;
  status: string;
}

export function StoryStats({ story, discovererCount, kudosPool, status }: StoryStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Star className="h-4 w-4" />
          <span className="text-sm">Kudos Pool</span>
        </div>
        <p className="text-2xl font-semibold text-[var(--gold)]">
          {formatKudos(kudosPool)}
        </p>
      </div>

      <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Users className="h-4 w-4" />
          <span className="text-sm">Discoverers</span>
        </div>
        <p className="text-2xl font-semibold">{discovererCount}</p>
      </div>

      <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Clock className="h-4 w-4" />
          <span className="text-sm">Created</span>
        </div>
        <p className="text-2xl font-semibold">
          {formatRelativeTime(new Date(story.createdAt))}
        </p>
      </div>

      <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Activity className="h-4 w-4" />
          <span className="text-sm">Status</span>
        </div>
        <p className="text-2xl font-semibold capitalize">{status}</p>
      </div>
    </div>
  );
}
