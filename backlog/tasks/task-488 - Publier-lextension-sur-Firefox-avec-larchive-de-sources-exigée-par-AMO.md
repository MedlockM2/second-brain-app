---
id: TASK-488
title: 'Publier l''extension sur Firefox, avec l''archive de sources exigée par AMO'
status: Done
assignee:
  - '@codex'
created_date: '2026-10-11 15:59'
updated_date: '2026-10-11 18:07'
labels:
  - extension
  - feature
dependencies:
  - TASK-487
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - 'https://extensionworkshop.com/documentation/publish/source-code-submission/'
priority: medium
type: feature
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **X-04** du §3 du complément.

Le `Decision`, point 4 : un seul paquet pour Chrome et Edge (task-487), **puis Firefox avec son archive de sources**. AMO exige une archive de sources pour tout code passé par un outil qui combine ou minifie les fichiers, ce que fait WXT. Les relecteurs de Mozilla reconstruisent l'extension et comparent : « There must be no differences ». L'archive est jointe à **chaque** version, jusqu'à 200 Mo (complément §11).

Le complément §7 et §12 n'a **pas vérifié** la prise en charge d'`externally_connectable` par Firefox : cette tâche la vérifie dans la documentation de Mozilla. Si elle manque, l'appairage sur Firefox passe par le code de secours de task-485, déjà prévu pour ce cas.

## Périmètre

- La cible Firefox du build WXT : `browser_specific_settings.gecko.id`, et la **déclaration de collecte de données** du manifeste (Firefox 140 et plus).
- Le script qui produit l'**archive de sources** : les sources, le fichier de verrouillage du gestionnaire de paquets, et un README avec l'environnement (versions des outils) et les commandes de build, avec des outils open source uniquement.
- La vérification d'`externally_connectable` sur Firefox, consignée avec sa source, et le comportement d'appairage qui en découle (un clic, ou code de secours seul).
- Le document de publication de task-487 est complété pour AMO.

## Règles

Rien n'est déployé : aucune compatibilité. Pas de tests automatisés. Ne modifier aucun fichier de `mobile/`. Aucun secret ni identifiant de compte développeur dans les fichiers suivis.

## Note à l'owner

Soumission sur addons.mozilla.org avec l'archive jointe ; vérifier l'appairage sur Firefox après publication.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le build Firefox passe, avec browser_specific_settings.gecko.id et la déclaration de collecte de données dans le manifeste
- [x] #2 Un script produit l'archive de sources avec les sources, le fichier de verrouillage et un README qui donne l'environnement et les commandes de build
- [x] #3 La prise en charge d'externally_connectable par Firefox est consignée avec sa source, et l'appairage sur Firefox utilise le code de secours si elle manque
- [x] #4 Le document de publication couvre AMO
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ajouter la cible Firefox MV3, les déclarations Gecko et le code de secours seul, selon Mozilla.
2. Adapter les appels WebExtension aux API Firefox sans toucher mobile/.
3. Produire une archive de sources autonome et reproductible avec origines publiques et instructions AMO.
4. Vérifier typecheck, lint, builds Chromium/Firefox et reconstruction depuis l’archive ; documenter puis committer.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cible Firefox MV3 livrée : ID Gecko généré non personnel, minimum desktop 140/Android 142 pour le consentement intégré, quatre catégories de données réelles. API browser de WXT utilisées pour les promises natives Firefox ; initialisation du stockage différée, restrictions Chromium seules et aucun content script. Appairage Firefox uniquement par code de secours : Mozilla confirme l’absence de messaging depuis les pages web ; manifeste et bundle Firefox sans appairage externe. Le minimum Chromium passe à 140, première version qui expose setAccessLevel sur storage.local selon MDN.
Script sources:firefox : construit le zip Firefox et une archive autonome avec sources extension/core, lockfile, assets, uniquement les deux origines publiques et README de reconstruction indiquant OS/versions exactes. Archive automatique WXT désactivée car elle omet les sources partagées.
Validation : typecheck et lint extension passent ; zips Chromium/Firefox produits ; web-ext lint avec warnings-as-errors : 0 erreur, 0 notice, 0 warning. Archive générée avec Node 22.23.3/npm 10.8.2, extraite hors du dépôt, npm ci puis zip:firefox réussis ; comparaison du contenu des 35 fichiers : zéro différence. git diff --check et scan des ajouts propres. Aucun test automatisé ajouté ou lancé, aucun fichier mobile modifié.
Origines exemple utilisées pour cette validation : reconstruire avec les origines définitives avant publication. Firefox n’est pas installé sur ce poste ; parcours contre AWS, signature et soumission AMO non effectués, laissés à l’owner conformément à la note de la tâche.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Firefox MV3 et archive de sources AMO autonome livrés. Build, typecheck/lint, validation Mozilla sans avertissement et reconstruction de 35 fichiers à contenu identique vérifiés. Appairage Firefox par code de secours documenté avec sa source officielle. Publication et parcours réels à réaliser par l’owner.
<!-- SECTION:FINAL_SUMMARY:END -->
