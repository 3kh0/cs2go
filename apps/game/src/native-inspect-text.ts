export type InspectText = {
  weapons: string[];
  paints: Record<string, string>;
  collections: string[];
  finishCollections: Record<string, number>;
};

let pending: Promise<InspectText> | undefined;
export function loadInspectText(): Promise<InspectText> {
  return (pending ??= import("./data/weapon-inspect-text.json")
    .then((m) => m.default)
    .catch((error: unknown) => {
      pending = undefined;
      throw error;
    }));
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Render only native emphasis/line breaks, never arbitrary markup. */
export function appendInspectText(host: HTMLElement, raw: string, decodeAll = false) {
  for (const paragraph of raw.replace(/<br\s*\/?>/gi, "\n").split(/\n\s*\n/)) {
    if (!paragraph.trim()) continue;
    const p = document.createElement("p");
    const stack: HTMLElement[] = [p];
    for (const token of paragraph.split(/(<[^>]*>)/)) {
      const parent = stack.at(-1)!;
      if (/^<\/(?:i|em|b|strong)\s*>$/i.test(token)) {
        if (stack.length > 1) stack.pop();
      } else if (/^<(?:i|em|b|strong)(?:\s[^>]*)?>$/i.test(token)) {
        const e = document.createElement(/^<(?:i|em)\b/i.test(token) ? "em" : "strong");
        parent.append(e);
        stack.push(e);
      } else if (!/^<[^>]*>$/.test(token)) {
        token.split("\n").forEach((line, i) => {
          if (i) parent.append(document.createElement("br"));
          parent.append(
            document.createTextNode(
              line.replace(
                decodeAll ? /&(amp|lt|gt|quot|apos);/g : /&(lt|gt);/g,
                (_, key: string) => entities[key]!,
              ),
            ),
          );
        });
      }
    }
    host.append(p);
  }
}
