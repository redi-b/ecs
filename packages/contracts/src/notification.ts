import { z } from "zod";

export const notificationPreferenceSchema = z.object({
  id: z.string().min(1),
  channel: z.string().min(1),
  enabled: z.boolean(),
  events: z.array(z.string().min(1)),
  target: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const notificationPreferencesSchema = z.object({
  preferences: z.array(notificationPreferenceSchema),
});

export const notificationPreferenceMutationSchema = z.object({
  preference: notificationPreferenceSchema,
});

export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export type NotificationPreferenceMutation = z.infer<typeof notificationPreferenceMutationSchema>;
