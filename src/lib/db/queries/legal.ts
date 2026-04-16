// src/lib/db/queries/legal.ts
import { and, eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { newId } from "@/lib/ids";

// ── Legal Documents ──

export async function getLatestDocument(
  type: "regulamin" | "privacy_policy" | "organizer_terms" | "dpa" | "cookie_policy",
) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.legalDocuments)
    .where(eq(schema.legalDocuments.type, type))
    .orderBy(desc(schema.legalDocuments.version))
    .limit(1);
  return rows[0] ?? null;
}

export async function getDocumentById(id: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.legalDocuments)
    .where(eq(schema.legalDocuments.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertLegalDocument(input: {
  type: "regulamin" | "privacy_policy" | "organizer_terms" | "dpa" | "cookie_policy";
  version: number;
  title: string;
  content: string;
  effectiveAt: number;
}) {
  const db = getDb();
  const now = Date.now();
  const id = newId();
  await db.insert(schema.legalDocuments).values({
    id,
    type: input.type,
    version: input.version,
    title: input.title,
    content: input.content,
    effectiveAt: input.effectiveAt,
    createdAt: now,
  });
  return id;
}

// ── Organizer Consents ──

export async function insertOrganizerConsent(input: {
  organizerId: string;
  documentId: string;
  ipAddress: string | null;
}) {
  const db = getDb();
  const now = Date.now();
  await db.insert(schema.organizerConsents).values({
    id: newId(),
    organizerId: input.organizerId,
    documentId: input.documentId,
    acceptedAt: now,
    ipAddress: input.ipAddress,
    createdAt: now,
  });
}

export async function getOrganizerConsents(organizerId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.organizerConsents)
    .where(eq(schema.organizerConsents.organizerId, organizerId))
    .all();
}

// ── Participant Consents ──

export async function insertParticipantConsents(
  participantId: string,
  consents: Array<{
    consentKey: string;
    consentLabel: string;
    accepted: boolean;
    documentId: string | null;
  }>,
  ipAddress: string | null,
) {
  const db = getDb();
  const now = Date.now();
  const rows = consents.map((c) => ({
    id: newId(),
    participantId,
    consentKey: c.consentKey,
    consentLabel: c.consentLabel,
    accepted: c.accepted ? 1 : 0,
    documentId: c.documentId,
    acceptedAt: now,
    ipAddress,
    createdAt: now,
  }));
  if (rows.length > 0) {
    await db.insert(schema.participantConsents).values(rows);
  }
}

export async function getParticipantConsents(participantId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.participantConsents)
    .where(eq(schema.participantConsents.participantId, participantId))
    .all();
}
