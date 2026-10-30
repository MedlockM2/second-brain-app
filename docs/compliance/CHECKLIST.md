# App Store Compliance Checklist

**Deepn**
**Last updated:** 2026-05-19

This checklist tracks readiness for Apple App Store and Google Play submission.

---

## Documents Prepared

- [x] Privacy Policy (`docs/compliance/privacy-policy.md`)
- [x] Terms of Service (`docs/compliance/terms-of-service.md`)
- [x] Apple App Privacy disclosures (`docs/compliance/apple-app-privacy.md`)
- [x] Google Play Data Safety declarations (`docs/compliance/google-play-data-safety.md`)

---

## Pre-Submission Actions Required

### Privacy Policy and Terms Hosting

- [x] Host privacy policy at `https://d3fc24zfw6pew8.cloudfront.net/privacy` (prod `www` distribution, 2026-10-30; account deletion section at `#delete-account`)
- [x] No terms of service page for the beta: the Terms link points to Apple's standard EULA (task-357 README, owner amendment of 2026-10-30)
- [x] Verify the URL is publicly accessible (no authentication required)
- [ ] Verify the page renders correctly on mobile browsers

### Apple App Store (App Store Connect)

- [ ] Enter Privacy Policy URL in App Store Connect
- [ ] Complete App Privacy questionnaire using `apple-app-privacy.md` as reference
- [ ] Verify no additional data types are collected by third-party SDKs in the final build
- [ ] Confirm App Tracking Transparency is NOT required (no tracking)
- [ ] Add privacy policy link within the app (e.g., account/settings screen)

### Google Play (Play Console)

- [ ] Enter Privacy Policy URL in Play Console store listing
- [ ] Complete Data Safety form using `google-play-data-safety.md` as reference
- [ ] Verify data deletion instructions are accurate and functional
- [ ] Test account deletion flow end-to-end
- [ ] Confirm no additional permissions are requested beyond what is declared

### In-App Compliance

- [ ] Privacy policy accessible from login/register screen
- [ ] Privacy policy accessible from account/settings screen
- [ ] Terms of service accessible from login/register screen
- [ ] Terms of service accessible from account/settings screen
- [ ] User consent checkbox or acknowledgment during registration (if required by jurisdiction)
- [ ] Account deletion option available in app settings

### Technical Verification

- [ ] Audit final app binary for unexpected third-party SDKs
- [ ] Confirm no data is transmitted before user authentication (except crash reporting)
- [ ] Verify secure storage is used for all sensitive data (tokens, credentials)
- [ ] Confirm all API calls use HTTPS
- [ ] Test that data deletion actually removes data from backend storage
- [ ] Verify share extension does not independently transmit data

### Legal Review

- [x] Owner has reviewed and approved privacy policy content (2026-10-30)
- [x] Contact email address is set up (deepn.support@gmail.com)
- [ ] Domain and website are ready to host compliance documents
- [ ] Confirm compliance with GDPR requirements (if serving EU users)
- [ ] Confirm compliance with CCPA requirements (if serving California users)

---

## Data Flow Verification Matrix

Verify each data flow matches what is declared in privacy documents:

| Data Type | Collected | Stored Where | Shared With | Declared in Privacy Policy | Declared in Apple Privacy | Declared in Google Safety |
|-----------|-----------|--------------|-------------|---------------------------|--------------------------|--------------------------|
| Email | Yes | DynamoDB | None | Yes | Yes | Yes |
| Password (hashed) | Yes | DynamoDB | None | Yes | No (not user-visible) | No (not user-visible) |
| Submitted URLs | Yes | DynamoDB | Deepgram, OpenAI (server-side) | Yes | Yes | Yes |
| Transcripts | Yes | S3 | OpenAI (server-side) | Yes | Yes (as User Content) | Yes (as User Content) |
| Generated artifacts | Yes | DynamoDB | None | Yes | Yes (as User Content) | Yes (as User Content) |
| Usage analytics | Yes | Analytics service | None | Yes | Yes | Yes |
| Crash data | Yes | Crash service | None | Yes | Yes | Yes |
| Device ID | No | - | - | Stated as not collected | Stated as not collected | Stated as not collected |
| Location | No | - | - | Stated as not collected | Stated as not collected | Stated as not collected |

---

## Submission Readiness Summary

| Store | Documents Ready | Form Ready | Hosting Ready | In-App Links Ready |
|-------|----------------|------------|---------------|-------------------|
| Apple App Store | Yes | Yes (reference doc complete) | Pending | Pending |
| Google Play | Yes | Yes (reference doc complete) | Pending | Pending |

**Overall status:** Documentation is review-ready. Remaining items are operational (hosting, in-app links, legal review) and must be completed before production submission.
