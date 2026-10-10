---
id: task-186
title: >-
  Rebrand mobile app: replace "Media Summarizer" placeholder with final
  marketing name
status: To Do
assignee:
  - agent
created_date: '2026-06-10 18:51'
updated_date: '2026-10-10 15:14'
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
## Responsabilité — cadrage lancement du 2026-10-10

Agent — réaliser le rebrand Deepn et les vérifications locales déjà autorisés le 2026-10-10. Owner — fournir l’accès Expo si nécessaire et coordonner la livraison avec les icônes. Aucun build, push ou déploiement requis pour livrer le travail en branche.

## Description

L'app utilise actuellement le nom legacy **« Media Summarizer »** comme placeholder partout (display name, slug Expo, scheme deep link, libellé de la share extension). Le nom marketing définitif est **Deepn**, choisi par l’owner le **2026-10-10**. Appliquer le rename **avant la première soumission App Store / Play Store** (Phase 10 du V1_LAUNCH_PLAN) — coût ~30 min en pré-distribution, beaucoup plus élevé après.

## Contexte

- L'entité légale est `Second Brain Labs`. Le bundle id `com.secondbrainlabs.core` est figé et **ne change pas** lors du rebrand.
- Un premier benchmark (task-115) avait recommandé "Percole", rejeté par l'owner. La task est completed et toutes ses traces ont été purgées (commit `9db3a21`).
- Décision owner reçue le 2026-10-10 : **Deepn**. Le choix du nom ne bloque plus cette tâche.

## Decision

**Deepn**, nom commercial définitif choisi par l’owner le **2026-10-10**. Cibles : `Deepn` (display name dans toutes les locales), `deepn` (slug et scheme), `Deepn Share` (extension), `deepn-mobile` (nom npm). Voir `docs/BRAND_IDENTITY.md`.

## Pré-requis

- Nom marketing définitif décidé : **Deepn** (satisfait le 2026-10-10).
- Aucun installé de production à protéger : remplacer directement l’ancien scheme, sans compatibilité transitoire (règle AGENTS.md). Les builds bêta doivent être réémis.

## Scope — relevé du 2026-09-03

Ce relevé **remplace** celui écrit le 2026-06-10, qui est devenu faux sur quatre points : `mobile/plugins/withShareExtension.js` a été supprimé par task-188 (le partage passe par le plugin officiel `expo-share-intent`), `mobile/ios-share-extension/` est supprimé par task-347, `mobile/src/hooks/useShareIntent.ts` n'existe plus, et les 11 fichiers `mobile/locales/*.json` — le vrai display name sous l'icône — n'étaient pas dans la liste.

1. `mobile/app.config.ts:37` — `const appName = "Media Summarizer"`, rendu en `name:` (`:126`) → display name de **fallback**, celui que voient les langues hors des 11 locales natives du point 5.
2. `mobile/app.config.ts:127` — `slug: "media-summarizer"` (kebab-case, doit matcher le dashboard Expo).
3. `mobile/app.config.ts:132` — `scheme: "media-summarizer"` (deep link).
4. `mobile/app.config.ts:61` — `const iosShareExtensionName = "Media Summarizer Share"` : c'est le `CFBundleDisplayName` de la share extension, donc le **libellé de la ligne dans la iOS Share Sheet**. Il suit le nouveau nom, **mais jamais à l'identique** : la même option nomme aussi la cible Xcode de l'extension, non-alphanumériques retirés, et EAS résout les credentials iOS *par nom de cible*. Si le nom réduit égale celui de l'app (`expo.name` réduit pareil), le build iOS meurt en `XCODE_BUILD_ERROR` — le profil de l'extension est appliqué à la cible de l'app. C'est arrivé le 2026-09-04 (build 5), rien ne l'attrape avant EAS. Donc : `"<Nouveau Nom> Share"`, pas `"<Nouveau Nom>"`. Le bundle id de l'extension dérive de celui de l'app (`<appId>.share-extension`) et ne bouge pas — ni App ID ni provisioning profile à recréer.
5. `mobile/locales/*.json` — **11 fichiers** (`en, fr, es, de, it, pt, nl, ja, zh, hi, ar`), deux clés chacun : `ios.CFBundleDisplayName` et `android.app_name`. C'est ce que l'appareil affiche sous l'icône dans ces 11 langues, et ça **écrase** le `name` du point 1. Renommer le point 1 sans ces fichiers ne change le nom visible pour presque personne.
6. `mobile/app/_layout.tsx:35` — `scheme: "media-summarizer"` passé à `ExpoShareIntentProvider` (c'est ce qui remplace l'ancien `useShareIntent.ts`).
7. `mobile/package.json:2` — `"name": "media-summarizer-mobile"` (purement interne npm, optionnel mais propre).
8. Commentaires et docs qui citent l'ancien nom ou l'ancien scheme, à suivre pour qu'ils ne mentent pas : `mobile/app.config.ts:92,179`, `mobile/src/contexts/ShareIntentContext.tsx:198`, `mobile/app/paywall.tsx:103`, `mobile/app/+native-intent.tsx:6,27,29-30` (la clé App Group suit `<appScheme>ShareKey`, mais elle est construite côté natif par le plugin — ces lignes ne sont que de la doc), `mobile/E2E_TESTING.md`, `mobile/MOBILE_CI_CD.md`.
9. **Côté Expo dashboard** : Settings du projet → renommer le slug pour qu'il matche le point 2. L'`expo.projectId` (UUID) reste le même — c'est le contrat de fait, le slug est un alias lisible.

