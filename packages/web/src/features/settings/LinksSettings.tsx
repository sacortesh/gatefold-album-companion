import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LinkTemplate, LinksConfig } from "@gatefold/shared";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

function TemplateRow({
  template,
  onChange,
}: {
  template: LinkTemplate;
  onChange: (next: LinkTemplate) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={template.enabled}
        onChange={(e) => onChange({ ...template, enabled: e.target.checked })}
        className="h-4 w-4 shrink-0 rounded border-border bg-surface accent-primary"
        aria-label={`Enable ${template.label}`}
      />
      <Input
        value={template.label}
        onChange={(e) => onChange({ ...template, label: e.target.value })}
        className="w-40 shrink-0 text-xs"
        aria-label="Label"
      />
      <Input
        value={template.urlTemplate}
        onChange={(e) => onChange({ ...template, urlTemplate: e.target.value })}
        className="flex-1 font-mono text-xs"
        aria-label="URL template"
      />
    </div>
  );
}

/** Settings: configure the "About this album" link templates (RYM, Metal
 *  Archives, Last.fm — Phase 10.11) and the track-level lyrics-search
 *  fallback templates (Genius, SongMeanings — Phase 10.12). One card, one
 *  Save, same pattern as DiscogsSetup — the config is one object either
 *  way, so a partial save would be a lie. */
export function LinksSettings() {
  const qc = useQueryClient();
  const links = useQuery({
    queryKey: ["config", "links"],
    queryFn: () => api.getConfig("links"),
  });

  const [draft, setDraft] = useState<LinksConfig | null>(null);
  useEffect(() => {
    if (links.data && !draft) setDraft(links.data);
  }, [links.data, draft]);

  const save = useMutation({
    mutationFn: (value: LinksConfig) => api.putConfig("links", value),
    onSuccess: (next) => {
      qc.setQueryData(["config", "links"], next);
      setDraft(next);
      void qc.invalidateQueries({ queryKey: ["album-context"] });
    },
  });

  if (!draft) return null;

  const dirty = JSON.stringify(draft) !== JSON.stringify(links.data);

  const updateAt = (
    section: "album" | "track",
    index: number,
    next: LinkTemplate,
  ) =>
    setDraft((d) => {
      if (!d) return d;
      const list = [...d[section]];
      list[index] = next;
      return { ...d, [section]: list };
    });

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-sm font-medium text-ink">External links</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Search-link templates — {"{artist}"}, {"{album}"}, and{" "}
          {"{track}"} are substituted and URL-encoded.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          About this album
        </p>
        {draft.album.map((t, i) => (
          <TemplateRow
            key={t.id}
            template={t}
            onChange={(next) => updateAt("album", i, next)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Lyrics search fallback
        </p>
        {draft.track.map((t, i) => (
          <TemplateRow
            key={t.id}
            template={t}
            onChange={(next) => updateAt("track", i, next)}
          />
        ))}
      </div>

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
