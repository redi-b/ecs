import { z } from "zod";

import type { EmailSenderProfile } from "../notifications/providers/email-configuration.js";

const textMarkSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({
    attrs: z.object({ href: z.string().max(2_000) }),
    type: z.literal("link"),
  }),
]);

const textNodeSchema = z.object({
  marks: z.array(textMarkSchema).max(3).optional(),
  text: z.string().max(10_000),
  type: z.literal("text"),
});

type EmailTextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { attrs: { href: string }; type: "link" };
export type EmailContentNode =
  | { marks?: EmailTextMark[] | undefined; text: string; type: "text" }
  | { type: "hardBreak" }
  | {
      content?: EmailContentNode[] | undefined;
      type: "bulletList" | "listItem" | "orderedList" | "paragraph";
    }
  | { attrs: { level: number }; content?: EmailContentNode[] | undefined; type: "heading" }
  | { attrs: { href: string; label: string }; type: "emailButton" };

const contentNodeSchema = z.lazy(() =>
  z.union([
    textNodeSchema,
    z.object({ type: z.literal("hardBreak") }),
    z.object({
      content: z.array(contentNodeSchema).max(100).optional(),
      type: z.enum(["paragraph", "bulletList", "orderedList", "listItem"]),
    }),
    z.object({
      attrs: z.object({ level: z.number().int().min(2).max(3) }),
      content: z.array(contentNodeSchema).max(30).optional(),
      type: z.literal("heading"),
    }),
    z.object({
      attrs: z.object({ href: z.string().max(2_000), label: z.string().min(1).max(80) }),
      type: z.literal("emailButton"),
    }),
  ]),
) as z.ZodType<EmailContentNode>;

export const emailTemplateDocumentSchema = z.object({
  content: z.array(contentNodeSchema).min(1).max(100),
  type: z.literal("doc"),
});

export type EmailTemplateDocument = z.infer<typeof emailTemplateDocumentSchema>;
export type EmailTemplateLocale = "am" | "en";
export type EmailTemplateKey =
  | "account.email_change_current"
  | "account.email_change_new"
  | "account.email_verification"
  | "account.organization_invitation"
  | "account.password_reset"
  | "customer.order_cancelled"
  | "customer.order_confirmation"
  | "customer.order_delivered"
  | "customer.order_out_for_delivery"
  | "customer.order_ready";

export type EmailTemplateDefinition = {
  description: string;
  fixtures: Record<string, string>;
  key: EmailTemplateKey;
  label: string;
  locales: Record<
    EmailTemplateLocale,
    {
      content: EmailTemplateDocument;
      preheader: string;
      subject: string;
    }
  >;
  requiredVariables: readonly string[];
  senderProfile: EmailSenderProfile;
};

const text = (value: string) => ({ text: value, type: "text" as const });
const paragraph = (value: string) => ({ content: [text(value)], type: "paragraph" as const });
const button = (label: string) => ({
  attrs: { href: "{{action_url}}", label },
  type: "emailButton" as const,
});
const document = (...content: EmailTemplateDocument["content"]): EmailTemplateDocument => ({
  content,
  type: "doc",
});

const commonFixtures = {
  action_url: "https://app.example.com/continue?token=preview",
  recipient_name: "Liya",
};

const orderFixtures = {
  order_reference: "ECS-1042",
  order_total: "ETB 1,850",
  recipient_name: "Liya",
  shop_name: "Bole Style",
};