`mobile/.maestro/` porte aussi le nom et le scheme (`config.yaml:1,5`, et `openLink: "media-summarizer://share?..."` dans `03_inbox_visibility.yaml:56`, `04_media_detail_progression.yaml:38`, `05_artifact_trigger_action.yaml:39`). Les flows Maestro sont legacy et ne contraignent rien ici : les renommer est de la courtoisie, pas un critère.

## Vérifications après rebrand

- `cd mobile && npm run typecheck` et `cd mobile && npm run lint` passent.
- `bash scripts/mobile_release_check.sh` passe (pas de régression sur le bundle id check).
- Ce grep ne renvoie plus rien, hors auto-générés et hors `.maestro/` :
  `grep -rn "media-summarizer\|Media Summarizer" mobile/ --include="*.ts" --include="*.tsx" --include="*.json" --include="*.js" | grep -v node_modules | grep -v "/ios/" | grep -v "/android/" | grep -v package-lock | grep -v .maestro`

## Notes owner (délibérément pas des ACs)

- `cd mobile && npx expo prebuild --clean` est le vrai test du point 4 — renommer le target Xcode change le dossier `ios/<Nom>/` généré. À lancer par l'owner sur macOS, pas depuis le worktree d'un agent.
- Le nouveau nom sous l'icône, comme le nouveau scheme, ne se voit que sur une build native fraîche : rien de tout ça n'est livrable par OTA.
- Renommer le scheme casse tout deep link `media-summarizer://` collé ailleurs. Aucun installé base, donc aucun coût réel — juste ne pas s'en étonner.

## Ce qui ne change PAS lors du rebrand

- `bundleIdentifier` iOS / `package` Android (`com.secondbrainlabs.core`) — figé. Donc Apple Developer / Google Cloud Console / RevenueCat / OAuth client IDs / App Group de la share extension ne sont pas impactés.
- `expo.projectId` UUID — reste identique, c'est l'identifiant stable côté EAS.
- Les valeurs `source` envoyées au backend (`ios-share-extension`, `android-share-intent`) — elles font partie du contrat API, pas du branding.
- Backend API (FastAPI, AWS) — aucune référence au nom marketing, rien à toucher.

## À livrer dans le même push que task-180

