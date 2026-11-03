# Pre-beta store review — console texts

The first review of Deepn is the pre-beta one (owner decision of 2026-10-27 in
`docs/V1_LAUNCH_PLAN.md`): **TestFlight external testing** on Apple's side, a **closed
testing track** on Google's. This page holds every text to paste, in English, the language
of both review teams. The production submission (task-454) reuses most of it and adds what
the beta leaves out: purchases, support URL, own domain.

Never paste a credential into this file. The demo accounts (one per store, see task-454)
are in the dev secret `deepn-review-accounts` (keys `apple` and `google`):

```sh
AWS_PROFILE=second-brain-app aws secretsmanager get-secret-value --region eu-west-3 \
  --secret-id deepn-review-accounts --query SecretString --output text
```

The review contact's name and phone exist only in the consoles.

## The build

The binary under review is the latest `internal` build (EAS profile `internal`, backend
**dev**): iOS 24 and Android 30, built from `0dc2c380`. A binary first starts on its
embedded JavaScript and only takes an OTA update on the next cold launch, so the reviewer's
first launch shows whatever the binary was built from. Builds 21/28 were replaced for that
reason on 2026-11-02 (pre-sign-in carousel, no intro). Since the build that embeds
`mobile/src/lib/firstLaunchUpdate.ts`, a fresh install restarts on the latest update at its
first sign-in (`mobile/MOBILE_CI_CD.md`, « A fresh install meets the latest update at its first
sign-in »): screens before the sign-in still come from the binary, the rest from the update.
Builds iOS 21 and Android 28 (commit `6007d03b`) also embed the prod privacy URL
(`https://d3fc24zfw6pew8.cloudfront.net/privacy`) for that first launch: the prod page stays published
until every distributed binary was built after `3109ecf5`.

## Apple — TestFlight

App Store Connect → the app → TestFlight → **Test Information** (applies to every build),
then the build → **Add to external group** → submit for Beta App Review.

### Beta App Information

| Field | Value |
|---|---|
| Beta App Description | see below |
| Feedback Email | `deepn.support@gmail.com` |
| Marketing URL | leave empty |
| Privacy Policy URL | `https://d118p1z5xvufnz.cloudfront.net/privacy` |

Beta App Description:

```
Deepn turns the articles, videos, podcasts and documents you save into text you can read, search and study: transcripts, summaries, notes and flashcards, plus a chat that answers from your own library.

Save content by sharing a link from any app, pasting a link, or importing a file or a photo of a page.
```

### What to Test (per build)

TestFlight shows this text on its own « From the Developer » screen, before the app starts; Play shows the
release notes of the closed-testing release to its testers. Its one job is the beta's contract: what Deepn
is in one sentence, and what we ask of the tester. No feature list: the post-sign-in intro shows the one
gesture the app cannot teach (saving from another app), the rest is found in the app, and TestFlight's
« Share Feedback » screen that follows says how to send feedback (owner, 2026-11-01: no redundant screens
before the app). Set on iOS build 24 and on the Android Alpha release 1.0.0 (30), French and English.
TestFlight's field is per build: set it again on each new build. Play release notes: 500 characters max per
language, in `<fr-FR>…</fr-FR>` / `<en-US>…</en-US>` tags.

Français :

```
Merci de tester Deepn ! Enregistrez les vidéos, podcasts et articles qui vous intéressent : Deepn les transforme en texte que vous pouvez lire, interroger et réviser.

Essayez-le avec vos propres contenus et dites-nous tout ce qui vous semble lent, faux ou déroutant.
```

English:

```
Thanks for testing Deepn! Save the videos, podcasts and articles you care about: Deepn turns them into text you can read, question and study.

Try it with your own content and tell us anything that feels slow, wrong or confusing.
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
Use the demo account in the Sign-In Information fields (email and password). It is already verified, no code is needed, and its library already holds three items with their summaries and flashcards. On a first install, the app may restart once right after the sign-in to apply its latest update (a brief loading screen, not a crash), then a two-screen introduction follows: tap "Next", then "Let's go".

HOW TO TEST
1. Save content: on the Home tab, tap the add button at the bottom, then "Paste a link" and paste any article or YouTube link. Or, in Safari, open a page, tap Share and choose Deepn.
2. Open an item: read its text, generate a summary, notes or flashcards, and ask the chat a question about it.
3. Account tab: "Privacy Policy" opens our privacy policy; "Delete Account" deletes the account and its data permanently. You are welcome to test it on the demo account.

THIRD-PARTY AI
To turn saved content into text and study material, Deepn sends it to OpenAI (summaries, notes, flashcards, chat answers), Deepgram (speech-to-text) and LlamaParse and Unstructured (text of documents and images). We do not attach the account email or name, and never send the password. This is disclosed in section 4 of the privacy policy: https://d118p1z5xvufnz.cloudfront.net/privacy

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
| Privacy policy | `https://d118p1z5xvufnz.cloudfront.net/privacy` |
| App access | **All or some functionality is restricted** → add the Play demo account (console only) with the instructions below |
| Ads | **No**, the app contains no ads |
| Closed test — testers' feedback contact | `deepn.support@gmail.com` (Alpha track → Testers → « URL ou adresse e-mail pour les commentaires ») |
| Content rating | questionnaire in `google-play-store.md` ("Content Rating Questionnaire") |
| Target audience | **13 and over**: the app targets students, high-school students included. The privacy policy excludes under-13s and anyone under the digital age of consent, so the Families policy is out of scope |
| Data safety | `docs/compliance/google-play-data-safety.md`, answer by answer |
| Account deletion | in-app path, and URL `https://d118p1z5xvufnz.cloudfront.net/privacy#delete-account` |
| Government apps, financial features, health apps | **No** to each |
| News app | **No** |
| Store listing | short and full description in `google-play-store.md`; contact email `deepn.support@gmail.com` |

App access instructions:

```
Sign in with the email and password above on the "Sign in" screen. The account is already verified, no code is needed, and its library already holds three items with their summaries and flashcards. On a first install, the app may restart once right after the sign-in to apply its latest update (a brief loading screen, not a crash), then a two-screen introduction follows: tap "Next", then "Let's go". There are no in-app purchases in this build.
```
