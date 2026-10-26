/**
 * A translated sentence cut around its `{slots}`, for the sentences that carry a
 * link or a button in the middle ("…you accept the {terms} and the {privacy}…").
 * The words around the slot stay in the catalogue, in the order each language
 * needs; the caller renders each slot as its own element.
 */
export type TemplatePart = { text: string } | { slot: string };

export function templateParts(template: string): TemplatePart[] {
  return template.split(/(\{\w+\})/).filter(Boolean).map((piece) => {
    const slot = /^\{(\w+)\}$/.exec(piece);
    return slot ? { slot: slot[1] } : { text: piece };
  });
}

/**
 * A translated sentence cut around its `[marked]` words, for the welcome art's
 * search results: each language marks the words of its own query, so the
 * highlight falls where that language puts them.
 */
export type MarkedPart = { text: string; marked: boolean };

export function markedParts(text: string): MarkedPart[] {
  return text.split(/(\[[^\]]+\])/).filter(Boolean).map((piece) => {
    const marked = /^\[([^\]]+)\]$/.exec(piece);
    return marked ? { text: marked[1], marked: true } : { text: piece, marked: false };
  });
}
