"use client";

import { RiPauseLine as Pause, RiPlayLine as Play } from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { OperatorDiscoveryCampaign } from "@/lib/platform-api/superadmin/discovery";

export function DiscoveryCampaignWorkspace({
  campaigns,
}: {
  campaigns: OperatorDiscoveryCampaign[];
}) {
  if (!campaigns.length)
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No discovery campaigns configured.
        </CardContent>
      </Card>
    );
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="divide-y">
        {campaigns.map((campaign) => (
          <CampaignRow campaign={campaign} key={campaign.id} />
        ))}
      </div>
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: OperatorDiscoveryCampaign }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const nextStatus = campaign.status === "active" ? "paused" : "active";
  async function toggle() {
    if (reason.trim().length < 10) {
      toast.error("Add a reason of at least 10 characters.");
      return;
    }
    setPending(true);
    const response = await fetch(`/api/discovery/campaigns/${campaign.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason, patch: { status: nextStatus } }),
    });
    setPending(false);
    if (!response.ok) {
      toast.error("Campaign update failed.");
      return;
    }
    toast.success(`Campaign ${nextStatus === "active" ? "enabled" : "paused"}.`);
    setReason("");
    router.refresh();
  }
  return (
    <div className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(14rem,18rem)] md:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{campaign.key}</p>
          <Badge variant={campaign.status === "active" ? "success" : "secondary"}>
            {campaign.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Priority {campaign.priority} · {campaign.cooldownHours}h cooldown · {campaign.snoozeDays}d
          snooze
        </p>
      </div>
      <Button variant="outline" size="sm" disabled={pending} onClick={toggle}>
        {campaign.status === "active" ? <Pause /> : <Play />}
        {campaign.status === "active" ? "Pause" : "Activate"}
      </Button>
      <Input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason for the audit log"
        aria-label={`Reason for ${campaign.key}`}
      />
    </div>
  );
}
