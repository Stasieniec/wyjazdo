"use server";

export type SectionResult = { ok: true } | { errors: Record<string, string> };

// Stub implementations — real ones land in Task 12.
async function todo(
  _eventId: string,
  _prev: SectionResult | null,
  _formData: FormData,
): Promise<SectionResult> {
  return { errors: { _form: "Not implemented (Task 12 pending)" } };
}

export const saveSectionBasicsAction = todo;
export const saveSectionDatesAction = todo;
export const saveSectionLocationAction = todo;
export const saveSectionAttendeesAction = todo;
export const saveSectionCapacityAction = todo;
export const saveSectionPaymentAction = todo;
export const saveSectionPhotosAction = todo;
export const saveSectionQuestionsAction = todo;
export const saveSectionConsentsAction = todo;
