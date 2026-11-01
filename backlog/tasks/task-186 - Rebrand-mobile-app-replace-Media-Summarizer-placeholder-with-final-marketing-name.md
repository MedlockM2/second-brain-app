---
id: task-186
title: >-
  Rebrand mobile app: replace "Media Summarizer" placeholder with final
  marketing name
status: Done
assignee:
  - agent
created_date: '2026-06-10 18:51'
updated_date: '2026-10-30 14:42'
labels:
  - mobile
  - release
  - branding
  - phase-10
dependencies: []
priority: high
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Décision et périmètre actuels

Nom commercial Deepn décidé le 2026-10-10. Renommer ce que l’utilisateur voit : display name Deepn, 11 locales natives et libellé Deepn Share de la share extension, avec des cibles natives distinctes Deepn et DeepnShare. Livré par 05539a3e.

Décision owner du 2026-10-10 : les identifiants invisibles restent inchangés (slug Expo et scheme media-summarizer, nom npm media-summarizer-mobile, projet GCP). Les anciens passages demandant leur renommage sont périmés. Le bundle/package com.secondbrainlabs.core et le project ID Expo restent inchangés. Référence : docs/BRAND_IDENTITY.md.

Vérifications pertinentes pour cette tâche : typecheck, lint sans erreur, intégrité des identifiants et génération native des deux noms. Le préflight général scripts/mobile_release_check.sh reste utile avant livraison et demeure invoqué avec un profil par la CI Ubuntu ; son résultat global, dépendant du .env du poste et du réseau, ne mesure pas l’achèvement du rebrand et ne bloque plus cette tâche.

Le nom visible dans un binaire nécessite une livraison native, portée par task-449. Les fiches stores et le branding Google OAuth relèvent de task-450 et task-451. Aucun build, push, déploiement ni modification du poste local n’est nécessaire pour clôturer le travail dans le dépôt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le nom marketing définitif est noté dans cette tache (champ Decision) avant tout rename
- [x] #2 mobile/app.config.ts : name et iosShareExtensionName alignés sur le nouveau nom (slug et scheme inchangés, décision owner 2026-10-10)
- [x] #3 Les 11 fichiers mobile/locales/*.json portent le nouveau nom sur ios.CFBundleDisplayName et android.app_name
- [x] #4 Sans objet : le scheme reste media-summarizer (invisible pour l'utilisateur, décision owner 2026-10-10)
- [x] #5 Sans objet : le nom npm reste media-summarizer-mobile (invisible, décision owner 2026-10-10)
- [x] #6 Les commentaires et docs qui citent l'ancien nom ou l'ancien scheme sont à jour : app.config.ts, ShareIntentContext.tsx, paywall.tsx, +native-intent.tsx, E2E_TESTING.md, MOBILE_CI_CD.md
- [x] #7 npm run typecheck et npm run lint terminent sans erreur dans mobile/ ; les identifiants iOS et Android restent com.secondbrainlabs.core
- [x] #8 Aucun ancien nom marketing ne subsiste dans les libellés visibles de l’app ; identifiants techniques media-summarizer et mentions historiques conservés conformément à la décision owner du 2026-10-10

- [x] #9 Sans objet : slug Expo inchangé, aucun renommage côté dashboard (décision owner 2026-10-10)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Vérifier la décision owner et les libellés actuellement résolus par Expo.
2. Distinguer les validations du rebrand du préflight général de livraison.
3. Actualiser les critères historiques et clôturer sur les preuves déjà obtenues.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-10 — Décision explicite de l’owner : nom définitif Deepn. AC #1 satisfait et décision consignée ; documentation produit et copy stores alignées. Configuration mobile, locales natives, scheme et dashboard Expo toujours sur les valeurs précédentes : AC #2–#9 non cochés, statut To Do conservé. Aucune clôture du rebrand ni intervention dans les consoles.

2026-10-10 — Owner autorise le passage en dispatchable: true. Choix Deepn acquis ; coordination de livraison avec task-180 maintenue, sans bloquer le travail en branche.
2026-10-10 — Décision owner : « pas besoin de renommer ce qui sera invisible à l'user ». Slug Expo, scheme `media-summarizer`, nom npm et projet GCP restent inchangés ; AC #4, #5 et #9 deviennent sans objet.

2026-10-10 — Rebrand du visible appliqué (agent). `app.config.ts` : `appName` = `Deepn`, `iosShareExtensionName` = `Deepn Share` (cible `DeepnShare` ≠ `Deepn`). Les 11 `mobile/locales/*.json` portent `Deepn` sur `CFBundleDisplayName` et `app_name`. Docs alignées sur le nom visible (`E2E_TESTING.md`, `MOBILE_CI_CD.md`, `docs/BRAND_IDENTITY.md`), commentaire de `.maestro/07_paywall.yaml` (dialogue « Open in "Deepn"? »).

