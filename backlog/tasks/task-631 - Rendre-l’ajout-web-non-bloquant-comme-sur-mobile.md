---
id: TASK-631
title: Rendre l’ajout web non bloquant comme sur mobile
status: Done
assignee:
  - '@codex'
created_date: '2026-11-15 19:45'
updated_date: '2026-11-15 20:09'
labels:
  - web
  - parity
dependencies: []
references:
  - mobile/src/contexts/ShareIntentContext.tsx
  - mobile/src/lib/pendingSaves.ts
documentation:
  - web/README.md
priority: high
type: bug
ordinal: 230000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Décision du propriétaire du 15 novembre 2026 : l’ajout d’un lien sur le web attend la réponse ingest-url avant de libérer le formulaire, alors que le mobile démarre l’import et permet immédiatement le classement ou la poursuite de la navigation. Un cas observé prend 12,6 secondes. Aligner le comportement web sur le mobile en conservant le suivi des imports, la navigation, le classement et les erreurs. Aucun changement du backend ni du comportement mobile requis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La validation d’un ajout web lance un seul import et libère immédiatement la saisie ; le classement ou la navigation restent disponibles pendant la requête.
- [ ] #2 L’accueil et le dossier concerné affichent l’import provisoire, ouvrable avant l’arrivée de son identifiant serveur, puis le remplacent par le média réel sans doublon durable.
- [ ] #3 Un dossier choisi pendant l’enregistrement est appliqué à la sauvegarde correspondante, même après fermeture de la fenêtre ; aucun identifiant provisoire n’est envoyé à l’API.
- [ ] #4 Les échecs d’enregistrement et de classement restent visibles après fermeture ou changement de page ; les imports de fichiers, notes et enregistrements conservent leur suivi.
- [x] #5 Les contrôles TypeScript, ESLint et la compilation web passent ; le fonctionnement et les limites sont documentés sans ajout de tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Étendre le suivi web des imports provisoires aux liens, notes et fichiers : lancement détaché de la fenêtre, état consultable par clé, cycle de vie lié à la session et erreurs persistantes au niveau de l’app.
2. Faire passer immédiatement l’ajout global à la question de classement ; mémoriser le dossier choisi et ne l’envoyer qu’après réception de l’identifiant réel. Fermer immédiatement l’ajout contextuel au dossier.
3. Afficher les imports provisoires dans l’accueil, la bibliothèque et les dossiers, avec ouverture de leur page pendant l’attente et remplacement sans doublon à l’arrivée des listes serveur.
4. Réutiliser les libellés et contrôles existants, documenter les limites (navigation dans le même onglet ; aucune réduction du temps serveur) et vérifier typecheck, lint, build et diff. Aucun test automatisé ajouté ou exécuté.
5. Après autorisation explicite de publication (« oui vas y », 15 novembre 2026), fusionner et pousser main puis suivre le déploiement CI et vérifier le manifeste et les fichiers servis. Le propriétaire demande ensuite « Publier sans recette navigateur » ; conserver les AC d’interaction non vérifiés et documenter cette limite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémentation prête dans le worktree fix/web-background-imports : saisie libérée immédiatement, état de chaque import indépendant de la fenêtre, choix de dossier différé jusqu’à l’identifiant serveur, vignettes provisoires sur accueil/bibliothèque/dossier, page d’attente pour liens et fichiers, erreurs persistantes dans l’app et protection contre les résultats tardifs après changement de compte. Les reprises de liste avant la réponse POST et pendant un déplacement ont été revues pour éviter les doublons ; un échec de classement ne fait pas disparaître une sauvegarde réussie.

Vérifications locales : TypeScript via build, ESLint et compilation Vite mode ci réussis ; vérificateur du paquet en mode compilation-only réussi ; git diff --check propre. Aucun test automatisé ajouté ou exécuté. Avertissement Vite de taille du bundle déjà présent, sans nouvelle dépendance. Les AC 1 à 4 restent non cochés : les chemins UI sont implémentés et relus, mais aucune recette interactive sur la nouvelle version n’a encore été réalisée ; le runbook docs/WEB_RELEASE.md exige une instruction explicite de publication pour les opérations distantes. Ne pas assimiler la compilation à une validation en navigateur.

Publication autorisée par le propriétaire le 15 novembre 2026 (« oui vas y »). Commit fonctionnel 96863508 fusionné sur main (17887453), puis poussé. Workflow de déploiement dev lancé : https://github.com/MedlockM2/second-brain-app/actions/runs/43756170128 . Le pilotage du navigateur retourne « browser access host is unavailable » ; le propriétaire choisit explicitement « Publier sans recette navigateur ». Cette décision dispense de recette interactive pour cette livraison ; elle ne constitue pas une preuve de validation des AC 1 à 4.

Déploiement dev terminé avec succès le 15 novembre 2026 : https://github.com/MedlockM2/second-brain-app/actions/runs/43756170128 . La CI a validé la parité, TypeScript, ESLint, le build beta et le paquet, publié les fichiers puis terminé l’invalidation CloudFront. Vérification distante indépendante : https://dev.deepn.app/release.json annonce la révision 17887453889d6694d5b6ff83c9badf6a5a77178b, mode beta distribuable ; les cinq fichiers servis (index, JS, CSS et icônes) correspondent à leurs empreintes SHA-256. La livraison est clôturée avec la dispense explicite de recette navigateur du propriétaire. Les AC 1 à 4 restent volontairement non cochés pour ne pas faire passer cette preuve de publication pour une validation des interactions.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
L’ajout web libère immédiatement la saisie et suit chaque import hors de la fenêtre, avec vignette provisoire, ouverture avant l’identifiant serveur, classement différé et erreurs persistantes. Le suivi couvre liens, notes, fichiers et enregistrements ; le temps d’extraction backend reste inchangé. Commit 96863508 fusionné et publié sur dev après autorisation explicite du propriétaire. CI de publication réussie ; révision et empreintes des cinq fichiers servis vérifiées indépendamment. Recette navigateur non effectuée à la demande explicite du propriétaire (« Publier sans recette navigateur ») : les AC d’interaction 1 à 4 restent non cochés. Aucun test automatisé ajouté ou exécuté.
<!-- SECTION:FINAL_SUMMARY:END -->
