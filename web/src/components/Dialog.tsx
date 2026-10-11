import { useEffect, type FormEvent, type ReactNode } from "react";

/**
 * A modal dialog: a scrim that closes on click and on Escape, a card that does
 * not. `onSubmit` makes the card a form, so Enter confirms.
 */
export function Dialog({
  title,
  onClose,
  onSubmit,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  onSubmit?: () => void;
  children?: ReactNode;
  footer: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit?.();
  };

  return (
    <div className="scrim" onClick={onClose}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <h2 className="headline">{title}</h2>
        {children}
        <footer>{footer}</footer>
      </form>
    </div>
  );
}
