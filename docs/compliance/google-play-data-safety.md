# Google Play Data Safety Declaration

**Deepn — Second Brain Labs**
**Last updated:** 2026-10-30

Reference answers for Play Console, aligned with [Privacy Policy](privacy-policy.md). Editing this file does not update Play Console.

## Overview Answers

| Question | Answer |
|----------|--------|
| Does your app collect or share any required user data types? | Yes |
| Is all collected user data encrypted in transit? | Yes — HTTPS/TLS 1.2+ |
| Can users request deletion of their data? | Yes — individual items and full accounts |

## Privacy Policy and Account Deletion URLs

For the pre-beta review, use the published default CloudFront domain selected in [task-357](../research/task-357-legal-pages-hosting/README.md). Retrieve the base URL with:

```sh
terraform -chdir=infrastructure/terraform/envs/prod output -raw www_base_url
```

- **Privacy policy URL:** append `/privacy` to that base URL.
- **Account deletion URL:** append `/privacy#delete-account` to that base URL.
- **Privacy/deletion contact:** deepn.support@gmail.com.

Verify the public page loads without sign-in and that its deletion section is directly reachable. Use the same privacy URL in the app. Published on 2026-10-30: privacy **https://d3fc24zfw6pew8.cloudfront.net/privacy**, account deletion **https://d3fc24zfw6pew8.cloudfront.net/privacy#delete-account**.

## Data Collected

Every row below is **collected** and **not processed only ephemerally**. Stored content, logs and diagnostics remain after the immediate request. The required/optional answer describes whether users can avoid that category while still using Deepn; automatic collection without a user choice is required.

| Play Console category / type | Shared | Required or optional | Collection purposes | What Deepn collects |
|------------------------------|--------|----------------------|---------------------|---------------------|
| Personal info / Email address | No | Required | App functionality; Account management | Account email or Apple private relay address; support contact and Canny SSO email |
| Personal info / Name | No | Optional | App functionality | Display name sent when the user opens Canny; currently derived from the email prefix |
| Personal info / User IDs | No | Required | App functionality; Account management | Account ID, social sign-in identifiers, RevenueCat customer association and library ownership identifiers |
| Financial info / Purchase history | No | Optional | App functionality; Account management | Purchase and subscription status received through RevenueCat when present; no payment-card details |
| Messages / Other in-app messages | No | Optional | App functionality | Questions and answers in the in-app assistant chat |
| Photos and videos / Photos | No | Optional | App functionality | Images selected, captured or shared for import, plus image attachments to bug reports |
| Audio files / Voice or sound recordings | Yes | Optional | App functionality | Imported recordings sent for transcription |
| Audio files / Music files | Yes | Optional | App functionality | User-provided music files accepted by the audio import flow |
| Audio files / Other audio files | Yes | Optional | App functionality | Other imported audio files accepted for transcription |
| Files and docs / Files and docs | No | Optional | App functionality | Imported documents, file names and support attachments |
| App activity / App interactions | No | Required | App functionality; Analytics | Processing usage for plan limits; recent screens and events in Sentry diagnostics |
| App activity / In-app search history | No | Optional | App functionality | Transcript queries sent to the backend and Algolia; query text also appears in backend search logs |
| App activity / Other user-generated content | No | Required | App functionality | Saved links/text, generated content, folders, feeds and settings; optional support descriptions and feedback |
| App info and performance / Crash logs | No | Required | Analytics | Automatic Sentry crash/error reports; no in-app opt-out is currently exposed |
| App info and performance / Diagnostics | No | Required | Analytics; Fraud prevention, security, and compliance | Sentry performance/device/app context and backend request/security logs |
| Device or other IDs | No | Required | App functionality; Fraud prevention, security, and compliance | Server-log IP addresses; optional Expo push tokens linked to the account |

**Device or other IDs:** the category is required because server requests record IP addresses. The push-token part is optional and exists only if notifications are allowed. Tokens deliver digest and processing-complete notifications, not advertising. No Android Advertising ID is collected, and IP addresses are not used to infer location.

**Purchase history:** the row covers the purchase/subscription flow where a purchase exists; beta access itself is not a purchase. Purchase status is distinct from card details, which Apple or Google handle directly.

**Other user-generated content:** saving and organizing content is the core service. Individual formats, chat and support submissions remain user-selected. Do not describe all collection as optional simply because users can stop using the app.

## Transfers and the “Shared” Answers

“Shared” in the Play form is narrower than “sent to another company.” A transfer to a provider acting only on Deepn's instructions can qualify for Google's service-provider exception, while still counting as collection. The **No** entries above use that exception for the service-provider flows described by the privacy policy. Expo push delivery therefore does not require a blanket **Shared: Yes** answer for device IDs.

