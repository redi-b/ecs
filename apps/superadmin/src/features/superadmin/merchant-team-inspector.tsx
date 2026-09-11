import type { SuperadminMerchantTeam } from "@ecs/contracts";
import { ShieldCheck, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MerchantTeamInspector({ team }: { team: SuperadminMerchantTeam }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
            <ShieldCheck aria-hidden className="size-4 text-muted-foreground" />
          </span>
          <div>
            <CardTitle>Merchant team</CardTitle>
            <CardDescription>Read-only access state from the shop organization.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="divide-y rounded-lg border">
          {team.members.map((member) => (
            <div className="flex min-w-0 items-center gap-3 px-3 py-3" key={member.id}>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
                <UserRound aria-hidden className="size-4 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.name}</p>
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {member.role.replaceAll("_", " ")}
                </Badge>
                {member.status !== "active" ? (
                  <Badge variant="secondary">{member.status}</Badge>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Pending invitations</dt>
            <dd className="mt-0.5 font-medium">{team.invitations.length}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Custom roles</dt>
            <dd className="mt-0.5 font-medium">{team.roles.length}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
