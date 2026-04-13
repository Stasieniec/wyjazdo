"use client";

import { useState } from "react";
import type { CustomQuestion } from "@/lib/validators/event";
import { newId } from "@/lib/ids";

export default function CustomQuestionsEditor({
  initial,
  name,
}: {
  initial: CustomQuestion[];
  name: string;
}) {
  const [questions, setQuestions] = useState<CustomQuestion[]>(initial);

  function update(i: number, patch: Partial<CustomQuestion>) {
    setQuestions((q) => q.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function remove(i: number) {
    setQuestions((q) => q.filter((_, idx) => idx !== i));
  }
  function add() {
    setQuestions((q) => [...q, { id: newId(), label: "", type: "short_text", required: false }]);
  }

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(questions)} />
      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-md border p-3">
            <div className="flex gap-2">
              <input
                placeholder="Pytanie"
                value={q.label}
                onChange={(e) => update(i, { label: e.target.value })}
                className="flex-1 rounded border px-2 py-1"
              />
              <select
                value={q.type}
                onChange={(e) => update(i, { type: e.target.value as CustomQuestion["type"] })}
                className="rounded border px-2 py-1"
              >
                <option value="short_text">Krótki tekst</option>
                <option value="long_text">Długi tekst</option>
                <option value="select">Wybór</option>
              </select>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => update(i, { required: e.target.checked })}
                />
                wymagane
              </label>
              <button type="button" onClick={() => remove(i)} className="text-sm text-red-600">
                Usuń
              </button>
            </div>
            {q.type === "select" && (
              <input
                placeholder="Opcje po przecinku (np. Tak, Nie, Może)"
                value={q.options?.join(", ") ?? ""}
                onChange={(e) =>
                  update(i, {
                    options: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="mt-2 w-full rounded border px-2 py-1"
              />
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-3 text-sm text-neutral-700 hover:underline">
        + Dodaj pytanie
      </button>
    </div>
  );
}
