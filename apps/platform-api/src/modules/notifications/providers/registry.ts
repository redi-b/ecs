import type { NotificationChannelId, NotificationProvider } from "./types.js";

export type NotificationProviderRegistry = {
  get(channel: NotificationChannelId): NotificationProvider | undefined;
  channels(): NotificationChannelId[];
};

export function createProviderRegistry(
  providers: NotificationProvider[],
): NotificationProviderRegistry {
  const byChannel = new Map<string, NotificationProvider>();
  for (const provider of providers) {
    byChannel.set(provider.channel, provider);
  }

  return {
    get(channel) {
      return byChannel.get(channel);
    },
    channels() {
      return [...byChannel.keys()];
    },
  };
}