`appName`, `iosShareExtensionName` et les 11 `mobile/locales/*.json` sont des **sources de l'empreinte `runtimeVersion`**. Les changer déplace l'empreinte des **deux** plateformes, donc déclenche un build natif iOS *et* un build natif Android : `@expo/fingerprint` hashe le config Expo résolu comme un seul bloc, il n'existe pas de hash par plateforme. C'est cohérent avec la note owner ci-dessus (« rien de tout ça n'est livrable par OTA ») — ce paragraphe en donne le coût exact.

task-180 (les 3 PNG de `mobile/assets/`, sources `expoConfigExternalFile`) est dans le même cas. Livrées séparément, les deux tâches coûtent **quatre** builds natifs ; dans le même push, **deux**. Sur le palier gratuit à 15 builds/mois, le regroupement est la seule parade.

Mesuré le 2026-09-08 : une seule ligne ajoutée à `androidIntentFilters` (task-380, `4543f75`) a déplacé les deux empreintes — Android `87b855f2` → `96e3267b`, iOS `784f7b9c` → `421e4b93` — et consommé un build iOS pour un changement qu'iOS ne voit pas. Pour attribuer un déplacement d'empreinte : `eas fingerprint:compare --build-id A --build-id B`, depuis `mobile/`. Détails dans `mobile/MOBILE_CI_CD.md`, section « An Android-only config change moves the iOS fingerprint too ».

## References

- `docs/V1_LAUNCH_PLAN.md` Phase 10 (à exécuter **avant** la sous-étape 1 « Apple App Store Connect → App Information »)
- `mobile/app.config.ts` (source de vérité : name, slug, scheme, libellé de la share extension)
- `mobile/locales/*.json` (display name localisé, 11 langues — ce que l'appareil affiche réellement)

## Exécution par un agent

Le nom est décidé : **Deepn**. L’owner autorise le dispatch le 2026-10-10 : `dispatchable: true`. Un agent peut réaliser les changements de fichiers et les vérifications locales. Le renommage du slug Expo peut également être réalisé s’il dispose d’un accès authentifié ; sinon documenter ce point et laisser l’AC #9 non coché. Coordonner la livraison avec task-180 pour regrouper les builds natifs ; cela ne bloque pas l’implémentation du rebrand en worktree.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le nom marketing définitif est noté dans cette tache (champ Decision) avant tout rename
- [x] #2 mobile/app.config.ts : name et iosShareExtensionName alignés sur le nouveau nom (slug et scheme inchangés, décision owner 2026-10-10)
- [x] #3 Les 11 fichiers mobile/locales/*.json portent le nouveau nom sur ios.CFBundleDisplayName et android.app_name
- [x] #4 Sans objet : le scheme reste media-summarizer (invisible pour l'utilisateur, décision owner 2026-10-10)
- [x] #5 Sans objet : le nom npm reste media-summarizer-mobile (invisible, décision owner 2026-10-10)
- [x] #6 Les commentaires et docs qui citent l'ancien nom ou l'ancien scheme sont à jour : app.config.ts, ShareIntentContext.tsx, paywall.tsx, +native-intent.tsx, E2E_TESTING.md, MOBILE_CI_CD.md
- [ ] #7 npm run typecheck et npm run lint sont clean dans mobile/, et bash scripts/mobile_release_check.sh sort 0
- [x] #8 Aucune occurrence résiduelle de 'Media Summarizer' ou 'media-summarizer' hors auto-générés (ios/, android/, package-lock) et hors .maestro/ (legacy, non contraignant)

- [x] #9 Sans objet : slug Expo inchangé, aucun renommage côté dashboard (décision owner 2026-10-10)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-10 — Décision explicite de l’owner : nom définitif Deepn. AC #1 satisfait et décision consignée ; documentation produit et copy stores alignées. Configuration mobile, locales natives, scheme et dashboard Expo toujours sur les valeurs précédentes : AC #2–#9 non cochés, statut To Do conservé. Aucune clôture du rebrand ni intervention dans les consoles.

2026-10-10 — Owner autorise le passage en dispatchable: true. Choix Deepn acquis ; coordination de livraison avec task-180 maintenue, sans bloquer le travail en branche.
2026-10-10 — Décision owner : « pas besoin de renommer ce qui sera invisible à l'user ». Slug Expo, scheme `media-summarizer`, nom npm et projet GCP restent inchangés ; AC #4, #5 et #9 deviennent sans objet.

2026-10-10 — Rebrand du visible appliqué (agent). `app.config.ts` : `appName` = `Deepn`, `iosShareExtensionName` = `Deepn Share` (cible `DeepnShare` ≠ `Deepn`). Les 11 `mobile/locales/*.json` portent `Deepn` sur `CFBundleDisplayName` et `app_name`. Docs alignées sur le nom visible (`E2E_TESTING.md`, `MOBILE_CI_CD.md`, `docs/BRAND_IDENTITY.md`), commentaire de `.maestro/07_paywall.yaml` (dialogue « Open in "Deepn"? »).

Vérifications : `npm run typecheck` clean ; `npm run lint` 0 erreur (1 warning `no-explicit-any` préexistant). `bash scripts/mobile_release_check.sh internal` (copie sans `.env`) : bundle ID, eas.json, app.config.ts, SDK en PASS ; seul échec le gate DNS, car `getent` n'existe pas sur macOS (l'hôte résout avec `dig`). Sans profil, le script échoue sur `EXPO_PUBLIC_API_BASE_URL` absent du `mobile/.env` local, déjà le cas avant le rebrand. AC #7 non coché : à confirmer sur le runner CI Ubuntu. Le grep de l'AC #8 n'a plus d'objet pour `media-summarizer` (conservé volontairement) et ne trouve plus `Media Summarizer` dans le code.

Owner : `npx expo prebuild --clean` sur macOS pour constater `ios/DeepnShare/`, puis builds natifs iOS et Android à grouper avec task-180. `dispatchable: false` : plus rien à faire pour un agent.
<!-- SECTION:NOTES:END -->
