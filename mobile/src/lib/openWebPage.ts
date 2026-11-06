import { Linking } from "react-native";
import type { ChatWebSource } from "@media-summarizer/core/types/chat";

/**
 * Opens a web page a chat answer cites in the browser (task-615). Only an
 * http(s) URL is handed over: the address comes from the model's citation, so
 * any other scheme is refused rather than opened.
 */
export function openWebPage(source: ChatWebSource): void {
  if (!/^https?:\/\//i.test(source.url)) return;
  void Linking.openURL(source.url).catch(() => undefined);
}
