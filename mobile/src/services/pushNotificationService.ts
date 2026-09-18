/**
 * Device registration for push notifications — the client half of the delivery
 * path task-368 settled on: **Expo Push Service, one token per device**.
 *
 * The app's entire role is to obtain that token and hand it to the backend. It
 * never sends a notification, never schedules one locally and never polls: the
 * decision of *when* something is worth announcing belongs to the backend —
 * `workers/digest/scheduler.py`, which knows the account's time zone and the
 * contents of the period, and `workers/events/media_completed_worker.py`, which
 * knows when a saved media became readable.
 *
 * **A refusal is a normal outcome, not a failure.** Every path here resolves to
 * one of three outcomes, none of them throws at the caller for a permission
 * reason, and nothing in the interface changes when the answer is no: the app is
 * fully usable without notifications, there is no explanatory modal, no banner
 * inviting the user to reconsider and no deep link into the system settings. The
 * OS prompt is shown **at most once per process**, and never at all once the OS
 * says the question is closed — see `ensurePermission`.
 *
 * **The token is a credential.** Anyone holding it can push to that device. It is
 * never logged, never put in a route param, never rendered, and the only copy the
 * app keeps is the module-level memo below — which exists for exactly one reason:
 * sign-out has to be able to name the row it is deleting.
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiRequest } from "./apiClient";
import { Config } from "../constants/config";
import { t } from "../i18n";

/**
 * What one registration attempt concluded.
 *
 * `unavailable` and `denied` are deliberately distinct even though the app
 * behaves identically in both: only the second one means the user was asked.
 */
export type PushRegistrationOutcome = "registered" | "denied" | "unavailable";

/**
 * The `data.type` of a notification announcing that a saved media finished
 * processing (task-404, livrable D).
 *
 * Read in two places, which is why it is exported: `useProcessingRefresh`, which
 * turns one arriving in the foreground into a silent re-read of the list, and
 * `usePushNotifications`, which routes a tap on it to the media rather than to the
 * Digest. The producer is `enqueue_media_ready_notification` in
 * `media_summarizer/core/services/push_notification_dispatch.py`.
 */
export const MEDIA_READY_NOTIFICATION_TYPE = "media_ready";

/**
 * The Android notification channel each kind of notification belongs to.
 *
 * The same two strings are in
 * `media_summarizer/core/services/push_notification_dispatch.py`, which puts one
 * of them in the `channelId` of the Expo payload. A channel id Android does not
 * know falls back to expo-notifications' own "Miscellaneous" channel, so a
 * mismatch would not lose the notification — it would file it under a category
 * the user cannot recognise, and the per-category mute Android offers would stop
 * working.
 *
 * Two channels rather than one because that mute is per channel: someone who is
 * happy to be told a source is ready but does not want a daily Digest has to be
 * able to say so, and a single category would make it one choice for both.
 */
const ANDROID_CHANNEL_DIGEST = "digest";
const ANDROID_CHANNEL_MEDIA_READY = MEDIA_READY_NOTIFICATION_TYPE;

/**
 * The token this process registered, or null.
 *
 * Module scope rather than React state because it outlives every component that
 * could hold it and is read from `AuthContext.logout`, which is not a screen.
 */
let registeredToken: string | null = null;

/**
 * Whether the OS permission prompt has already been shown in this process.
 *
 * This is what "no insistent re-prompt" is made of. `canAskAgain` alone is not
 * enough: on Android the system allows a second request before it locks the
 * answer, so a hook that retries on every return to the foreground would ask
 * twice. Once per process, and the retries past that only ever *read* the
 * permission — which is what still lets a user who granted it later, in the
 * system settings, get registered on their next foreground pass.
 */
let hasRequestedPermission = false;