The audio rows use **Shared: Yes** because policy section 4.3 permits Deepgram to retain audio for its own model improvement. Do not apply the service-provider exception to that independent purpose. For those rows, select **Analytics** as the sharing purpose for model improvement, in addition to **App functionality** for transcription. These reference answers follow the currently disclosed practice; they do not change provider settings.

| Provider / recipient | Data transferred | Function |
|----------------------|------------------|----------|
| Amazon Web Services, including Cognito | Account, stored content/files, sign-in and server logs | Hosting, storage and authentication |
| OpenAI | Content text, transcripts and chat messages | AI generation and chat |
| Deepgram | Media audio and imported audio files | Transcription; retention/model improvement as disclosed in policy section 4.3 |
| LlamaParse, Unstructured | Documents and images | Text extraction |
| Apify, X API, public websites and podcast directories | Public links or titles needed to find content | Public content retrieval |
| Algolia | Account ownership identifier, titles, creators, transcripts and search queries | Library search |
| RevenueCat, Apple and Google stores | Customer/account identifiers and purchase/subscription status | Purchase management |
| Expo, FCM | Push token, generic notification text and internal item identifier | Notification delivery |
| Sentry | Crash/error reports, performance measurements and device/app context | Diagnostics |
| Canny | Account ID, email, display name and feedback | User-opened feedback board |
| Apple and Google sign-in | Sign-in data | Authentication |

The provider table is a transfer inventory, not a promise that each provider immediately deletes everything it receives. Absence of model training does not imply absence of retention. The privacy policy describes provider practices; its 30-day crash-report and server-log periods replace the previous six-month reference in this document.

## Data Not Collected Through Dedicated App Features

- Location, including location inferred from IP addresses
- Contacts, calendar and installed-app inventory
- Health, fitness and biometric data
- Payment-card/bank details and credit scores
- Email inboxes and SMS/MMS
- Browser activity outside explicitly submitted content
- Advertising identifiers or ad-interaction data

Chat is declared under **Other in-app messages**, not excluded with email and SMS. Image, document and audio imports are collected even when they arrive through the system share sheet. Deepn does not offer general device-video imports; public video links are submitted content.

User-provided files and messages may themselves contain personal or sensitive information. The list above does not promise automatic removal of such details.

## Security Practices

| Practice | Answer |
|----------|--------|
| Encryption in transit | Yes — HTTPS/TLS 1.2+ |
| Encryption at rest | AWS-managed encryption, as described in the policy |
| Local sign-in token storage | Android Keystore through `expo-secure-store` |
| Data deletion | In-app and external account-deletion request path |
| Independent security review | Do not claim certification or an independent review from this document |

## Data Deletion and Retention

- **Individual items:** hidden from the library and search immediately, permanently erased about 30 days later. Technical processing records remain until account deletion.
- **Full account, in-app:** Account > Delete Account > confirm. The account and live user data are erased immediately.
- **Without the app:** email **deepn.support@gmail.com** from the account email, subject **Delete my Deepn account**. Completed within 30 days, with email confirmation.
- **Public shared content:** public transcripts/files still used by another account remain without the deleted user's association.
- **Backups:** expire within 35 days for continuous backups, 90 days for weekly snapshots and 365 days for monthly archives. Do not describe all backups as expiring within 35 days.
- **Other retention:** usage records up to 400 days; crash reports and server logs up to 30 days. Push tokens are removed on sign-out, account deletion, invalidation or after 90 days without renewal. Legally required records may remain.
- **Subscriptions:** deleting an account does not cancel a store subscription; users cancel it in Apple/Google subscription settings.

See privacy policy sections 6 and 7 for the full disclosure. No separate retention of aggregated analytics is asserted here.

## Play Console Entry Reference

1. Use the overview answers above and enter both public URLs.
2. Add every data type in the collection table, including User IDs, purchases, chat, photos, audio, documents and search queries.
3. Copy each row's required/optional, ephemeral and purpose answers; use the sharing explanation for audio.
4. Do not mark automatic crash/diagnostic collection optional without a user control that actually avoids it.
5. Verify these reference answers against the final build and provider configuration when submitting. This document does not assert that the console has already been updated.

## Sources and Implementation References

- [Google Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) — form categories, purposes, required/optional and sharing exceptions, checked 2026-10-30.
- [Google account deletion guidance](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) — external deletion resource.
- [Privacy Policy](privacy-policy.md) — recipients and retention/deletion terms.
- `mobile/src/services/uploadService.ts`, `mobile/src/services/purchaseService.ts`, `mobile/src/services/searchService.ts`, `mobile/src/lib/crashReporting.ts`.
- `media_summarizer/api/endpoints/feedback.py`, `media_summarizer/api/endpoints/search.py`, `media_summarizer/core/services/search_indexing.py`.
