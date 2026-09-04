import { renderLinkTemplate, type LinkTemplate } from "@gatefold/shared";

/** Enabled templates only, rendered against real values — the config's
 *  order is preserved so a user's reordering (were that ever added) or
 *  the shipped default order shows up predictably. */
export function renderLinkTemplates(
  templates: LinkTemplate[],
  vars: Record<string, string>,
): Array<{ label: string; url: string }> {
  return templates
    .filter((t) => t.enabled)
    .map((t) => ({ label: t.label, url: renderLinkTemplate(t.urlTemplate, vars) }));
}
