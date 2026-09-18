import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SuggestionRule, SuggestionsConfig } from "@gatefold/shared";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SOURCES = ["backlog", "keep", "revisit"] as const;

function emptyRule(): SuggestionRule {
  return {
    id: crypto.randomUUID(),
    label: "New rule",
    days: [],
    startHour: 18,
    endHour: 23,
    weights: { backlog: 1, keep: 1, revisit: 1 },
  };
}

function RuleRow({
  rule,
  onChange,
  onRemove,
}: {
  rule: SuggestionRule;
  onChange: (next: SuggestionRule) => void;
  onRemove: () => void;
}) {
  const total = rule.weights.backlog + rule.weights.keep + rule.weights.revisit;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const toggleDay = (day: number) =>
    onChange({
      ...rule,
      days: rule.days.includes(day)
        ? rule.days.filter((d) => d !== day)
        : [...rule.days, day].sort(),
    });

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <Input
          value={rule.label}
          onChange={(e) => onChange({ ...rule, label: e.target.value })}
          className="flex-1"
          aria-label="Rule label"
        />
        <Button variant="danger" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {DAY_LABELS.map((label, day) => {
          const active = rule.days.includes(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              aria-pressed={active}
              className={`h-8 w-10 rounded-md text-xs font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-ink"
                  : "border border-border text-ink-muted hover:bg-surface-2"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          From
          <Input
            type="number"
            min={0}
            max={23}
            value={rule.startHour}
            onChange={(e) =>
              onChange({ ...rule, startHour: Number(e.target.value) })
            }
            className="w-16"
            aria-label="Start hour"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          to
          <Input
            type="number"
            min={0}
            max={23}
            value={rule.endHour}
            onChange={(e) =>
              onChange({ ...rule, endHour: Number(e.target.value) })
            }
            className="w-16"
            aria-label="End hour"
          />
        </label>
        <span className="text-xs text-ink-muted">
          24h, your server's own local time
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {SOURCES.map((source) => (
          <label key={source} className="space-y-1 text-xs text-ink-muted">
            <span className="capitalize">
              {source} · {pct(rule.weights[source])}%
            </span>
            <Input
              type="number"
              min={0}
              value={rule.weights[source]}
              onChange={(e) =>
                onChange({
                  ...rule,
                  weights: {
                    ...rule.weights,
                    [source]: Number(e.target.value),
                  },
                })
              }
              aria-label={`${source} weight`}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/** Settings: the Phase 12.3 backlog-suggester schedule — an optional map
 *  of time-of-day/day-of-week rules that bias which pool (Backlog / Keep /
 *  Revisit) the "Suggested for you" strip draws seed artists from. Off and
 *  inert until a rule is added and the feature enabled — no rule matching
 *  the current time falls back to an even split, same as disabled. */
export function SuggestionsSettings() {
  const qc = useQueryClient();
  const config = useQuery({
    queryKey: ["config", "suggestions"],
    queryFn: () => api.getConfig("suggestions"),
  });

  const [draft, setDraft] = useState<SuggestionsConfig | null>(null);
  useEffect(() => {
    if (config.data && !draft) setDraft(config.data);
  }, [config.data, draft]);

  const save = useMutation({
    mutationFn: (value: SuggestionsConfig) =>
      api.putConfig("suggestions", value),
    onSuccess: (next) => {
      qc.setQueryData(["config", "suggestions"], next);
      setDraft(next);
      void qc.invalidateQueries({ queryKey: ["suggestions"] });
    },
  });

  if (!draft) return null;

  const dirty = JSON.stringify(draft) !== JSON.stringify(config.data);

  const updateRule = (i: number, next: SuggestionRule) =>
    setDraft((d) => {
      if (!d) return d;
      const rules = [...d.rules];
      rules[i] = next;
      return { ...d, rules };
    });

  const addRule = () =>
    setDraft((d) => (d ? { ...d, rules: [...d.rules, emptyRule()] } : d));

  const removeRule = (i: number) =>
    setDraft((d) =>
      d ? { ...d, rules: d.rules.filter((_, j) => j !== i) } : d,
    );

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-ink">Backlog suggestions</h2>
          <p className="mt-1 text-xs text-ink-muted">
            {draft.rules.length > 0
              ? 'Weight which pool the "Suggested for you" strip draws from, by time of day and day of week.'
              : "Suggestions pull evenly from Backlog, Keep, and Revisit until you add a schedule below."}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            className="h-4 w-4 rounded border-border bg-surface accent-primary"
          />
          Enabled
        </label>
      </div>

      <div className="space-y-3">
        {draft.rules.map((rule, i) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            onChange={(next) => updateRule(i, next)}
            onRemove={() => removeRule(i)}
          />
        ))}
      </div>

      <Button variant="secondary" size="sm" onClick={addRule}>
        Add rule
      </Button>

      {save.isError && (
        <p className="text-sm text-danger">{(save.error as Error).message}</p>
      )}

      <Button
        variant="primary"
        onClick={() => draft && save.mutate(draft)}
        disabled={!dirty || save.isPending}
      >
        {save.isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
