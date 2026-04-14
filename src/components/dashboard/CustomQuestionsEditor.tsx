"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLayoutEffect, useState } from "react";
import type { CustomQuestion } from "@/lib/validators/event";
import { newId } from "@/lib/ids";

/** In-editor draft: select `options` may include empty strings until submit. */
type CustomQuestionDraft = Omit<CustomQuestion, "options"> & {
  options?: string[];
};

function defaultSelectRows(): string[] {
  return ["", ""];
}

function normalizeInitial(q: CustomQuestion): CustomQuestionDraft {
  if (q.type !== "select") return q;
  const opts = q.options?.length ? [...q.options] : defaultSelectRows();
  return { ...q, options: opts };
}

function sanitizeForSubmit(qs: CustomQuestionDraft[]): CustomQuestion[] {
  return qs.map((q) => {
    if (q.type !== "select") {
      const { options: _omit, ...rest } = q;
      return rest as CustomQuestion;
    }
    const opts = (q.options ?? []).map((s) => s.trim()).filter(Boolean);
    return {
      id: q.id,
      label: q.label,
      type: "select",
      required: q.required,
      ...(opts.length > 0 ? { options: opts } : {}),
    };
  });
}

function newRowId() {
  return crypto.randomUUID();
}

function DragGripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="6" cy="4" r="1.25" />
      <circle cx="10" cy="4" r="1.25" />
      <circle cx="6" cy="8" r="1.25" />
      <circle cx="10" cy="8" r="1.25" />
      <circle cx="6" cy="12" r="1.25" />
      <circle cx="10" cy="12" r="1.25" />
    </svg>
  );
}

function SortableOptionRow({
  id,
  value,
  index,
  onValueChange,
  onRemove,
  onEnterAdd,
}: {
  id: string;
  value: string;
  index: number;
  onValueChange: (value: string) => void;
  onRemove: () => void;
  onEnterAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 ${isDragging ? "z-10 opacity-60" : ""}`}
      aria-roledescription="sortable"
    >
      <button
        type="button"
        className="flex h-9 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground active:cursor-grabbing"
        aria-label="Przeciągnij, by zmienić kolejność"
        title="Zmień kolejność"
        {...attributes}
        {...listeners}
      >
        <DragGripIcon />
      </button>
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground"
        aria-hidden
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="9" cy="9" r="7.25" stroke="currentColor" strokeWidth="1.25" />
        </svg>
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnterAdd();
          }
        }}
        placeholder={`Opcja ${index + 1}`}
        className="min-w-0 flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
        autoComplete="off"
        aria-label={`Tekst opcji ${index + 1}`}
      />
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        aria-label={`Usuń opcję ${index + 1}`}
        title="Usuń opcję"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

function SelectOptionsEditor({
  rows,
  onRowsChange,
}: {
  rows: string[];
  onRowsChange: (next: string[]) => void;
}) {
  const [rowIds, setRowIds] = useState<string[]>(() => rows.map(() => newRowId()));

  useLayoutEffect(() => {
    setRowIds((prev) => {
      if (prev.length === rows.length) return prev;
      const next = [...prev];
      while (next.length < rows.length) next.push(newRowId());
      next.length = rows.length;
      return next;
    });
  }, [rows.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function updateRow(index: number, value: string) {
    const next = [...rows];
    next[index] = value;
    onRowsChange(next);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) {
      onRowsChange([""]);
      return;
    }
    onRowsChange(rows.filter((_, i) => i !== index));
  }

  function addRow() {
    onRowsChange([...rows, ""]);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rowIds.indexOf(String(active.id));
    const newIndex = rowIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onRowsChange(arrayMove(rows, oldIndex, newIndex));
    setRowIds((ids) => arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <div className="mt-3 rounded-md border border-border/80 bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Opcje odpowiedzi</p>
      <p className="sr-only" id="select-options-dnd-hint">
        Użyj uchwytu po lewej stronie, aby przeciągnąć i zmienić kolejność opcji. Klawiatura: skup się na
        uchwycie, naciśnij Spację, aby podnieść element, strzałki w górę lub w dół, aby przesunąć, Spację
        ponownie, aby upuścić.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2" role="list" aria-describedby="select-options-dnd-hint">
            {rows.map((value, j) => (
              <SortableOptionRow
                key={rowIds[j]}
                id={rowIds[j]}
                value={value}
                index={j}
                onValueChange={(v) => updateRow(j, v)}
                onRemove={() => removeRow(j)}
                onEnterAdd={addRow}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={addRow}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-primary/5"
      >
        <span className="text-lg leading-none" aria-hidden>
          +
        </span>
        Dodaj opcję
      </button>
    </div>
  );
}

function SortableQuestionCard({
  id,
  question: q,
  onUpdate,
  onRemove,
}: {
  id: string;
  question: CustomQuestionDraft;
  onUpdate: (patch: Partial<CustomQuestionDraft>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-md border border-border bg-background p-3 ${isDragging ? "z-10 opacity-60" : ""}`}
      aria-roledescription="sortable"
    >
      <div className="flex gap-2">
        <button
          type="button"
          className="mt-0.5 flex h-9 w-8 shrink-0 cursor-grab touch-none items-start justify-center rounded text-muted-foreground hover:bg-muted/50 hover:text-foreground active:cursor-grabbing"
          aria-label="Przeciągnij, by zmienić kolejność pytania"
          title="Zmień kolejność pytań"
          {...attributes}
          {...listeners}
        >
          <DragGripIcon />
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              placeholder="Pytanie"
              value={q.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              className="min-w-[12rem] flex-1 rounded border px-2 py-1"
              aria-label="Treść pytania"
            />
            <select
              aria-label="Typ pytania"
              value={q.type}
              onChange={(e) => {
                const t = e.target.value as CustomQuestion["type"];
                if (t === "select") {
                  onUpdate({
                    type: "select",
                    options:
                      q.type === "select" && q.options?.some((s) => s.trim())
                        ? q.options
                        : defaultSelectRows(),
                  });
                } else {
                  onUpdate({ type: t, options: undefined });
                }
              }}
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
                onChange={(e) => onUpdate({ required: e.target.checked })}
              />
              wymagane
            </label>
            <button type="button" onClick={onRemove} className="text-sm text-red-600">
              Usuń
            </button>
          </div>
          {q.type === "select" && (
            <SelectOptionsEditor
              key={`${q.id}-select`}
              rows={q.options ?? defaultSelectRows()}
              onRowsChange={(next) => onUpdate({ options: next })}
            />
          )}
        </div>
      </div>
    </li>
  );
}

