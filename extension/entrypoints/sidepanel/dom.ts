import { browser } from "wxt/browser";

/** Small DOM helpers for the side panel: everything is built as elements, never as HTML. */
type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; text?: string; attrs?: Record<string, string> } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props.className) element.className = props.className;
  if (props.text !== undefined) element.textContent = props.text;
  for (const [name, value] of Object.entries(props.attrs ?? {})) element.setAttribute(name, value);
  for (const child of children) if (child) element.append(child);
  return element;
}

export const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** A short muted line, or an error line. */
export function note(text: string, error = false): HTMLElement {
  return el("p", { className: error ? "note error" : "note", text });
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What a loop checks between two reads: the media it was started for is still the one shown. */
export interface Scope { alive: boolean }

/** "2 minutes ago", "yesterday", in the browser's language. */
export function relativeTime(iso: string | null | undefined): string {
  const time = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(time)) return "";
  const format = new Intl.RelativeTimeFormat(browser.i18n.getUILanguage(), { numeric: "auto" });
  const seconds = Math.round((time - Date.now()) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["second", 60], ["minute", 60], ["hour", 24], ["day", 7], ["week", 4.35], ["month", 12]];
  let value = seconds;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return format.format(unit === "second" ? 0 : Math.round(value), unit === "second" ? "minute" : unit);
    value /= size;
  }
  return format.format(Math.round(value), "year");
}