const orderTemplate = (input: {
  am: { body: string; preheader: string; subject: string };
  description: string;
  en: { body: string; preheader: string; subject: string };
  key: Extract<EmailTemplateKey, `customer.${string}`>;
  label: string;
}): EmailTemplateDefinition => ({
  description: input.description,
  fixtures: orderFixtures,
  key: input.key,
  label: input.label,
  locales: {
    en: {
      content: document(
        paragraph("Hi {{recipient_name}},"),
        paragraph(input.en.body),
        paragraph("Order: {{order_reference}}"),
        paragraph("Total: {{order_total}}"),
        paragraph("If you have a question, reply to this email and {{shop_name}} will help you."),
      ),
      preheader: input.en.preheader,
      subject: input.en.subject,
    },
    am: {
      content: document(
        paragraph("ሰላም {{recipient_name}}፣"),
        paragraph(input.am.body),
        paragraph("የትዕዛዝ ቁጥር፦ {{order_reference}}"),
        paragraph("ጠቅላላ፦ {{order_total}}"),
        paragraph("ጥያቄ ካለዎት ለዚህ ኢሜይል ምላሽ ይስጡ፤ {{shop_name}} ይረዳዎታል።"),
      ),
      preheader: input.am.preheader,
      subject: input.am.subject,
    },
  },
  requiredVariables: ["order_reference", "order_total", "recipient_name", "shop_name"],
  senderProfile: "orders",
});

