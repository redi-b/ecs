import assert from "node:assert/strict";
import test from "node:test";

import { ActivityRegistry, type GlobalActivity } from "./activity-registry";

function activity(id: string, priority = 0): GlobalActivity {
  return {
    description: `${id} description`,
    icon: id,
    id,
    priority,
    status: "running",
    title: id,
  };
}

test("registers heterogeneous activities in stable priority order", () => {
  const registry = new ActivityRegistry();
  const media = activity("media", 10);
  const importTask = activity("import", 20);

  registry.register(media.id, media);
  registry.register(importTask.id, importTask);

  assert.deepEqual(
    registry.getSnapshot().map((item) => item.id),
    ["import", "media"],
  );
});

test("publishes updates and removes only the matching registration", () => {
  const registry = new ActivityRegistry();
  const current = activity("import");
  let notifications = 0;
  registry.subscribe(() => {
    notifications += 1;
  });
  const unregister = registry.register(current.id, current);

  registry.update({ ...current, progress: 75, status: "success" });
  assert.equal(registry.getSnapshot()[0]?.progress, 75);

  unregister();
  assert.deepEqual(registry.getSnapshot(), []);
  assert.equal(notifications, 3);
});
