import { Icon } from "./Icon";

export function LogoMark({ large }: { large?: boolean }) {
  return (
    <span className={large ? "logo-mark lg" : "logo-mark"}>
      <Icon name="layers-outline" size={18} />
    </span>
  );
}
