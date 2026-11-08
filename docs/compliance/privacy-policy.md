# Privacy Policy

**Deepn**
**Last updated:** 2026-11-08
**Effective date:** 2026-11-03

## 1. Introduction

Second Brain Labs ("we", "us", "our") operates the Deepn app (the "Service"). This Privacy Policy explains what information we collect, how we use it, who we share it with, how long we keep it, and how you can delete it.

Contact for any privacy question or request: **deepn.support@gmail.com**.

## 2. Information We Collect

### 2.1 Account Information

- **Email address** - used to sign you in, recover your account and send service messages
- **Password** - if you sign up with email, your password is handled by our authentication provider (Amazon Cognito) and stored only in hashed form; we never see it in plain text
- **Sign in with Apple / Continue with Google** - if you use one of them, we receive your email address (or Apple's private relay address) and the account identifier that Apple or Google gives us. We never receive your Apple or Google password

### 2.2 Content You Submit

- **Links you share** - web articles, podcast episodes, videos and posts (for example from YouTube, TikTok, Instagram or X), and podcast or RSS feeds you follow
- **Files you share or import** - documents (such as PDFs), images, photos you take with the camera to import a page, and audio files
- **Audio notes you record** - when you open the recorder and allow microphone access, you can record a spoken note. Only recordings you choose to save are uploaded for transcription; discarding a recording sends no audio to our servers
- **Text you share** - text passages you send to the app, including the source address when you save a browser selection
- **Browser extension** - on your explicit action, the extension reads the current tab’s address and title locally. It sends the address you choose to save, or the text you select with its source address, and your chosen folder. It does not read the full page or your browsing history
- **Chat messages** - the questions you ask the in-app assistant and its answers
- **Organisation** - folders, review settings, digest settings and your time zone
- **Feedback and bug reports** - the subject and description you write, any file you choose to attach, the app version, build and update, the platform or browser information attached to the report, and the identifier of the last crash or error report the app sent (section 2.4), so we can find what happened just before

### 2.3 Content We Generate for You

From your content, the Service creates and stores transcripts, translations, summaries, notes, flashcards, review prompts and digests.

### 2.4 Technical Data

- **Crash, error and performance reports** - the error, where in the app it happened, device model, operating system and app version, the screens and in-app events just before it, the timing of network requests (addresses without their parameters), and a random identifier for each request to our servers. They include neither your IP address nor your account identifier, but that request identifier lets us match a report with our server logs, which are linked to your account, to find the cause of a problem
- **Server logs** - our servers record each request, including your IP address, the time and the endpoint called, to operate and secure the Service
- **Continue learning** - the identifiers of the artifacts and conversations you open or start, and the time of your last activity on each, to let you resume them across devices
- **Usage accounting** - processing operations, capacity reservations and their final usage, including token counts, audio duration and document units needed to enforce processing limits
- **Push notification token** - only if you allow notifications (section 4.5), stored with the app's interface language on that device so its notifications are written in that language

### 2.5 What We Do NOT Collect

- No location data
- No access to your contacts. The camera and photo library are used only when you choose to take or pick an image to import
- No payment card details: purchases are handled entirely by Apple or Google
- No health, fitness or biometric data
- No advertising identifier, and no tracking across other companies' apps or websites

## 3. How We Use Your Information

| Purpose | Data used |
|---------|-----------|
| Sign-in and account management | Email, sign-in identifiers |
| Processing what you share (transcription, extraction, AI-generated content) | Links, files, text, transcripts |
| Answering your questions in the chat | Chat messages, your saved content |
| Resuming your learning | Artifact and conversation identifiers, last activity time |
| Search within your library | Your content and generated content |
| Notifications (digests, content ready) | Push notification token, app language, time zone |
| Access and processing limits | Beta access or purchase status, usage accounting |
| Support and feedback | Email, messages and reports you send us |
| Stability and security | Crash reports, server logs |

We do not use your content to train AI models, and we do not sell or rent your data.

## 4. Third-Party Services, Including AI

### 4.1 Third-party AI

Deepn works by processing what you save with third-party AI services: **OpenAI** writes summaries, notes, flashcards, translations and chat answers, **Deepgram** transcribes speech, and **LlamaParse** and **Unstructured** read the text of documents and images. When you save something, the parts of it these tasks need are sent to them. We do not separately attach your account email or name, and we do not send your account password. Content you submit may itself contain personal information. Section 4.2 lists what each one receives.

### 4.2 Who receives what

We share data only with the following providers, to run the Service:

| Provider | Data shared | Purpose |
|----------|-------------|---------|
| **OpenAI** (third-party AI) | Text of your content and transcripts, your chat messages | Summaries, notes, flashcards, translations, chat answers |
| **Deepgram** (third-party AI) | Audio of the media and audio files you share | Speech-to-text transcription |
| **LlamaParse** and **Unstructured** | Documents and images you share | Extracting their text |
| **Apify** | Links to YouTube, TikTok and Instagram content you share | Retrieving the public content and its transcript |
| **X (Twitter) API** | Links to X posts you share | Retrieving the public post |
| **Algolia** | Your account identifier, and the title, creator and transcript of your saved content | Search within your library |
| **Amazon Web Services** | All stored data | Hosting, storage, sign-in (Amazon Cognito) |
| **RevenueCat** | Your account identifier, purchase and subscription status | Managing subscriptions bought through Apple or Google |
| **Expo** | Push notification token, notification text | Delivering notifications through Apple (APNs) or Google (FCM) |
| **Sentry** | Crash, error and performance reports (section 2.4) | Diagnosing crashes and slowness |
| **Canny** | Your account identifier, email and name, if you open the feedback board | Collecting product feedback |
| **Apple, Google** | Sign-in data, if you use their sign-in | Authentication |

To find the public content behind a link, our servers also query public sources such as the website itself, podcast directories (Podcast Index, Deezer, Apple Podcasts, Spotify) and YouTube. They receive only the link or title needed to locate that public content, never your identity.

### 4.3 How these providers protect your data

Each provider must protect your data at least as well as this policy does, and uses it only to provide its service to us, with the exception stated for Deepgram below.

- **OpenAI** does not use data sent through its API to train its models.
- **Deepgram** may retain audio sent to it and use it to improve its speech recognition models, unless a request is opted out of its Model Improvement Program.

### 4.4 Data location and transfers

Our own infrastructure is hosted by Amazon Web Services in the **European Union (Paris, France)**, and crash reports are stored by Sentry in the European Union (Germany). Search data is hosted by Algolia in the United Kingdom. Most other providers above, including OpenAI, Deepgram and LlamaParse, process data in the United States. Transfers outside the European Economic Area are covered by the European Commission's Standard Contractual Clauses, an adequacy decision (United Kingdom) or an equivalent safeguard.

### 4.5 Push notifications

Notifications are optional. If you allow them, we send two kinds: digest alerts ("You saved 3 items today") and a notice when something you shared has been processed ("Your video has been processed"). They go through Expo to Apple or Google, and never contain the title or content of what you saved; they carry only an internal item identifier, so that tapping one opens the right screen. You can turn notifications off at any time in your device settings.

## 5. Security

- All data in transit is encrypted (TLS 1.2 or higher)
- Data at rest is encrypted with AWS-managed keys
- On mobile, sign-in tokens are stored in the platform’s secure storage (iOS Keychain / Android Keystore). On the web, the access token stays in memory and the refresh session uses an HttpOnly cookie. In the browser extension, its own refresh grant is held in extension-local storage and its short-lived access token in session storage; revoking that extension ends its access
- Access to our infrastructure is restricted to authorised accounts and recorded by AWS

## 6. Data Retention

- **Your account and library** - kept until you delete them. We never delete your library on our own
- **An item you delete** - disappears from your library and search immediately, and is permanently erased about 30 days later (this window lets us restore it if you ask). Technical processing records of the item, such as the link submitted, are kept until you delete your account
- **Content shared by several accounts** - the transcript and files of a public media (for example a YouTube video) are kept as long as at least one account still has that media in its library; they are no longer linked to you once you delete it
- **Chat conversations** - kept until you delete the conversation or your account
- **Continue learning activity** - used for 90 days after your last activity on each artifact or conversation, then automatically deleted shortly afterwards. Deleted destinations are excluded immediately; deleting your account erases these activity records. Expiry of an activity record never deletes the artifact or conversation itself
- **Usage accounting** - up to 400 days, then deleted
- **Crash reports** - up to 30 days
- **Server logs** - up to 30 days
- **Push notification token** - deleted when you sign out, when your device is no longer reachable, after 90 days without the app renewing it, and with your account
- **Backups** - our backups cannot be edited item by item. Deleted data disappears from them as they expire: within 35 days for continuous backups, 90 days for weekly snapshots and 365 days for monthly archives

<a id="delete-account"></a>

## 7. How to Delete Your Deepn Account and Data

You can delete your Deepn account and all its data at any time, in either of two ways.

**In the app:** open the **Account** tab, tap **Delete Account** and confirm. The deletion is immediate.

**Without the app** (for example if you no longer have your device): send an email to **[deepn.support@gmail.com](mailto:deepn.support@gmail.com?subject=Delete%20my%20Deepn%20account)** from the email address of your account, with the subject "Delete my Deepn account". We delete the account within 30 days and confirm by email.

**What is deleted immediately:** your account and sign-in identity, every item in your library, your transcripts of private files, all summaries, notes, flashcards and chats, your folders, feeds, settings and bug reports, your search index entries, your usage records and your push token.

**What is kept:** the transcript and files of a public media that other accounts still have in their library, no longer linked to you (section 6); copies in backups until they expire (section 6); and records the law obliges us to keep.

**Subscriptions:** deleting your account does not cancel a subscription bought through the App Store or Google Play. Cancel it in your Apple or Google account settings, otherwise the store keeps billing you.

<a id="delete-data"></a>

## 7.1. Delete Data Without Deleting Your Account

You can delete selected saved items or chat conversations while keeping your Deepn account and the rest of your library.

**In the app:**

- **Saved items:** in your library, press and hold the item, choose **Delete** and confirm.
- **Chat conversations:** open the chat history, tap the trash icon beside the conversation and confirm.

**Without the app:** send an email to **[deepn.support@gmail.com](mailto:deepn.support@gmail.com?subject=Delete%20selected%20Deepn%20data)** from the email address of your account, with the subject "Delete selected Deepn data". Identify the saved items or conversations you want deleted and say that you want to keep your account. Do not send your password. We process your request within 30 days and confirm by email. Saved items then follow the deletion period below.

**What is deleted:** selected saved items disappear from your library and search immediately when deleted in the app, or when we process your email request. Their associated content and study material are permanently erased about 30 days later, unless the same content is still saved elsewhere in your library or by another account. Selected chat conversations and their messages are removed from the live database when deleted.

**What is kept:** your account, the rest of your library, usage records and technical processing records remain. Public content still saved by another account is no longer linked to your deleted item. Copies in backups expire according to section 6. For deletion of your entire account and its associated records, use section 7 above.

## 8. Your Rights

- **Access** - you can see your content in the app. For a complete copy of the data we hold about you, email **deepn.support@gmail.com**; we answer within one month
- **Portability** - on request by email, we send your data in a structured, machine-readable format
- **Correction** - email us to correct your account information
- **Deletion** - see section 7
- **Complaint** - you can lodge a complaint with your data protection authority

## 9. Children

The Service is not intended for children under 13, or under the age of digital consent in your country. We do not knowingly collect their data, and we delete it if we learn that we have.

## 10. Changes to This Policy

We will update the date at the top of this page when this policy changes, and inform you before any significant change takes effect.

## 11. Contact

Second Brain Labs, publisher of Deepn
Email: **deepn.support@gmail.com**

## 12. Additional Disclosures

### European Economic Area and United Kingdom (GDPR)

- Legal bases: performance of our contract with you (providing the Service, including the processing of your content by the third-party AI services in section 4.1), your consent (notifications, which you allow in your device settings), and our legitimate interests (security, crash diagnosis)
- Transfers outside the EEA are covered by Standard Contractual Clauses (section 4.4)

### California (CCPA)

We do not sell or share personal information for cross-context behavioral advertising. You may exercise the rights to know and to delete as described above.

### Australia (Privacy Act 1988)

We handle personal information in line with the Australian Privacy Principles. You may complain to the Office of the Australian Information Commissioner.
