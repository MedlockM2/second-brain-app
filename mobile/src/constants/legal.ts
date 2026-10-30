/**
 * The legal surfaces the app has to link to, in one place.
 *
 * Apple's guideline 3.1.2 and Google Play's subscription policy both require the
 * **purchase screen itself** to carry working links to the terms of use and the
 * privacy policy — metadata entered in App Store Connect or the Play Console does
 * not satisfy it, and a paywall missing them is one of the most common rejection
 * reasons. They were nowhere in the binary before, which is why they live here
 * rather than inline: the paywall and the deletion screen must point at the same
 * addresses.
 *
 * Until the domain is bought (task-443), the privacy policy is served on the
 * default CloudFront name of the prod `www` distribution
 * (`infrastructure/terraform/modules/platform/www.tf`), published from
 * `docs/compliance/privacy-policy.md` by `scripts/publish_legal_site.sh`. Deepn
 * publishes no terms of use of its own: Apple requires them only for an
 * auto-renewable subscription, and without a custom EULA its standard one applies
 * (owner amendment of 2026-10-30 in
 * `docs/research/task-357-legal-pages-hosting/README.md`). The switch to
 * `www.<domaine>`, and terms of Deepn's own if the paywall ships, are a gate of
 * the production submission (task-454). These are JS constants: an OTA update
 * changes them without a new build.
 */
import { Platform } from "react-native";

export const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

export const PRIVACY_POLICY_URL = "https://d3fc24zfw6pew8.cloudfront.net/privacy";

/**
 * Where a subscription is actually cancelled. The app cannot cancel one itself —
 * only the store can — so every "cancel anytime" sentence points here.
 */
export const STORE_SUBSCRIPTIONS_URL =
  Platform.OS === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions";

/** The store that bills the subscription, for copy that has to name it. */
export const STORE_NAME = Platform.OS === "ios" ? "App Store" : "Play Store";

/**
 * Same address as the "Access / Portability" section of the privacy policy: the
 * app has no self-service export, so this is the only route to a data copy and
 * the two must not drift.
 */
export const PRIVACY_CONTACT_EMAIL = "deepn.support@gmail.com";
