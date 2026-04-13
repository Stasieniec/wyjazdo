import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const organizers = sqliteTable("organizers", {
  id: text("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  subdomain: text("subdomain").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  brandColor: text("brand_color"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  socialLinks: text("social_links"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    organizerId: text("organizer_id")
      .notNull()
      .references(() => organizers.id),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startsAt: integer("starts_at").notNull(),
    endsAt: integer("ends_at").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("PLN"),
    capacity: integer("capacity").notNull(),
    coverUrl: text("cover_url"),
    status: text("status", { enum: ["draft", "published", "archived"] })
      .notNull()
      .default("draft"),
    customQuestions: text("custom_questions"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    organizerIdx: index("events_organizer_idx").on(t.organizerId),
    organizerSlugUniq: uniqueIndex("events_organizer_slug_uniq").on(t.organizerId, t.slug),
  }),
);

export const participants = sqliteTable(
  "participants",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    customAnswers: text("custom_answers"),
    status: text("status", {
      enum: ["pending", "paid", "cancelled", "refunded", "waitlisted"],
    }).notNull(),
    expiresAt: integer("expires_at"),
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    amountPaidCents: integer("amount_paid_cents"),
    paidAt: integer("paid_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    eventStatusIdx: index("participants_event_status_idx").on(t.eventId, t.status),
    stripeSessionIdx: index("participants_stripe_session_idx").on(t.stripeSessionId),
  }),
);

export type Organizer = typeof organizers.$inferSelect;
export type NewOrganizer = typeof organizers.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;
