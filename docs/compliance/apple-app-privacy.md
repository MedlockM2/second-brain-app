# Apple App Privacy Disclosures

**Deepn — Second Brain Labs**
**Last updated:** 2026-10-30

Reference answers for App Store Connect, aligned with [Privacy Policy](privacy-policy.md). Editing this file does not update App Store Connect.

## Privacy Policy URL

Use the published HTTPS URL ending in `/privacy`. For the pre-beta review, the owner's decision in [task-357](../research/task-357-legal-pages-hosting/README.md) uses the default CloudFront domain. Retrieve the base URL with:

```sh
terraform -chdir=infrastructure/terraform/envs/prod output -raw www_base_url
```

Append `/privacy`, verify the page is publicly accessible, and use that same URL in the app and App Store Connect. Published on 2026-10-30: **https://d3fc24zfw6pew8.cloudfront.net/privacy** (republish after any edit of `privacy-policy.md` with `AWS_PROFILE=prod scripts/publish_legal_site.sh prod`).

**Privacy contact:** deepn.support@gmail.com

## Data Collection Declaration

**Do you or your third-party partners collect data from this app? Yes.**

The inventory includes data sent through the backend and stored by service providers, not only data collected by SDKs in the mobile binary. Optional imports and support submissions are included below.

## Data Types Collected

All rows below are **collected** and **not used for tracking**. Select the purposes in each row.

| App Store Connect category / type | Linked to identity | Purpose | What Deepn collects |
|-----------------------------------|--------------------|---------|---------------------|
| Contact Info / Email Address | Yes | App Functionality | Account email or Apple private relay address; support contact; email sent to Canny when the feedback board is opened |
| Contact Info / Name | Yes | App Functionality | Display name sent to Canny when the feedback board is opened; the current backend derives it from the email prefix |
| User Content / Photos or Videos | Yes | App Functionality | Images imported from the photo picker, camera or share sheet, including images attached to bug reports; this does not mean access to the entire photo library |
| User Content / Audio Data | Yes | App Functionality; Other Purposes | Audio files imported for transcription; provider model improvement as described in privacy policy section 4.3 |
| User Content / Emails or Text Messages | Yes | App Functionality | Questions and answers stored in the in-app chat |
| User Content / Customer Support | Yes | App Functionality | Support requests, bug reports, descriptions and attachments, and feedback board submissions |
| User Content / Other User Content | Yes | App Functionality | Submitted links, text, documents and file metadata; transcripts, translations, summaries, notes, flashcards, review prompts and digests; folders, followed feeds and settings |
| Search History / Search History | Yes | App Functionality | In-app transcript search queries sent to the backend and Algolia; query text can also appear in backend search logs |
| Identifiers / User ID | Yes | App Functionality | Account ID, Apple/Google sign-in identifiers, RevenueCat customer association and Algolia ownership filters |
| Identifiers / Device ID | Yes | App Functionality | Expo push token linked to the signed-in account, only when notifications are allowed |
| Purchases / Purchase History | Yes | App Functionality | Store purchase and subscription status received through RevenueCat, where present; no card or bank details |
| Usage Data / Product Interaction | Yes | App Functionality | Processing usage used to enforce plan limits; saved-content activity and review/digest settings. Recent screens and events also appear in Sentry diagnostics without an attached account ID |
| Diagnostics / Crash Data | No | App Functionality | Sentry crash and error reports, stack traces and device/app context |
| Diagnostics / Performance Data | No | App Functionality | Sentry launch, navigation, hang and network timing measurements |
| Diagnostics / Other Diagnostic Data | Yes | App Functionality | Server request/security logs, including request time and endpoint; authenticated operations can be associated with the account |
| Other Data / Other Data Types | Yes | App Functionality | IP addresses in server logs, used for operation and security, without location inference |

The photo/video category covers image uploads; Deepn does not offer a general device-video upload flow. Public video links are included under Other User Content.

The linked answer for a type is **Yes** when any collection of that type is linked to an account. It does not mean an account identifier is attached to Sentry reports. The current `mobile/src/lib/crashReporting.ts` sets `sendDefaultPii: false`, does not call `Sentry.setUser`, and removes HTTP query strings from breadcrumbs.

