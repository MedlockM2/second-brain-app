import type { UnsortedCountResponse } from "@media-summarizer/core/types/organization";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router";
import { apiRequest } from "../api";
import { notifyMediaSaved, useOnMediaSaved } from "../lib/mediaSaved";
import { AddFlowContext, useAddFlow } from "./AddFlow";
import { useI18n } from "../i18n/I18nProvider";
import { useTheme } from "../theme";
import { Icon } from "./Icon";
import { LogoMark } from "./Logo";

/**
 * The horizontal bar of the owner's direction (mockup `appbar()` in
 * dir_owner.js): logo, Home, Library, Digest, Unsorted · N, full-text search,
 * Add, theme, My account. Each destination is a route the screen tasks fill.
 */
export function AppShell() {
  const { t, tw } = useI18n();
  const { scheme, toggle } = useTheme();
  const location = useLocation();
  const unsorted = useUnsortedCount(location.pathname);
  const add = useAddFlow(notifyMediaSaved);
  useDropAndPaste(add.open);

  const tab = (to: string, label: string, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) => (isActive ? "tab active" : "tab")}>
      {label}
    </NavLink>
  );

  return (
    <div className="shell">
      <header className="bar">
        <Link to="/" className="logo">
          <LogoMark />
          <b className="headline">Deepn</b>
        </Link>
        <nav className="tabs" aria-label={tw("nav.mainA11y")}>
          {tab("/", t("tabs.home"), true)}
          {tab("/library", tw("nav.library"))}
          {tab("/digest", t("tabs.digest"))}
          {tab(
            "/unsorted",
            unsorted === null ? tw("nav.unsortedNoCount") : tw("nav.unsorted", { count: unsorted }),
          )}
        </nav>
        <span className="grow" />
        <SearchField />
        <button type="button" className="btn primary" onClick={() => add.open()}>
          <Icon name="add" size={18} />
          <span>{tw("nav.add")}</span>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={tw(scheme === "dark" ? "nav.themeToLight" : "nav.themeToDark")}
          onClick={toggle}
        >
          <Icon name={scheme === "dark" ? "sunny-outline" : "moon-outline"} size={18} />
        </button>
        <NavLink
          to="/account"
          className={({ isActive }) => (isActive ? "icon-btn account active" : "icon-btn account")}
          aria-label={tw("nav.account")}
          title={tw("nav.account")}
        >
          <Icon name="person-outline" size={18} />
        </NavLink>
      </header>
      <div className="shell-body">
        <AddFlowContext.Provider value={add.open}>
          <Outlet />
        </AddFlowContext.Provider>
      </div>
      {add.node}
    </div>
  );
}

/**
 * Anywhere in the app: a dropped file opens the add dialog with it, and a
 * paste outside a text field opens it with what was pasted (a link, or a text
 * that becomes a note). Inside a field, a paste stays the field's.
 */
function useDropAndPaste(open: (preset: { file?: File | null; text?: string }) => void) {
  useEffect(() => {
    const isField = (target: EventTarget | null) =>
      target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      const file = event.dataTransfer?.files?.[0];
      // A drop inside the add dialog's own zone is that dialog's.
      if (!file || event.defaultPrevented) return;
      event.preventDefault();
      open({ file });
    };
    const onPaste = (event: ClipboardEvent) => {
      if (isField(event.target) || document.querySelector(".scrim")) return;
      const file = event.clipboardData?.files?.[0];
      const text = event.clipboardData?.getData("text")?.trim();
      if (!file && !text) return;
      event.preventDefault();
      open(file ? { file } : { text });
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [open]);
}

/** The figure of the Unsorted tab, re-read on every navigation; null until known. */
function useUnsortedCount(pathname: string): number | null {
  const [count, setCount] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  useOnMediaSaved(useCallback(() => setRound((n) => n + 1), []));
  useEffect(() => {
    let cancelled = false;
    apiRequest<UnsortedCountResponse>("/api/folders/unsorted-count")
      .then((response) => {
        if (!cancelled) setCount(response.media_count);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname, round]);
  return count;
}

/** Full-text search: submitting opens the search route with the query. */
function SearchField() {
  const location = useLocation();
  const [params] = useSearchParams();
  const current = location.pathname === "/search" ? (params.get("q") ?? "") : "";
  // Keyed by the query in the URL, so leaving the search route clears the field.
  return <SearchForm key={current} initial={current} />;
}

function SearchForm({ initial }: { initial: string }) {
  const { tw } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState(initial);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <form role="search" onSubmit={onSubmit}>
      <label className="field bar-search">
        <Icon name="search-outline" size={18} />
        <input
          type="search"
          placeholder={tw("nav.searchPlaceholder")}
          aria-label={tw("nav.searchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
    </form>
  );
}
