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
