---
id: TASK-571
title: Copier une réponse du chat depuis son bouton dédié sur mobile et web
status: Done
assignee:
  - codex
created_date: '2026-10-30 09:21'
updated_date: '2026-10-30 13:48'
labels:
  - mobile
  - web
  - testflight
dependencies: []
documentation:
  - docs/TESTFLIGHT_2026_10_30_CHAT_COPY.md
modified_files:
  - mobile/package.json
  - package-lock.json
  - mobile/src/components/chat/ChatThread.tsx
  - mobile/src/components/chat/CopyAnswerButton.tsx
  - web/src/components/chat/useChatPane.tsx
  - web/src/components/chat/CopyAnswerButton.tsx
  - web/src/styles.css
  - packages/core/src/i18n/ar.ts
  - packages/core/src/i18n/de.ts
  - packages/core/src/i18n/en.ts
  - packages/core/src/i18n/es.ts
  - packages/core/src/i18n/fr.ts
  - packages/core/src/i18n/hi.ts
  - packages/core/src/i18n/it.ts
  - packages/core/src/i18n/ja.ts
  - packages/core/src/i18n/nl.ts
  - packages/core/src/i18n/pt.ts
  - packages/core/src/i18n/zh.ts
  - docs/TESTFLIGHT_2026_10_30_CHAT_COPY.md
  - docs/testflight-feedback-log.md
type: feature
ordinal: 177000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback TestFlight ANHAPwX0MNtWPZwLf6STajE, reçu le 29 octobre 2026 sur le build 18 : ajouter en bas de chaque réponse du chat un petit bouton de copie comme dans ChatGPT. La capture montre une conversation de dossier ; le besoin concerne aussi le chat média et son équivalent web. Les captures restent dans le répertoire ignoré .testflight-feedback. Validation sur appareil à effectuer après distribution du nouveau build natif.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Chaque réponse non vide et terminée du chat média ou dossier dispose en pied de réponse d’une action de copie, sur mobile et web.
- [ ] #2 La copie utilise le texte de la réponse et fournit un retour de succès ou d’échec accessible et traduit ; les réponses en cours ne proposent pas une copie partielle.
- [x] #3 Les typechecks et lints mobile, core et web passent sans nouvelle erreur ; la dépendance native et le besoin de rebuild sont documentés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ajouter expo-clipboard dans le workspace mobile avec la version prévue par Expo SDK 55 ; utiliser Clipboard.setStringAsync uniquement à la demande.
2. Ajouter un bouton discret en bas de chaque réponse terminée et non vide dans ChatThread mobile et Thread web (média et dossier), y compris une réponse interrompue avec du texte ; copier la réponse entière en Markdown, citations conservées. Masquer pendant la génération.
3. Fournir un état Copié temporaire et une erreur réessayable, accessibles et traduits dans les onze catalogues partagés. Conserver les actions de reprise et de citation.
4. Vérifier typecheck et lint mobile/core/web, build web et autolinking natif ; documenter le rebuild iOS/Android nécessaire et les vérifications sur appareil restant après distribution. Aucun test automatisé ajouté ni build distribué.

Précision owner du 30 octobre : confirmation visuelle uniquement par remplacement de l’icône copie par une coche pendant deux secondes, puis retour à l’icône copie. Aucun texte de succès visible ; annonce accessible conservée.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Feedback et capture récupérés depuis App Store Connect. Bouton commun aux conversations média/dossier ajouté dans chaque app, copie du Markdown intégral via expo-clipboard 55.0.17 / navigator.clipboard.writeText. Succès indiqué uniquement par la coche temporaire selon précision owner. Typecheck et lint mobile/core/web et build web réussis ; avertissements préexistants any dans purchaseService.ts et taille du bundle web. Autolinking Expo résout ExpoClipboard sur iOS et Android. Aucun test automatisé ajouté ni exécuté. Pas de simulateur iOS disponible via xcrun simctl. Les vérifications de copie/collage sur appareil et navigateur restent à faire après distribution ; aucun build ni déploiement effectué.

Contrôles finaux après précision owner : typecheck/lint mobile et web et build web repassés avec succès ; core déjà vérifié sans modification ultérieure des catalogues. Export Metro/Hermes iOS et Android réussi ; avertissements locaux API/Sentry habituels. git diff --check propre ; recherche sur les ajouts sans email ni motif de credential. Les AC 1 et 2 restent volontairement non cochés : le code est livré mais les interactions de copie/collage et leur confirmation temporisée n’ont pas été exercées sur appareil/navigateur. La présence du module natif interdit de valider ce comportement dans le build 18 installé ; un nouveau binaire est nécessaire, puis validation propriétaire selon le runbook. Aucun test automatisé ajouté, aucun déploiement, aucun commit.

Owner autorise l’intégration sur main le 30 octobre. Le correctif était préparé directement dans le checkout main ; intégration par commit ciblé. Les tâches non suivies 572 et 573 apparues depuis sont hors périmètre et restent exclues du commit. Aucun push ni distribution demandé.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Le feedback TestFlight du build 18 demandait une copie de réponse en un geste. Les chats média et dossier proposent maintenant un bouton discret sous les réponses terminées ou interrompues non vides, sur mobile et web. La réponse entière est copiée en Markdown. Après succès, l’icône devient une coche pendant deux secondes puis redevient copie, sans texte de succès visible, selon la précision owner ; annonces accessibles et erreur réessayable dans les onze langues.

Validation : typecheck/lint mobile/core/web, build web, export iOS/Android et autolinking natif réussis. Avertissements préexistants documentés. Aucun test automatisé. Nouveau build natif requis pour expo-clipboard ; AC 1 et 2 laissés non cochés car interactions non exercées sur appareil/navigateur. Documentation et registre TestFlight mis à jour. Intégration sur main autorisée par l’owner le 30 octobre ; aucune distribution effectuée.
<!-- SECTION:FINAL_SUMMARY:END -->
