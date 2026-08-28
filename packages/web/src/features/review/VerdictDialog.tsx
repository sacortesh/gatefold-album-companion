import { useEffect, useState } from "react";
import type { Review, Verdict } from "@spotify-companion/shared";
import { useSubmitVerdict } from "./useVerdict";

const VERDICTS: Array<{ value: Verdict; label: string; hint: string }> = [
  { value: "keep", label: "Keep", hint: "Save the album to your Library" },
  { value: "revisit", label: "Revisit", hint: "Come back later; keeps this review" },
  { value: "pass", label: "Pass", hint: "Not for me — just clears the backlog" },
  { value: "delete", label: "Delete", hint: "Pass + remove from saved albums" },
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    submit.mutate(
      {
        albumId,
        verdict,
        rating,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        notes,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg space-y-5 rounded-xl border border-neutral-800 bg-neutral-950 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-semibold">
            {existing ? "Update review" : "Finish"} — {albumName}
          </h2>
          <p className="text-xs text-neutral-500">
            Records a review and clears the album from your backlog.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {VERDICTS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setVerdict(v.value)}
              className={`rounded-lg border p-3 text-left transition ${
                verdict === v.value
                  ? "border-emerald-600 bg-emerald-950/50"
                  : "border-neutral-800 hover:border-neutral-700"
              }`}
            >
              <div className="text-sm font-medium">{v.label}</div>
              <div className="text-xs text-neutral-500">{v.hint}</div>
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-neutral-400">Rating (optional)</label>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(rating === n ? undefined : n)}
                className={`h-8 w-8 rounded text-sm ${
                  rating === n
                    ? "bg-emerald-600 text-white"
                    : "border border-neutral-800 text-neutral-400 hover:bg-neutral-800"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-neutral-400">Tags (comma-separated)</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="blackgaze, 2013, night-driving"
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-neutral-400">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          />
        </div>

        {submit.isError && (
          <p className="text-sm text-red-400">
            {(submit.error as Error).message}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={submit.isPending}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {submit.isPending ? "Saving…" : "Save & clear"}
          </button>
        </div>
      </div>
    </div>
  );
}
