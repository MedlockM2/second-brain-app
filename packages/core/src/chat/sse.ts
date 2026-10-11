import type { ChatStreamEvent } from "../types/chat";

/** One SSE block: `event:`, `id:`, `data:` lines; comment lines are keepalives. */
export function parseSseBlock(block: string): ChatStreamEvent | null {
  let name = "message";
  const data: string[] = [];
  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "event") name = value;
    else if (field === "data") data.push(value);
  }
  if (data.length === 0) return null;
  try {
    const parsed = JSON.parse(data.join("\n"));
    switch (name) {
      case "generation":
      case "fragment":
      case "end":
      case "reconnect":
        return { type: name, data: parsed } as ChatStreamEvent;
      default:
        return null;
    }
  } catch {
    return null;
  }
}