export default function CustomQuestionsEditor({
  initial,
  name,
}: {
  initial: CustomQuestion[];
  name: string;
}) {
  const [questions, setQuestions] = useState<CustomQuestionDraft[]>(() =>
    initial.map(normalizeInitial),
  );

  const questionSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function update(i: number, patch: Partial<CustomQuestionDraft>) {
    setQuestions((q) => q.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function remove(i: number) {
    setQuestions((q) => q.filter((_, idx) => idx !== i));
  }
  function add() {
    setQuestions((q) => [...q, { id: newId(), label: "", type: "short_text", required: false }]);
  }

  function handleQuestionsDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setQuestions((qs) => {
      const oldIndex = qs.findIndex((q) => q.id === active.id);
      const newIndex = qs.findIndex((q) => q.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return qs;
      return arrayMove(qs, oldIndex, newIndex);
    });
  }

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(sanitizeForSubmit(questions))} />
      <p className="sr-only" id="questions-dnd-hint">
        Użyj uchwytu po lewej stronie każdego pytania, aby przeciągnąć i zmienić kolejność pytań.
        Klawiatura: skup się na uchwycie, naciśnij Spację, aby podnieść element, strzałki w górę lub w dół,
        aby przesunąć, Spację ponownie, aby upuścić.
      </p>
      <DndContext
        sensors={questionSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleQuestionsDragEnd}
      >
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <ul className="list-none space-y-3" role="list" aria-describedby="questions-dnd-hint">
            {questions.map((q, i) => (
              <SortableQuestionCard
                key={q.id}
                id={q.id}
                question={q}
                onUpdate={(patch) => update(i, patch)}
                onRemove={() => remove(i)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <button type="button" onClick={add} className="mt-3 text-sm text-neutral-700 hover:underline">
        + Dodaj pytanie
      </button>
    </div>
  );
}
