import { useState, type ReactNode } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { Icon, type IconName } from "../Icon";

/**
 * One pane of the three: what its header says, what it holds.
 *
 * `title` and `icon` name the pane on its rail once folded; `head` replaces the
 * title in the header when the pane has something better to show there (a
 * folder path, a conversation title, a breadcrumb back to the AI pane).
 */
export type PaneSpec = {
  title: string;
  icon: IconName;
  head?: ReactNode;
  actions?: ReactNode;
  body: ReactNode;
  foot?: ReactNode;
};

const STORAGE_KEY = "deepn.panes";

type Folded = { left: boolean; right: boolean };

function readFolded(): Folded {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Folded>;
    return { left: stored.left === true, right: stored.right === true };
  } catch {
    return { left: false, right: false };
  }
}

/**
 * The three panes of a media, a folder and a Digest period (owner's mockup,
 * after NotebookLM): a reading pane on the left, the discussion in the middle,
 * the AI pane on the right. Both side panes fold into a rail; the discussion
 * never does. `wideRight` widens the AI pane while it shows an artifact. The
 * folding is a per-browser preference, kept across pages.
 *
 * `band` sits above the panes: the Digest puts its period strip there.
 */
export function Panes({
  left,
  mid,
  right,
  wideRight = false,
  band,
}: {
  left: PaneSpec;
  mid: PaneSpec;
  right: PaneSpec;
  wideRight?: boolean;
  band?: ReactNode;
}) {
  const [folded, setFolded] = useState<Folded>(readFolded);
  const fold = (side: keyof Folded, value: boolean) => {
    setFolded((current) => {
      const next = { ...current, [side]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // The panes still fold for this visit.
      }
      return next;
    });
  };

  const columns = [
    folded.left ? "56px" : "minmax(0, 1.1fr)",
    "minmax(0, 1fr)",
    folded.right ? "56px" : wideRight ? "minmax(0, 1.1fr)" : "400px",
  ].join(" ");

  return (
    <div className="work">
      {band}
      <div className="panes" style={{ gridTemplateColumns: columns }}>
        <Pane spec={left} side="left" folded={folded.left} onFold={(v) => fold("left", v)} />
        <Pane spec={mid} side="mid" folded={false} />
        <Pane spec={right} side="right" folded={folded.right} onFold={(v) => fold("right", v)} />
      </div>
    </div>
  );
}

function Pane({
  spec,
  side,
  folded,
  onFold,
}: {
  spec: PaneSpec;
  side: "left" | "mid" | "right";
  folded: boolean;
  onFold?: (folded: boolean) => void;
}) {
  const { tw } = useI18n();
  // Chevrons point the way the pane moves; in a right-to-left page they mirror.
  const outward = side === "left" ? "chevron-back" : "chevron-forward";
  const inward = side === "left" ? "chevron-forward" : "chevron-back";

  if (folded) {
    return (
      <section className="pane rail" aria-label={spec.title}>
        <button
          type="button"
          className="icon-btn flip-rtl"
          aria-label={`${tw("pane.expand")} — ${spec.title}`}
          title={tw("pane.expand")}
          onClick={() => onFold?.(false)}
        >
          <Icon name={inward} size={18} />
        </button>
        <span className="rail-ico">
          <Icon name={spec.icon} size={18} />
        </span>
        <span className="rail-label">{spec.title}</span>
      </section>
    );
  }

  const collapse = onFold ? (
    <button
      type="button"
      className="icon-btn flip-rtl"
      aria-label={`${tw("pane.collapse")} — ${spec.title}`}
      title={tw("pane.collapse")}
      onClick={() => onFold(true)}
    >
      <Icon name={outward} size={18} />
    </button>
  ) : null;

  return (
    <section className="pane" aria-label={spec.title}>
      <header className="pane-head">
        {side === "right" && collapse}
        <div className="pane-title grow">{spec.head ?? spec.title}</div>
        {spec.actions}
        {side === "left" && collapse}
      </header>
      <div className="pane-body">{spec.body}</div>
      {spec.foot && <div className="pane-foot">{spec.foot}</div>}
    </section>
  );
}

/** The body of a pane that has nothing to show yet, and says why. */
export function PaneEmpty({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="pane-empty">
      <Icon name={icon} size={24} />
      {children}
    </div>
  );
}