Vérifications : `npm run typecheck` clean ; `npm run lint` 0 erreur (1 warning `no-explicit-any` préexistant). `bash scripts/mobile_release_check.sh internal` (copie sans `.env`) : bundle ID, eas.json, app.config.ts, SDK en PASS ; seul échec le gate DNS, car `getent` n'existe pas sur macOS (l'hôte résout avec `dig`). Sans profil, le script échoue sur `EXPO_PUBLIC_API_BASE_URL` absent du `mobile/.env` local, déjà le cas avant le rebrand. AC #7 non coché : à confirmer sur le runner CI Ubuntu. Le grep de l'AC #8 n'a plus d'objet pour `media-summarizer` (conservé volontairement) et ne trouve plus `Media Summarizer` dans le code.

Owner : `npx expo prebuild --clean` sur macOS pour constater `ios/DeepnShare/`, puis builds natifs iOS et Android à grouper avec task-180. `dispatchable: false` : plus rien à faire pour un agent.

2026-10-30 — Audit demandé par l’owner : implémentation du rebrand visible terminée depuis 05539a3e (2026-10-10). appName=Deepn, iosShareExtensionName=Deepn Share ; les 11 locales natives portent Deepn sur iOS et Android. Bundle/package com.secondbrainlabs.core inchangés. Slug Expo, scheme media-summarizer et nom npm conservés volontairement conformément à la décision owner, qui prévaut sur les anciennes consignes contradictoires de la description. Les références historiques dans les runbooks ne sont pas du branding actif.

Vérifications 2026-10-30 : npm run typecheck --workspace=mobile sort 0 ; npm run lint --workspace=mobile sort 0, un warning no-explicit-any préexistant dans purchaseService.ts:136. Prebuild --clean --no-install iOS et Android réussi dans une copie temporaire du HEAD ; génération des cibles Deepn et DeepnShare, noms natifs Deepn et Deepn Share confirmés. Aucun changement du code applicatif ou des fichiers déjà modifiés par l’owner.

AC #7 reste non coché : bash scripts/mobile_release_check.sh sort 1 car EXPO_PUBLIC_API_BASE_URL est absent ou vide dans mobile/.env. Les avertissements DNS de ce script sur cette machine macOS ne prouvent pas un incident DNS : il utilise getent, absent ici. Les vérifications bundle ID/configuration/SDK passent. Ce défaut de préflight préexistait au rebrand et ne signifie pas qu’il reste du renommage à implémenter. Statut In Progress pour refléter une implémentation livrée avec un critère de validation encore non satisfait ; aucune clôture artificielle ni modification des critères.

2026-10-30 — Réexamen de validité demandé par l’owner, qui remplace la conclusion de l’audit précédent. AC #7 était composite : typecheck/lint et intégrité du bundle restent pertinents et passent ; l’exigence de succès global du script de release est hors du périmètre du rebrand. La livraison CI utilise déjà scripts/mobile_release_check.sh internal sur Ubuntu, sans dépendre du .env du poste. Vérification directe : expo config --type public --json réussit avec EXPO_NO_DOTENV=1 et EXPO_PUBLIC_API_BASE_URL retiré de l’environnement ; extra.apiBaseUrl correspond bien à la valeur du profil internal dans eas.json. Le fichier .env local n’est donc pas à remplir pour achever cette tâche, et le script DNS n’est pas à modifier pour ce motif. Les contrôles de release restent inchangés dans les workflows.

AC #7 recentré sur les validations pertinentes ; AC #8 aligné sur l’exception owner déjà actée pour les identifiants techniques et sur les mentions historiques. Nouvelle exécution : typecheck et lint sortent 0 (un warning no-explicit-any préexistant) ; configuration résolue Deepn / Deepn Share, 11 locales Deepn, identifiants iOS/Android inchangés. Le prebuild iOS/Android réussi lors de cet audit confirme les cibles distinctes. Aucun code applicatif, secret, .env ou workflow modifié.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Le rebrand visible Deepn est terminé depuis le 10 octobre : nom de l’app, 11 locales et Deepn Share. Typecheck/lint sans erreur, configuration Expo résolue et prebuild natif vérifiés. Le gate général de livraison a été retiré des critères du rebrand ; il reste en place dans la CI. Identifiants techniques conservés selon la décision owner. Aucun changement de configuration locale, build distant ou déploiement nécessaire.
<!-- SECTION:FINAL_SUMMARY:END -->