/**
 * How a notification arriving while the app is open should behave.
 *
 * Set at import time, before anything can arrive. A Digest is **shown**, because
 * one that lands while the user is in the app is the same information as one that
 * lands on the lock screen, and tapping it is how they get to it.
 *
 * A "media ready" notification is **not**: the user is already looking at the app,
 * and what they want from it is the vignette settling, not a banner telling them
 * to open a screen they have open. `useProcessingRefresh` listens for the same
 * notification and re-reads the list silently, which is the whole of its
 * foreground behaviour (task-404, livrable D). Suppressing it here is also what
 * keeps the guarantee honest when the poll's budget is spent: a media that took
 * ten minutes still resolves on screen, because the push arrives whatever the
 * processing duration.
 *
 * Silent and badgeless in both cases: nothing in this app ever sets a badge count
 * — so asking for the badge permission would be asking for something unused.
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const silent =
      notification.request.content.data?.type === MEDIA_READY_NOTIFICATION_TYPE;
    return {
      shouldShowBanner: !silent,
      // Not in the shade either: a notification the user cannot act on any better
      // than by looking at the screen they are on has nothing to be kept for.
      shouldShowList: !silent,
      shouldPlaySound: false,
      shouldSetBadge: false,
    };
  },
});

/** The platform value the backend records, or null off a real device platform. */
function devicePlatform(): "ios" | "android" | null {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return null;
}

/**
 * Create the two channels on Android. A no-op everywhere else.
 *
 * Before the token is ever requested, so no notification can reach the device
 * ahead of the channel it names. Creating a channel that already exists is how
 * the platform expects the call to be made — only the name and the description of
 * an existing channel can change afterwards, everything else the user owns from
 * then on, which is why importance is set once and never adjusted.
 */
async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_DIGEST, {
    // The category label in Android's per-app notification settings. Reuses the
    // tab's own name so the user recognises what they are muting.
    name: t("tabs.digest"),
    // DEFAULT, not HIGH: a Digest belongs in the shade, not in a heads-up banner
    // over whatever the person is doing.
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_MEDIA_READY, {
    name: t("notifications.mediaReadyChannel"),
    // DEFAULT for the same reason, and it is the ceiling of what this one deserves
    // anyway: the user asked for the media, so its arrival is expected news.
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Whether this app may post notifications, asking at most once. */
async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (hasRequestedPermission || !current.canAskAgain) return false;

  hasRequestedPermission = true;
  const requested = await Notifications.requestPermissionsAsync({
    // No `allowBadge`: nothing in this app sets a badge count, and a permission
    // asked for and never used is one the user was asked for under false
    // pretences.
    ios: { allowAlert: true, allowSound: true },
  });
  return requested.granted;
}

/**
 * Register this device for the signed-in account.
 *
 * Throws only on a failure of the API call itself — a network error, or a session
 * the backend refused. The caller treats that as "not registered yet" and tries
 * again on the next return to the foreground.
 */
export async function registerForPushNotifications(): Promise<PushRegistrationOutcome> {
  const platform = devicePlatform();
  if (!platform || !Config.EAS_PROJECT_ID) return "unavailable";

  await ensureAndroidChannels();

  if (!(await ensurePermission())) return "denied";

  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync({
      projectId: Config.EAS_PROJECT_ID,
    });
    token = result.data;
  } catch {
    // No push capability behind this JS bundle. A simulator with no APNs
    // registration is the everyday case, an Expo Go run or a device that could
    // not reach Expo's servers are the others — all three mean "there is no token
    // to send", and none of them is an error the user should ever hear about.
    return "unavailable";
  }

  await apiRequest<void>("/api/push-token", {
    method: "POST",
    body: { expo_push_token: token, platform },
  });
  registeredToken = token;
  return "registered";
}

/**
 * Forget this device on the way out of an account.
 *
 * Called from `AuthContext.logout` *before* the session is torn down, because it
 * needs that session to authenticate. Skipping it would leave the device
 * registered under the account that signed out: a second account signing in on
 * the same phone would register the same token again, and the first account's
 * Digest notification would then land on a screen the second one is looking at.
 *
 * The memo is cleared before the call rather than after, so a DELETE that fails
 * offline still leaves the app in the honest state — this process no longer
 * claims to hold a registration — and the next sign-in re-registers cleanly.
 */
export async function unregisterCurrentDevice(): Promise<void> {
  const token = registeredToken;
  if (!token) return;
  registeredToken = null;

  await apiRequest<void>("/api/push-token", {
    method: "DELETE",
    body: { expo_push_token: token },
  });
}
