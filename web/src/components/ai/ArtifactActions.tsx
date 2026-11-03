import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MAX_ARTIFACT_TITLE_LENGTH } from "@media-summarizer/core/types/artifacts";
import { useI18n } from "../../i18n/I18nProvider";
import { Dialog } from "../Dialog";
import { Icon } from "../Icon";

/** The folder menu's desktop pattern, also available with a right click. */
export function ArtifactActions({ title, onRename, onDelete, children, className = "" }: {
  title: string;
  onRename: (title: string) => Promise<void>;
  onDelete: () => Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState<"menu" | "rename" | "delete" | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const busyRef = useRef(false);
  const anchor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const openMenu = () => {
    if (busyRef.current) return;
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuAnchor(rect);
    setPosition({ left: Math.max(12, rect.right - 220), top: rect.bottom + 4 });
    setOpen("menu");
  };
  useLayoutEffect(() => {
    if (open !== "menu" || !menuAnchor || !menu.current) return;
    const { width, height } = menu.current.getBoundingClientRect();
    setPosition({
      left: Math.max(12, Math.min(menuAnchor.right - width, window.innerWidth - width - 12)),
      top: menuAnchor.bottom + height + 4 <= window.innerHeight - 12
        ? menuAnchor.bottom + 4 : Math.max(12, menuAnchor.top - height - 4),
    });
  }, [open, menuAnchor]);
  const close = () => {
    if (busyRef.current) return;
    setOpen(null); setError(false); trigger.current?.focus();
  };
  useEffect(() => {
    if (open !== "menu") return;
    const outside = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(null); trigger.current?.focus(); } };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const submit = async () => {
    if (busyRef.current || (open === "rename" && !draft.trim())) return;
    busyRef.current = true; setBusy(true); setError(false);
    try {
      if (open === "rename") { if (draft.trim() !== title) await onRename(draft.trim()); }
      else await onDelete();
      setOpen(null); trigger.current?.focus();
    } catch { setError(true); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const rename = () => { setDraft(title); setError(false); setOpen("rename"); };
  return (
    <div className={`artifact-action-target ${className}`} onContextMenu={event => {
      if (open === "rename" || open === "delete") return;
      event.preventDefault(); openMenu();
    }}>
      {children}
      <div className="menu-anchor" ref={anchor}>
        <button ref={trigger} type="button" className="icon-btn" aria-label={t("artifactActions.moreA11y")}
          aria-haspopup="menu" aria-expanded={open === "menu"} onClick={() => open === "menu" ? setOpen(null) : openMenu()}>
          <Icon name="ellipsis-horizontal" />
        </button>
        {open === "menu" && createPortal(<div ref={menu} className="menu" role="menu"
          style={{ position: "fixed", insetInlineEnd: "auto", width: 220, ...position }}
          onKeyDown={event => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
          }}>
          <button type="button" role="menuitem" autoFocus onClick={rename}><Icon name="pencil-outline" size={18} />{t("mediaActions.rename.label")}</button>
          <button type="button" role="menuitem" className="danger" onClick={() => { setError(false); setOpen("delete"); }}><Icon name="trash-outline" size={18} />{t("common.delete")}</button>
        </div>, document.body)}
      </div>
      {(open === "rename" || open === "delete") && createPortal(<Dialog
        title={t(open === "rename" ? "artifactActions.rename.title" : "artifactActions.deleteTitle")}
        onClose={close} onSubmit={() => void submit()}
        footer={<>
          <button type="button" className="btn ghost" autoFocus={open === "delete"} disabled={busy} onClick={close}>{t("common.cancel")}</button>
          <button type="submit" className={`btn ${open === "delete" ? "danger" : "primary"}`} disabled={busy || (open === "rename" && !draft.trim())}>
            {t(busy ? "common.loading" : open === "rename" ? "common.save" : "common.delete")}
          </button>
        </>}>
        {open === "rename" ? <label className="field">
          <span>{t("artifactActions.rename.placeholder")}</span>
          <input autoFocus maxLength={MAX_ARTIFACT_TITLE_LENGTH} value={draft} disabled={busy}
            onChange={event => { setDraft(event.target.value); setError(false); }} />
        </label> : <p>{t("artifactActions.deleteBody", { title })}</p>}
        {error && <div className="banner-err" role="alert">{t(open === "rename" ? "artifactActions.renameFailed" : "artifactActions.deleteFailed")}</div>}
      </Dialog>, document.body)}
    </div>
  );
}
