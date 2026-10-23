import { Fragment, type ReactNode } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { templateParts } from "@media-summarizer/core/i18n/parts";

/**
 * A translated sentence with elements in the middle of it: each `{slot}` of
 * `template` is replaced by `slots[slot]`, typically a pressable `Text` link, so
 * the sentence wraps as one paragraph in every language.
 */
export function SlotText({ template, slots, style }: {
  template: string;
  slots: Record<string, ReactNode>;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={style}>
    {templateParts(template).map((part, index) =>
      <Fragment key={index}>{"slot" in part ? slots[part.slot] : part.text}</Fragment>)}
  </Text>;
}
