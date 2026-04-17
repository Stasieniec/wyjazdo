import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const organizers = sqliteTable(
  "organizers",
  {
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
    stripeAccountId: text("stripe_account_id"),
    stripeOnboardingComplete: integer("stripe_onboarding_complete").notNull().default(0),
    stripePayoutsEnabled: integer("stripe_payouts_enabled").notNull().default(0),
    stripeAccountSyncedAt: integer("stripe_account_synced_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    termsAcceptedAt: integer("terms_accepted_at"),
    dpaAcceptedAt: integer("dpa_accepted_at"),
  },
  (t) => ({
    stripeAccountUniq: uniqueIndex("organizers_stripe_account_uniq").on(t.stripeAccountId),
  }),
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    organizerId: text("organizer_id").notNull().references(() => organizers.id),
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
    attendeeTypes: text("attendee_types"),
    depositCents: integer("deposit_cents"),
    balanceDueAt: integer("balance_due_at"),
    consentConfig: text("consent_config"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    organizerIdx: index("events_organizer_idx").on(t.organizerId),
    organizerSlugUniq: uniqueIndex("events_organizer_slug_uniq").on(t.organizerId, t.slug),
  }),
);

export const eventPhotos = sqliteTable(
  "event_photos",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    position: integer("position").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    eventIdx: index("event_photos_event_idx").on(t.eventId),
  }),
);

export const participants = sqliteTable(
  "participants",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    customAnswers: text("custom_answers"),
    lifecycleStatus: text("lifecycle_status", {
      enum: ["active", "waitlisted", "cancelled"],
    }).notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    eventLifecycleIdx: index("participants_event_lifecycle_idx").on(t.eventId, t.lifecycleStatus),
  }),
);

export const attendees = sqliteTable(
  "attendees",
  {
    id: text("id").primaryKey(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    attendeeTypeId: text("attendee_type_id").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    customAnswers: text("custom_answers"),
    cancelledAt: integer("cancelled_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    participantIdx: index("attendees_participant_idx").on(t.participantId),
    participantActiveIdx: index("attendees_participant_active_idx").on(t.participantId, t.cancelledAt),
  }),
);

export type Attendee = typeof attendees.$inferSelect;
export type NewAttendee = typeof attendees.$inferInsert;

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    participantId: text("participant_id").notNull().references(() => participants.id),
    kind: text("kind", { enum: ["full", "deposit", "balance"] }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("PLN"),
    status: text("status", {
      enum: ["pending", "succeeded", "expired", "failed", "refunded"],
    }).notNull(),
    dueAt: integer("due_at"),
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeApplicationFee: integer("stripe_application_fee"),
    lastReminderAt: integer("last_reminder_at"),
    paidAt: integer("paid_at"),
    expiresAt: integer("expires_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    participantIdx: index("payments_participant_idx").on(t.participantId),
    stripeSessionIdx: index("payments_stripe_session_idx").on(t.stripeSessionId),
    statusDueIdx: index("payments_status_due_idx").on(t.status, t.dueAt),
  }),
);

export const legalDocuments = sqliteTable(
  "legal_documents",
  {
    id: text("id").primaryKey(),
    type: text("type", {
      enum: [
        "regulamin",
        "privacy_policy",
        "organizer_terms",
        "dpa",
        "cookie_policy",
      ],
    }).notNull(),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    effectiveAt: integer("effective_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    typeVersionUniq: uniqueIndex("legal_documents_type_version_uniq").on(t.type, t.version),
  }),
);

export const organizerConsents = sqliteTable(
  "organizer_consents",
  {
    id: text("id").primaryKey(),
    organizerId: text("organizer_id")
      .notNull()
      .references(() => organizers.id),
    documentId: text("document_id")
      .notNull()
      .references(() => legalDocuments.id),
    acceptedAt: integer("accepted_at").notNull(),
    ipAddress: text("ip_address"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    organizerIdx: index("organizer_consents_organizer_idx").on(t.organizerId),
  }),
);

export const participantConsents = sqliteTable(
  "participant_consents",
  {
    id: text("id").primaryKey(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id),
    consentKey: text("consent_key").notNull(),
    consentLabel: text("consent_label").notNull(),
    accepted: integer("accepted").notNull(),
    documentId: text("document_id"),
    acceptedAt: integer("accepted_at").notNull(),
    ipAddress: text("ip_address"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    participantIdx: index("participant_consents_participant_idx").on(
      t.participantId,
    ),
  }),
);

export type Organizer = typeof organizers.$inferSelect;
export type NewOrganizer = typeof organizers.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventPhoto = typeof eventPhotos.$inferSelect;
export type NewEventPhoto = typeof eventPhotos.$inferInsert;
export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type LegalDocument = typeof legalDocuments.$inferSelect;
export type NewLegalDocument = typeof legalDocuments.$inferInsert;
export type OrganizerConsent = typeof organizerConsents.$inferSelect;
export type NewOrganizerConsent = typeof organizerConsents.$inferInsert;
export type ParticipantConsent = typeof participantConsents.$inferSelect;
export type NewParticipantConsent = typeof participantConsents.$inferInsert;
