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
| Privacy Policy URL | `https://d118p1z5xvufnz.cloudfront.net/privacy` |

Beta App Description:

```
Deepn turns the articles, videos, podcasts and documents you save into text you can read, search and study: transcripts, summaries, notes and flashcards, plus a chat that answers from your own library.

Save content by sharing a link from any app, pasting a link, or importing a file or a photo of a page.
```

### What to Test (per build)

TestFlight shows this text on its own « From the Developer » screen, before the app starts; Play shows the
release notes of the closed-testing release to its testers. Both say what Deepn is, what a tester can try
(the five things the app does: save, read, ask, study, find) and the one feedback we want. Nothing on how
to send it: TestFlight's « Share Feedback » screen comes right after, and the in-app « Signaler un bug »
screen gives the steps (feedback `AHZj_EmKyk_-POh6f05H_SE`). Set on 2026-11-01 on iOS build 21 (en-US and
fr-FR) and on the Android Alpha release 1.0.0 (28) (fr-FR and en-US): TestFlight's field is per build, to
set again on each new build; Play release notes are capped at 500 characters per language.

TestFlight, English:

```
Deepn turns what you save (videos, podcasts, articles, PDFs…) into text you can read, question and study.

Things to try:
• Save: in YouTube, Instagram, Spotify or Safari, tap Share, then Deepn. Or use the + button to paste a link, import a file or photograph a page.
• Read: open an item to read its full transcript, in your language.
• Ask: ask questions about one item or a whole folder; every answer cites its sources.
• Study: generate a summary, notes, flashcards or a quiz.
• Find: search for a word, even one spoken in the middle of a podcast, and catch up on what you saved in the Digest.

The beta is free. Tell us anything that is slow, wrong or confusing.
```

TestFlight, français :

```
Deepn transforme ce que vous enregistrez (vidéos, podcasts, articles, PDF…) en texte à lire, à interroger et à réviser.

À essayer :
• Enregistrer : dans YouTube, Instagram, Spotify ou Safari, touchez Partager puis Deepn. Ou utilisez le bouton + pour coller un lien, importer un fichier ou photographier une page.
• Lire : ouvrez un média pour lire sa transcription complète, dans votre langue.
• Discuter : posez vos questions sur un média ou sur tout un dossier ; chaque réponse cite ses sources.
• Réviser : générez un résumé, des notes de cours, des cartes mémo ou un quiz.
• Retrouver : cherchez un mot, même prononcé au milieu d'un podcast, et revoyez vos ajouts dans le Digest.

La bêta est gratuite. Dites-nous ce qui est lent, faux ou déroutant.
```

Play, closed-testing release notes (500 characters max per language):

```
<fr-FR>
Deepn transforme vos vidéos, podcasts, articles et PDF en texte à lire, interroger et réviser. À essayer : partagez un lien depuis YouTube, Instagram ou Chrome vers Deepn (ou bouton +), lisez la transcription, posez vos questions au chat, générez résumé, notes, cartes mémo ou quiz, et cherchez dans tout ce qui a été dit. La bêta est gratuite. Dites-nous ce qui est lent, faux ou déroutant.
</fr-FR>
<en-US>
Deepn turns your videos, podcasts, articles and PDFs into text you can read, question and study. Try it: share a link from YouTube, Instagram or Chrome to Deepn (or use +), read the transcript, ask the chat, generate a summary, notes, flashcards or a quiz, and search everything that was said. The beta is free. Tell us anything that is slow, wrong or confusing.
</en-US>
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
| Content rating | questionnaire in `google-play-store.md` ("Content Rating Questionnaire") |
| Target audience | **13 and over**: the app targets students, high-school students included. The privacy policy excludes under-13s and anyone under the digital age of consent, so the Families policy is out of scope |
| Data safety | `docs/compliance/google-play-data-safety.md`, answer by answer |
| Account deletion | in-app path, and URL `https://d118p1z5xvufnz.cloudfront.net/privacy#delete-account` |
| Government apps, financial features, health apps | **No** to each |
| News app | **No** |
| Store listing | short and full description in `google-play-store.md`; contact email `deepn.support@gmail.com` |

App access instructions:

```
Sign in with the email and password above on the "Sign in" screen. The account is already verified, no code is needed, and its library already holds three items with their summaries and flashcards. There are no in-app purchases in this build.
```
