type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const MAX_DRAFT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function draftKey(ownerId: string) {
  return `ecs:onboarding-draft:${ownerId}`;
}

/** Local convenience only; payload readiness is validated by the form. */
export function readOnboardingDraft(
  storage: DraftStorage,
  ownerId: string | null,
  now = Date.now(),
): unknown {
  if (!ownerId) return null;
  try {
    // The old shared key has no ownership proof. Never migrate another account's data.
    storage.removeItem("ecs:onboarding-draft");
    const raw = storage.getItem(draftKey(ownerId));
    if (!raw) return null;
    const envelope = JSON.parse(raw);
    if (
      envelope.version !== 1 ||
      envelope.ownerId !== ownerId ||
      typeof envelope.savedAt !== "number" ||
      !Number.isFinite(envelope.savedAt) ||
      envelope.savedAt > now ||
      now - envelope.savedAt >= MAX_DRAFT_AGE_MS
    ) {
      clearOnboardingDraft(storage, ownerId);
      return null;
    }
    return envelope.data ?? null;
  } catch {
    clearOnboardingDraft(storage, ownerId);
    return null;
  }
}

export function clearOnboardingDraft(storage: DraftStorage, ownerId: string | null) {
  if (!ownerId) return;
  try {
    storage.removeItem(draftKey(ownerId));
  } catch {
    // Shop creation already succeeded, or storage is unavailable.
  }
}

export function writeOnboardingDraft(
  storage: DraftStorage,
  ownerId: string | null,
  data: unknown,
  now = Date.now(),
) {
  if (!ownerId) return;
  try {
    storage.setItem(draftKey(ownerId), JSON.stringify({ version: 1, ownerId, savedAt: now, data }));
  } catch {
    // Unavailable browser storage never blocks setup.
  }
}
