import { useI18n } from "../i18n/I18nProvider";
import { useSession } from "../session/SessionProvider";
import { Icon } from "../components/Icon";

/**
 * My account, until task-484 builds its settings sidebar: who is signed in,
 * and the one action a session needs from day one, signing out.
 */
export function AccountPage() {
  const { t, tw } = useI18n();
  const { user, signOut } = useSession();
  return (
    <main className="page">
      <h1 className="display">{tw("nav.account")}</h1>
      <p className="subtle">{user?.email}</p>
      <button type="button" className="btn tonal" onClick={() => void signOut()}>
        <Icon name="log-out-outline" size={18} />
        {t("account.signOut")}
      </button>
    </main>
  );
}
