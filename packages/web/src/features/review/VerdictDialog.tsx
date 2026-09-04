import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Review, Verdict } from "@gatefold/shared";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "../../components/ui/dialog";
import { useSubmitVerdict } from "./useVerdict";

const VERDICTS: Array<{ value: Verdict; label: string; hint: string }> = [
  { value: "keep", label: "Keep", hint: "Save the album to your Library" },
  { value: "revisit", label: "Revisit", hint: "Come back later; keeps this review" },
  { value: "pass", label: "Pass", hint: "Not for me — just clears the backlog" },
  { value: "delete", label: "Delete", hint: "Pass + remove from saved albums" },
];

/** Quick-add chips for the tags field — genres and how the album felt. */
const SUGGESTED_TAGS = [
  "night-driving",
  "focus",
  "cathartic",
  "melancholy",
  "euphoric",
  "unsettling",
  "comfort",
  "grower",
];

interface Props {
  albumId: string;
  albumName: string;
  existing: Review | null;
  onClose: () => void;
}

export function VerdictDialog({ albumId, albumName, existing, onClose }: Props) {
  const submit = useSubmitVerdict(albumId);
  const [verdict, setVerdict] = useState<Verdict>(existing?.verdict ?? "keep");
  const [rating, setRating] = useState<number | undefined>(existing?.rating);
  const [tags, setTags] = useState((existing?.tags ?? []).join(", "));
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const template = useQuery({
    queryKey: ["review-template"],
    queryFn: api.reviewTemplate,
    staleTime: 5 * 60_000,
  });

  const parseTags = (s: string): string[] =>
    s
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const addTag = (tag: string) => {
    const current = parseTags(tags);
    if (current.includes(tag)) return;
    setTags([...current, tag].join(", "));
  };

  const save = () => {
    submit.mutate(
      {
        albumId,
        verdict,
        rating,
        tags: parseTags(tags),
        notes,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="space-y-5">
        <div>
          <DialogTitle>
            {existing ? "Update review" : "Finish"} — {albumName}
          </DialogTitle>
          <p className="text-xs text-ink-muted">
            Records a review and clears the album from your backlog.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {VERDICTS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setVerdict(v.value)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                verdict === v.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-ink-muted"
              }`}
            >
              <div className="text-sm font-medium">{v.label}</div>
              <div className="text-xs text-ink-muted">{v.hint}</div>
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-ink-muted">Rating (optional)</label>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(rating === n ? undefined : n)}
                className={`h-8 w-8 rounded text-sm ${
                  rating === n
                    ? "bg-primary text-primary-ink"
                    : "border border-border text-ink-muted hover:bg-surface-2"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-ink-muted">
            Genre, mood, how it made you feel{" "}
            <span className="text-ink-muted">— optional</span>
          </label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="blackgaze, 2013, night-driving"
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink"
          />
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {SUGGESTED_TAGS.filter(
              (t) => !parseTags(tags).includes(t),
            ).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addTag(t)}
                className="rounded-full border border-border px-2 py-0.5 text-xs text-ink-muted hover:border-ink-muted hover:text-ink"
              >
                + {t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-ink-muted">Notes</label>
            {template.data && !notes.trim() && (
              <button
                type="button"
                onClick={() => setNotes(template.data.template.trimEnd() + "\n")}
                className="text-xs text-primary hover:opacity-80"
              >
                Insert review template
              </button>
            )}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={notes.trim() ? 12 : 5}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
          />
        </div>

        {submit.isError && (
          <p className="text-sm text-danger">
            {(submit.error as Error).message}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={submit.isPending}>
            {submit.isPending ? "Saving…" : "Save & clear"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
