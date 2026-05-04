"use client";

import { useActionState, useState } from "react";
import { Input, Card, ZlotyInput } from "@/components/ui";
import { saveSectionPaymentAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";
import {
  timestampToDdMmYyyyAndTime,
  parseDdMmYyyy,
  parseTimeHm,
  toDatetimeLocalValue,
} from "@/lib/datetime-form";

type Props = {
  eventId: string;
  initial: { depositCents: number | null; balanceDueAt: number | null };
  isFree: boolean;
};

export function SectionPayment({ eventId, initial, isFree }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(
    saveSectionPaymentAction.bind(null, eventId),
    null,
  );
  const [depositOn, setDepositOn] = useState(
    initial.depositCents != null && initial.depositCents > 0,
  );
  const [depositCents, setDepositCents] = useState<number>(initial.depositCents ?? 0);
  const [balanceDueAt, setBalanceDueAt] = useState(() => {
    if (initial.balanceDueAt == null) return "";
    const { date, time } = timestampToDdMmYyyyAndTime(initial.balanceDueAt);
    const parts = parseDdMmYyyy(date);
    const t = parseTimeHm(time);
    return parts && t ? toDatetimeLocalValue(parts, t) : "";
  });
  const errors = state && "errors" in state ? state.errors : {};

  if (isFree) {
    return (
      <section id="platnosc" className="scroll-mt-20">
        <Card>
          <h2 className="text-base font-semibold">Płatność</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Wydarzenie darmowe — pobieranie zaliczek nie ma zastosowania. Aby włączyć płatności,
            dodaj cenę w sekcji <strong>Uczestnicy</strong>.
          </p>
        </Card>
      </section>
    );
  }

  return (
    <SectionShell id="platnosc" title="Płatność" action={action} state={state}>
      <input type="hidden" name="depositOn" value={depositOn ? "true" : ""} />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={depositOn}
          onChange={(e) => setDepositOn(e.target.checked)}
        />
        <span>Pobieram tylko zaliczkę</span>
      </label>
      {depositOn && (
        <div className="space-y-3 border-t border-border pt-3">
          <label className="block text-sm">
            Zaliczka za osobę (PLN)
            <ZlotyInput
              valueCents={depositCents}
              onChangeCents={setDepositCents}
              className="mt-1 w-full rounded border border-border px-2 py-1"
            />
            <input type="hidden" name="deposit" value={(depositCents / 100).toString()} />
            {errors.depositCents && (
              <p className="mt-1 text-sm text-destructive">{errors.depositCents}</p>
            )}
          </label>
          <Input
            name="balanceDueAt"
            type="datetime-local"
            label="Termin dopłaty reszty"
            value={balanceDueAt}
            onChange={(e) => setBalanceDueAt(e.target.value)}
            required={depositOn}
            error={errors.balanceDueAt}
          />
        </div>
      )}
    </SectionShell>
  );
}
