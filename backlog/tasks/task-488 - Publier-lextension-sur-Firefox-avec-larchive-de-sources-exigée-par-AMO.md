---
id: TASK-488
title: 'Publier l''extension sur Firefox, avec l''archive de sources exigée par AMO'
status: To Do
assignee: []
created_date: '2026-10-11 15:59'
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
dispatchable: true
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
- [ ] #1 Le build Firefox passe, avec browser_specific_settings.gecko.id et la déclaration de collecte de données dans le manifeste
- [ ] #2 Un script produit l'archive de sources avec les sources, le fichier de verrouillage et un README qui donne l'environnement et les commandes de build
- [ ] #3 La prise en charge d'externally_connectable par Firefox est consignée avec sa source, et l'appairage sur Firefox utilise le code de secours si elle manque
- [ ] #4 Le document de publication couvre AMO
<!-- AC:END -->
