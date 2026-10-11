import { LogoMark } from "../components/Logo";
import { Config } from "../config";
import { useI18n } from "../i18n/I18nProvider";

/**
 * What a screen narrower than 900 px gets instead of the app (owner decision
 * of 2026-10-11, points 1 and 6): the name, one sentence, the two stores — and
 * no way through to the desktop layout. The phone layout of the mockup is for
 * later.
 */
export function InstallPage() {
  const { tw } = useI18n();
  const store = (href: string, label: string) => (
    <a
      className="btn primary"
      href={href || undefined}
      aria-disabled={href ? undefined : true}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
    </a>
  );

  return (
    <main className="install">
      <LogoMark large />
      <h1 className="display">Deepn</h1>
      <p className="subtle">{tw("install.lead")}</p>
      <div className="install-stores">
        {store(Config.APP_STORE_URL, tw("install.appStore"))}
        {store(Config.PLAY_STORE_URL, tw("install.googlePlay"))}
      </div>
    </main>
  );
}