Purchase History describes the purchase/subscription path in the current app. Beta access does not itself constitute a paid purchase; do not infer that payment-card data is collected from the presence of RevenueCat.

## Data Not Collected Through Dedicated App Features

- Location, including location inferred from IP addresses
- Device contacts, calendars, health/fitness or biometric data
- Payment-card or bank-account details
- Advertising identifiers or advertising exposure data
- Installed-app inventory

User-selected documents, photos and messages can themselves contain personal or sensitive information. The list above does not promise that submitted content is stripped of those details.

Saved links are content explicitly submitted to Deepn; the app does not monitor the user's browser history. Search History is declared separately because in-app queries are sent to the backend; they are not processed only on the device.

## Tracking Declaration

**Does your app track users? No.**

No cross-company advertising tracking, advertising identifiers, data-broker transfers or advertising SDKs are used. Do not select a tracking purpose for the types above. The app does not use AppTrackingTransparency.

## Third-Party SDKs and Services

The complete recipient inventory and data flows are in privacy policy sections 4.1–4.5:

| Provider | Data involved | Use |
|----------|---------------|-----|
| Amazon Web Services, including Cognito | Stored account/content data, files, sign-in and server logs | Hosting, storage and authentication |
| OpenAI | Content text, transcripts and chat messages | AI-generated content and chat |
| Deepgram | Audio from submitted media and imported files | Transcription; retention/model improvement described in policy section 4.3 |
| LlamaParse, Unstructured | Imported documents and images | Text extraction |
| Apify, X API, public websites and podcast directories | Submitted public links or search titles | Retrieving public content |
| Algolia | Account ownership identifier, titles, creators, transcripts and search queries | Library search |
| RevenueCat, Apple and Google stores | Account/customer identifiers, purchase and subscription status | Purchase and entitlement management |
| Expo, APNs | Push token, generic notification text and internal item identifier | Digest and processing-complete notifications |
| Sentry | Crash, error and performance reports | Stability diagnostics |
| Canny | Account ID, email, display name and submitted feedback | Feedback board, when opened |
| Apple and Google sign-in | Sign-in data | Authentication |

Not using an AI provider's SDK in the binary does not remove the backend data flow from this inventory. Model-training practices do not by themselves establish a provider's retention period.

## Retention and Deletion

Use privacy policy sections 6 and 7 for the full terms:

- Items disappear from the library and search immediately when deleted; permanent erasure occurs about 30 days later. Technical processing records remain until account deletion.
- In-app account deletion erases the account and its live user data immediately. Public transcripts/files still used by another account remain without the deleted user's association.
- Without the app, users can request account deletion from their account email at **deepn.support@gmail.com**, subject **Delete my Deepn account**; requests are completed within 30 days and confirmed by email.
- Usage records expire within 400 days; crash reports and server logs within 30 days. Push tokens are removed on sign-out, account deletion, invalidation or after 90 days without renewal.
- Backup expiry is up to 35 days for continuous backups, 90 days for weekly snapshots and 365 days for monthly archives. Legally required records may remain.
- Account deletion does not cancel an Apple or Google subscription.

## App Store Connect Entry Reference

1. Answer **Yes** to data collection.
2. Enter the published privacy policy URL described above.
3. Add every data type from the table, using its linked status and purposes; answer **No** to tracking for each.
4. Check that the final binary and configured provider behavior still match this inventory before submitting the answers.

Authentication tokens use iOS Keychain through `expo-secure-store`. Content received through a share sheet is part of the declared content flow; it is not a reason to exclude that content from the label.

## Sources and Implementation References

- [Apple App Privacy details](https://developer.apple.com/app-store/app-privacy-details/) — categories, purposes and collection definitions, checked 2026-10-30.
- [Privacy Policy](privacy-policy.md) — provider, retention and deletion disclosures.
- `mobile/src/services/uploadService.ts`, `mobile/src/services/purchaseService.ts`, `mobile/src/services/searchService.ts`, `mobile/src/lib/crashReporting.ts`.
- `media_summarizer/api/endpoints/feedback.py`, `media_summarizer/api/endpoints/search.py`, `media_summarizer/core/services/search_indexing.py`.
