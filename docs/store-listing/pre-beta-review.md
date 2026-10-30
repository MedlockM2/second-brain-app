# Pre-beta store review — console texts

The first review of Deepn is the pre-beta one (owner decision of 2026-10-27 in
`docs/V1_LAUNCH_PLAN.md`): **TestFlight external testing** on Apple's side, a **closed
testing track** on Google's. This page holds every text to paste, in English, the language
of both review teams. The production submission (task-454) reuses most of it and adds what
the beta leaves out: purchases, support URL, own domain.

Never paste a credential into this file. The demo accounts (one per store, see task-454)
and the review contact's name and phone exist only in the consoles.

## The build

The binary under review is the latest `internal` build (EAS profile `internal`, backend
**dev**). It must have been built after commit `6007d03b`: an older binary first starts on
its embedded JavaScript, with the old legal links and without the Privacy Policy row in
Account, and only takes the OTA update on the next launch.

## Apple — TestFlight

App Store Connect → the app → TestFlight → **Test Information** (applies to every build),
then the build → **Add to external group** → submit for Beta App Review.

### Beta App Information

| Field | Value |
|---|---|
| Beta App Description | see below |
| Feedback Email | `deepn.support@gmail.com` |
| Marketing URL | leave empty |
| Privacy Policy URL | `https://d3fc24zfw6pew8.cloudfront.net/privacy` |

Beta App Description:

```
Deepn turns the articles, videos, podcasts and documents you save into text you can read, search and study: transcripts, summaries, notes and flashcards, plus a chat that answers from your own library.

Save content by sharing a link from any app, pasting a link, or importing a file or a photo of a page.
```

### What to Test (per build)

```
Save a few things (a link shared from Safari or YouTube, a pasted link, a PDF or a photo of a page), then open them: read the transcript, generate a summary, notes or flashcards, and ask the chat a question about them. Tell us anything that is slow, wrong or confusing.
```

### Beta App Review Information

| Field | Value |
|---|---|
| First name, last name, phone, email | the owner's, typed in the console |
| Sign-in required | **checked** |
| User name / Password | the Apple demo account (console only) |
| Review Notes | see below |

Review Notes:

```
Deepn is in beta. This build contains no in-app purchases: the subscription screen cannot be reached and every account has full access.

SIGN-IN
Use the demo account in the Sign-In Information fields (email and password). It is already verified, no code is needed, and its library already holds three items with their summaries and flashcards.

HOW TO TEST
1. Save content: in the Inbox, tap the add button at the bottom, then "Paste a link" and paste any article or YouTube link. Or, in Safari, open a page, tap Share and choose Deepn.
2. Open an item: read its text, generate a summary, notes or flashcards, and ask the chat a question about it.
3. Account tab: "Privacy Policy" opens our privacy policy; "Delete Account" deletes the account and its data permanently. You are welcome to test it on the demo account.

THIRD-PARTY AI
To turn saved content into text and study material, Deepn sends it to OpenAI (summaries, notes, flashcards, chat answers), Deepgram (speech-to-text) and LlamaParse and Unstructured (text of documents and images). We do not attach the account email or name, and never send the password. This is disclosed in section 4 of the privacy policy: https://d3fc24zfw6pew8.cloudfront.net/privacy

MEDIA FROM YOUTUBE AND OTHER PLATFORMS
Deepn does not play, download, save or export videos or audio for the user. The app shows only text (transcripts, summaries, notes) made for the user's personal study; the "open source" action opens the original content in its own app or website.
```

## Google Play — closed testing

Play Console → the app → **Test and release → Closed testing**. The closed track is
reviewed and starts the 12 testers × 14 days count required of a personal developer
account before production. Everything under **Policy → App content** must be complete
before the release can be sent for review.

| Section | Answer |
|---|---|
| Privacy policy | `https://d3fc24zfw6pew8.cloudfront.net/privacy` |
| App access | **All or some functionality is restricted** → add the Play demo account (console only) with the instructions below |
| Ads | **No**, the app contains no ads |
| Content rating | questionnaire in `google-play-store.md` ("Content Rating Questionnaire") |
| Target audience | **18 and over** only. The privacy policy excludes children, and a younger age group brings the Families policy into scope |
| Data safety | `docs/compliance/google-play-data-safety.md`, answer by answer |
| Account deletion | in-app path, and URL `https://d3fc24zfw6pew8.cloudfront.net/privacy#delete-account` |
| Government apps, financial features, health apps | **No** to each |
| News app | **No** |
| Store listing | short and full description in `google-play-store.md`; contact email `deepn.support@gmail.com` |

App access instructions:

```
Sign in with the email and password above on the "Sign in" screen. The account is already verified, no code is needed, and its library already holds three items with their summaries and flashcards. There are no in-app purchases in this build.
```
