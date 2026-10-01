import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open, rename, unlink, utimes } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

async function readOptional(path: string): Promise<string | undefined> {
  try {
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      if (!(await file.stat()).isFile()) throw new Error("Route snapshot must be a regular file.");
      return await file.readFile("utf8");
    } finally {
      await file.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      throw new Error("Route snapshot must be a regular file, not a symlink.");
    }
    throw error;
  }
}

async function syncDirectory(directory: string) {
  // Traefik 3.6 watches the configured parent, not nested directories. An
  // explicit attribute event on our own child wakes that parent watcher after
  // atomic replacement/withdrawal without access to sibling or ACME files.
  const timestamp = new Date();
  await utimes(directory, timestamp, timestamp);
  const parent = await open(directory, "r");
  try {
    await parent.sync();
  } finally {
    await parent.close();
  }
}

async function replace(directory: string, path: string, content: string) {
  const temporary = join(directory, `.ecs-custom-domains-${randomUUID()}.tmp`);
  try {
    const file = await open(temporary, "wx", 0o640);
    try {
      await file.writeFile(content, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, path);
    await syncDirectory(directory);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

function digest(content: string | undefined) {
  return content === undefined ? null : createHash("sha256").update(content).digest("hex");
}

function parsePublication(content: string) {
  if (content.length > 1024) throw new Error("Invalid route publication journal.");
  const value = JSON.parse(content) as {
    version?: unknown;
    acceptedDigest?: unknown;
    previousDigest?: unknown;
    candidateDigest?: unknown;
  };
  const validDigest = (hash: unknown) => typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash);
  if (
    !value ||
    value.version !== 1 ||
    !(value.acceptedDigest === null || validDigest(value.acceptedDigest)) ||
    !(value.previousDigest === null || validDigest(value.previousDigest)) ||
    !validDigest(value.candidateDigest)
  )
    throw new Error("Invalid route publication journal.");
  return value;
}

/**
 * Publishes already-rendered snapshots only. Call under the reconciliation DB
 * lock, with a trusted operator-owned directory. Verification must confirm the
 * live provider accepted this snapshot, not merely that the file was written;
 * the verifier must have a bounded deadline. Owned interrupted publications are
 * repaired from fresh desired state; unknown/foreign snapshots stop. Recovery
 * never rolls back to stale checkpoint routes, which may have been removed.
 * Never reads or writes ACME files or supplies certificate material.
 */
export function createDomainRoutePublisher({ directory }: { directory: string }) {
  if (!isAbsolute(directory)) throw new Error("An absolute route directory is required.");
  const path = join(directory, "ecs-custom-domains.yml");
  const checkpoint = join(directory, "ecs-custom-domains.last-good");
  const journal = join(directory, "ecs-custom-domains.publication");
  return {
    publish: async (content: string, verify: () => Promise<void>) => {
      const previous = await readOptional(path);
      const accepted = await readOptional(checkpoint);
      const pending = await readOptional(journal);
      const recovering = pending !== undefined;
      if (pending !== undefined) {
        const publication = parsePublication(pending);
        const knownAccepted =
          publication.acceptedDigest === digest(accepted) ||
          publication.candidateDigest === digest(accepted);
        const knownLive =
          publication.candidateDigest === digest(previous) ||
          publication.acceptedDigest === digest(previous) ||
          publication.previousDigest === digest(previous);
        if (!knownAccepted || !knownLive)
          throw new Error("Route publication journal does not match owned snapshots.");
      } else if (previous !== accepted) {
        throw new Error(
          "Unacknowledged route snapshot requires reconciliation before publication.",
        );
      }
      if (!recovering && previous === content) {
        await verify();
        return { changed: false };
      }
      try {
        await replace(
          directory,
          journal,
          JSON.stringify({
            version: 1,
            acceptedDigest: digest(accepted),
            previousDigest: digest(previous),
            candidateDigest: digest(content),
          }),
        );
        await replace(directory, path, content);
        await verify();
        await replace(directory, checkpoint, content);
        await unlink(journal);
        await syncDirectory(directory);
      } catch (error) {
        // The DB-derived desired set may exclude routes present in either old
        // snapshot. Keep the known interrupted candidate for a fresh retry,
        // rather than resurrecting old routes during recovery failure.
        if (recovering) throw error;
        try {
          const current = await readOptional(path);
          if (current !== content && current !== previous) {
            throw new Error("Route snapshot changed outside the reconciliation lock.");
          }
          const currentCheckpoint = await readOptional(checkpoint);
          if (currentCheckpoint !== content && currentCheckpoint !== accepted) {
            throw new Error("Route checkpoint changed outside the reconciliation lock.");
          }
          if (previous === undefined) {
            await unlink(path).catch((failure: NodeJS.ErrnoException) => {
              if (failure.code !== "ENOENT") throw failure;
            });
            await syncDirectory(directory);
          } else await replace(directory, path, previous);
          if (currentCheckpoint !== accepted) {
            if (accepted === undefined) {
              await unlink(checkpoint);
              await syncDirectory(directory);
            } else await replace(directory, checkpoint, accepted);
          }
          await unlink(journal).catch((failure: NodeJS.ErrnoException) => {
            if (failure.code !== "ENOENT") throw failure;
          });
          await syncDirectory(directory);
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            "Route publication and rollback failed.",
          );
        }
        throw error;
      }
      return { changed: true };
    },
  };
}
