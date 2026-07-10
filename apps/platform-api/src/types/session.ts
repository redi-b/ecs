export type DashboardActorRole = "owner" | "manager" | "staff" | "operator";

export type PlatformSessionUser = {
  id: string;
  email: string;
  name: string;
};

export type PlatformSession = {
  user: PlatformSessionUser;
};

export type DashboardAuthorizationResult =
  | {
      ok: true;
      actor: {
        id: string;
        email: string;
        name: string | null;
        role: DashboardActorRole;
      };
    }
  | {
      ok: false;
    };