export const EMAIL_TEMPLATE_CATALOG: readonly EmailTemplateDefinition[] = [
  {
    description: "Sent when a new account needs to confirm its email address.",
    fixtures: commonFixtures,
    key: "account.email_verification",
    label: "Email verification",
    locales: {
      en: {
        content: document(
          paragraph("Hi {{recipient_name}},"),
          paragraph("Confirm your email address to finish setting up your ECS account."),
          button("Verify email"),
          paragraph(
            "This link expires soon. If you did not create this account, you can ignore this email.",
          ),
        ),
        preheader: "Confirm your email address to finish setting up your account.",
        subject: "Verify your ECS email address",
      },
      am: {
        content: document(
          paragraph("ሰላም {{recipient_name}}፣"),
          paragraph("የECS መለያዎን ማዘጋጀት ለመጨረስ ኢሜይልዎን ያረጋግጡ።"),
          button("ኢሜይልዎን ያረጋግጡ"),
          paragraph(
            "ይህ ሊንክ የሚያገለግለው ለአጭር ጊዜ ብቻ ነው። ይህን መለያ እርስዎ ካልከፈቱት፣ ምንም ማድረግ አይጠበቅብዎትም።",
          ),
        ),
        preheader: "መለያዎን ማዘጋጀት ለመጨረስ ኢሜይልዎን ያረጋግጡ።",
        subject: "የECS ኢሜይልዎን ያረጋግጡ",
      },
    },
    requiredVariables: ["action_url", "recipient_name"],
    senderProfile: "accounts",
  },
  {
    description: "Sent when someone requests a password reset.",
    fixtures: commonFixtures,
    key: "account.password_reset",
    label: "Password reset",
    locales: {
      en: {
        content: document(
          paragraph("Hi {{recipient_name}},"),
          paragraph("Use the button below to choose a new password for your ECS account."),
          button("Reset password"),
          paragraph("If you did not request this, you can safely ignore this email."),
        ),
        preheader: "Choose a new password for your ECS account.",
        subject: "Reset your ECS password",
      },
      am: {
        content: document(
          paragraph("ሰላም {{recipient_name}}፣"),
          paragraph("ከታች ያለውን በመጫን ለECS መለያዎ አዲስ የይለፍ ቃል ይምረጡ።"),
          button("የይለፍ ቃል ይቀይሩ"),
          paragraph("ይህን ጥያቄ እርስዎ ካላቀረቡ፣ ምንም ማድረግ አይጠበቅብዎትም።"),
        ),
        preheader: "ለECS መለያዎ አዲስ የይለፍ ቃል ይምረጡ።",
        subject: "የECS የይለፍ ቃልዎን ይቀይሩ",
      },
    },
    requiredVariables: ["action_url", "recipient_name"],
    senderProfile: "accounts",
  },
  {
    description: "Sent to the current address before an email address is changed.",
    fixtures: { ...commonFixtures, new_email: "liya.new@example.com" },
    key: "account.email_change_current",
    label: "Email change approval",
    locales: {
      en: {
        content: document(
          paragraph("Hi {{recipient_name}},"),
          paragraph("A request was made to change your ECS email address to {{new_email}}."),
          button("Approve email change"),
          paragraph("If this was not you, do not approve the change and secure your account."),
        ),
        preheader: "Approve the requested change to your ECS email address.",
        subject: "Approve your ECS email change",
      },
      am: {
        content: document(
          paragraph("ሰላም {{recipient_name}}፣"),
          paragraph("የECS ኢሜይልዎን ወደ {{new_email}} ለመቀየር ጥያቄ ቀርቧል።"),
          button("የኢሜይል ለውጡን ያረጋግጡ"),
          paragraph("ጥያቄውን እርስዎ ካላቀረቡ ለውጡን አያረጋግጡ፤ የመለያዎን ደህንነትም ይጠብቁ።"),
        ),
        preheader: "የECS ኢሜይል ለውጥ ጥያቄዎን ያረጋግጡ።",
        subject: "የECS ኢሜይል ለውጥዎን ያረጋግጡ",
      },
    },
    requiredVariables: ["action_url", "new_email", "recipient_name"],
    senderProfile: "accounts",
  },
  {
    description: "Sent to the new address to confirm an email address change.",
    fixtures: commonFixtures,
    key: "account.email_change_new",
    label: "New email confirmation",
    locales: {
      en: {
        content: document(
          paragraph("Hi {{recipient_name}},"),
          paragraph("Confirm this address as the new email for your ECS account."),
          button("Confirm new email"),
          paragraph("If you were not expecting this, you can ignore this email."),
        ),
        preheader: "Confirm your new ECS email address.",
        subject: "Confirm your new ECS email address",
      },
      am: {
        content: document(
          paragraph("ሰላም {{recipient_name}}፣"),
          paragraph("ይህን አድራሻ ለECS መለያዎ አዲሱ ኢሜይል አድርገው ያረጋግጡ።"),
          button("አዲሱን ኢሜይል ያረጋግጡ"),
          paragraph("ይህን ጥያቄ እርስዎ ካልጠበቁት፣ ምንም ማድረግ አይጠበቅብዎትም።"),
        ),
        preheader: "አዲሱን የECS ኢሜይልዎን ያረጋግጡ።",
        subject: "አዲሱን የECS ኢሜይልዎን ያረጋግጡ",
      },
    },
    requiredVariables: ["action_url", "recipient_name"],
    senderProfile: "accounts",
  },
  {
    description: "Sent when a shop owner invites someone to their team.",
    fixtures: {
      ...commonFixtures,
      inviter_name: "Meron",
      shop_name: "Bole Style",
    },
    key: "account.organization_invitation",
    label: "Team invitation",
    locales: {
      en: {
        content: document(
          paragraph("Hi {{recipient_name}},"),
          paragraph("{{inviter_name}} invited you to work with {{shop_name}} on ECS."),
          button("Join the team"),
          paragraph(
            "This invitation expires in 7 days. If you were not expecting it, you can ignore this email.",
          ),
        ),
        preheader: "You have been invited to work with {{shop_name}}.",
        subject: "Join {{shop_name}} on ECS",
      },
      am: {
        content: document(
          paragraph("ሰላም {{recipient_name}}፣"),
          paragraph("{{inviter_name}} በECS ላይ ከ{{shop_name}} ጋር እንዲሰሩ የመቀላቀያ ጥሪ ልከውልዎታል።"),
          button("ቡድኑን ይቀላቀሉ"),
          paragraph("ይህ ጥሪ የሚያገለግለው ለ7 ቀናት ብቻ ነው። ካልጠበቁት፣ ምንም ማድረግ አይጠበቅብዎትም።"),
        ),
        preheader: "ከ{{shop_name}} ጋር እንዲሰሩ የመቀላቀያ ጥሪ ደርሶዎታል።",
        subject: "የ{{shop_name}} ቡድንን በECS ይቀላቀሉ",
      },
    },
    requiredVariables: ["action_url", "inviter_name", "recipient_name", "shop_name"],
    senderProfile: "accounts",
  },
  orderTemplate({
    am: {
      body: "{{shop_name}} ትዕዛዝዎን ተቀብሏል። ሁኔታው ሲቀየር እናሳውቅዎታለን።",
      preheader: "{{shop_name}} ትዕዛዝዎን ተቀብሏል።",
      subject: "{{shop_name}} ትዕዛዝ {{order_reference}}ን ተቀብሏል",
    },
    description: "Sent to a customer after the shop receives an order.",
    en: {
      body: "{{shop_name}} has received your order. We will let you know when its status changes.",
      preheader: "{{shop_name}} has received your order.",
      subject: "Order {{order_reference}} received",
    },
    key: "customer.order_confirmation",
    label: "Order confirmation",
  }),
  orderTemplate({
    am: {
      body: "ትዕዛዝዎ ዝግጁ ነው። ከመደብሩ የተሰጠውን የመረከቢያ ወይም የደሊቨሪ መመሪያ ይከተሉ።",
      preheader: "የ{{shop_name}} ትዕዛዝዎ ዝግጁ ነው።",
      subject: "ትዕዛዝ {{order_reference}} ዝግጁ ነው",
    },
    description: "Sent when an order is packed or ready for pickup.",
    en: {
      body: "Your order is ready. Follow the collection or delivery instructions provided by the shop.",
      preheader: "Your order from {{shop_name}} is ready.",
      subject: "Order {{order_reference}} is ready",
    },
    key: "customer.order_ready",
    label: "Order ready",
  }),
  orderTemplate({
    am: {
      body: "ትዕዛዝዎ ለደሊቨሪ ወጥቷል። {{shop_name}} በቅርቡ ያደርስልዎታል።",
      preheader: "የ{{shop_name}} ትዕዛዝዎ ለደሊቨሪ ወጥቷል።",
      subject: "ትዕዛዝ {{order_reference}} በመንገድ ላይ ነው",
    },
    description: "Sent when an order leaves the shop for delivery.",
    en: {
      body: "Your order is out for delivery. {{shop_name}} will get it to you soon.",
      preheader: "Your order from {{shop_name}} is out for delivery.",
      subject: "Order {{order_reference}} is on the way",
    },
    key: "customer.order_out_for_delivery",
    label: "Order out for delivery",
  }),
  orderTemplate({
    am: {
      body: "ትዕዛዝዎ ደርሷል። ከ{{shop_name}} ስለገዙ እናመሰግናለን!",
      preheader: "ትዕዛዝዎ ደርሷል።",
      subject: "ትዕዛዝ {{order_reference}} ደርሷል",
    },
    description: "Sent when an order is marked as delivered.",
    en: {
      body: "Your order has been marked as delivered. Thank you for shopping with {{shop_name}}.",
      preheader: "Your order has been delivered.",
      subject: "Order {{order_reference}} was delivered",
    },
    key: "customer.order_delivered",
    label: "Order delivered",
  }),
  orderTemplate({
    am: {
      body: "ትዕዛዝዎ ተሰርዟል። ክፍያ ፈጽመው ከነበረ፣ ስለ ተመላሽ ገንዘቡ {{shop_name}}ን ያነጋግሩ።",
      preheader: "ትዕዛዝዎ ተሰርዟል።",
      subject: "ትዕዛዝ {{order_reference}} ተሰርዟል",
    },
    description: "Sent when a shop cancels a customer order.",
    en: {
      body: "Your order has been cancelled. If you already paid, contact {{shop_name}} about the refund.",
      preheader: "Your order has been cancelled.",
      subject: "Order {{order_reference}} was cancelled",
    },
    key: "customer.order_cancelled",
    label: "Order cancelled",
  }),
] as const;

export function getEmailTemplateDefinition(key: string) {
  return EMAIL_TEMPLATE_CATALOG.find((template) => template.key === key);
}
