---
id: TASK-472
title: >-
  Générer les pages statiques de www.<domaine> : pages légales à jour,
  installation de l'extension, fichiers .well-known
status: To Do
assignee: []
created_date: '2026-10-11 15:54'
labels:
  - web
  - compliance
  - feature
dependencies:
  - TASK-443
  - TASK-471
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - docs/compliance/privacy-policy.md
  - docs/compliance/terms-of-service.md
  - docs/BRAND_IDENTITY.md
priority: medium
type: feature
ordinal: 79000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **W-02** du §3 du complément.

Le `Decision`, point 6 (point déduit n° 3 du complément, accepté) : **W-02 met à jour les textes légaux**. task-444 reste la relecture et la publication par l'owner ; elle ne réécrit pas les textes. Les pages légales de task-444 sont celles-ci, sur `www.<domaine>`, aux chemins `/privacy` et `/terms` (complément §9). Pas de générateur de site : un script.

## Périmètre

- Un générateur (script Node **sans dépendance de générateur de site**) qui produit du HTML statique depuis `docs/compliance/privacy-policy.md` et `docs/compliance/terms-of-service.md`, servi en `/privacy` et `/terms`. HTML seulement, pas de PDF.
- La page d'installation de l'extension, `/extension`, avec les liens vers le Chrome Web Store et Microsoft Edge Add-ons (un seul paquet pour les deux, `Decision` point 4).
- Le fichier `/.well-known/apple-developer-domain-association.txt`, nécessaire au *Services ID* Apple vérifié (complément §4). Son contenu vient de l'owner : s'il est propre au compte, il **n'est pas commité** ; le générateur le lit depuis un chemin hors dépôt ou une variable d'environnement documentée.
- **La mise à jour des textes, avant publication**, comme l'exige le `Decision` de task-357 : nom Deepn (plus aucune mention de `mediasummarizer`), adresse de contact retenue par task-443, et la liste des sous-traitants **réels et actuels**, établie en lisant le code : chaque fournisseur effectivement appelé, dont le modèle du chat et RevenueCat.
- La commande de génération est documentée (à côté du runbook de dépôt de W-01, task-471).

## Règles

Rien n'est déployé : aucune compatibilité. Pas de tests automatisés. Aucun secret, e-mail de connexion de compte cloud, identifiant de support ni donnée personnelle dans les fichiers suivis : l'adresse de contact publique choisie par l'owner dans task-443 n'est pas une adresse de connexion, mais si task-443 ne la consigne pas, la laisser en paramètre et le dire.

## Note à l'owner

Relecture juridique des deux textes, puis publication par task-444 (dépôt sur le bucket `www` par le runbook de task-471).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Un script Node sans dépendance de générateur de site produit /privacy et /terms en HTML depuis docs/compliance/privacy-policy.md et terms-of-service.md, sans PDF
- [ ] #2 Le script produit aussi la page /extension avec les liens vers les deux stores, et le fichier /.well-known/apple-developer-domain-association.txt dont le contenu propre au compte n'est pas commité
- [ ] #3 Les deux textes légaux ne citent plus mediasummarizer, nomment Deepn et l'adresse de contact de task-443
- [ ] #4 La liste des sous-traitants des textes légaux correspond aux fournisseurs appelés par le code, modèle du chat et RevenueCat compris
- [ ] #5 La commande de génération est documentée
<!-- AC:END -->
