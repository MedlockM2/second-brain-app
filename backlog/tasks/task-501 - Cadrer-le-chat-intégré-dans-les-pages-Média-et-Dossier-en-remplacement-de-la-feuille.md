---
id: TASK-501
title: >-
  Cadrer le chat intégré dans les pages Média et Dossier en remplacement de la
  feuille
status: Done
assignee:
  - '@codex'
created_date: '2026-10-12 09:41'
updated_date: '2026-10-12 12:38'
labels:
  - benchmark
  - mobile
  - chat
  - testflight
dependencies: []
documentation:
  - docs/research/task-434-chatbot-integration-ui/README.md
  - AGENTS.md
type: spike
ordinal: 108000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seconde partie du retour AD9M_CsdhTTaHMyX0_NSuig : afficher le clavier directement sur la page, conserver le transcript puis ajouter questions/réponses dessous, déplacer historique et nouvelle conversation dans l'en-tête. Cela révise la direction F validée dans task-434. Comparer les options de navigation et de défilement pour un long transcript, la page dossier, l'historique et l'onglet IA. Produire docs/research/task-501-chat-inline/README.md avec Owner Validation et owner_decision: pending ; attendre la décision owner avant l'implémentation dépendante.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le README compare les parcours média et dossier, le défilement de longs contenus, le clavier et les conversations passées, avec recherche internet et recommandation justifiée.
- [x] #2 Des maquettes couvrent les états lecture, rédaction, génération et historique dans le design system de l'app.
- [x] #3 Le README porte owner_decision: pending et un champ Decision destiné à l'owner ; les conséquences sur task-434 sont explicites.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Examiner la décision task-434, les pages média/dossier et les composants de chat actuels.
2. Comparer les parcours intégrés, le défilement, le clavier et l’historique à partir de sources officielles.
3. Produire la recommandation et des maquettes des états lecture, rédaction, génération et historique dans Amber Clarity.
4. Vérifier les livrables, consigner les critères satisfaits, revenir à To Do en attente de décision owner et committer.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-12 — Mode initial. Livré docs/research/task-501-chat-inline/README.md et mockups.html : comparaison de sept parcours, trois structures de défilement, neuf sources officielles, règles clavier/ancres/historique/IA/Digest et huit maquettes interactives Amber Clarity.
Précision owner intégrée : les questions/réponses sont masquées lorsque le composeur est fermé ; son ouverture les affiche sous le contenu, sa fermeture les masque sans arrêter la génération.
Vérification manuelle Chrome : ouverture/fermeture, envoi fictif, historique/reprise, séparation IA, clair/sombre, 320/390, texte agrandi et contenu long (35 paragraphes/32 sources), sans débordement horizontal ; syntaxe JS et git diff --check propres. Aucun code applicatif ni test automatisé ajouté.
La recommandation attend la validation owner : owner_decision reste pending. Retour à To Do conformément au cycle des benchmarks ; TASK-502 reste bloquée.

2026-10-12 — Révision demandée par l’owner après revue : modal plein écran conservé, substitué sur place sans mouvement de feuille ; onglets Lecture/IA retirés de ce mode, historique et nouvelle conversation dans l’en-tête, transcript à largeur identique puis première question directement dessous. Retrait du compteur/plafond de saisie et des commandes/libellés supplémentaires autour du composeur.
mockups.html refait avec huit états interactifs, réponse fictive progressive et historique dans le même modal. README courant réécrit pour remplacer la précédente direction ; la formule historique « sans modal » de TASK-502 n’est plus applicable à la direction demandée.
Revue manuelle Chrome : largeur du paragraphe 358 avant/après sur cadre 390, modal sans animation ni transform, aucun onglet dans le modal, envoi/historique/reprise/sortie vérifiés, 1 200 caractères acceptés sans maxlength, 320/sombre/contenu long sans débordement horizontal. Syntaxe JS et diff propres. owner_decision reste pending jusqu’à validation des nouvelles maquettes.

2026-10-12 — Validation explicite de l’owner après revue des maquettes et correction de l’icône nouvelle conversation (stylo entrant dans un carré / create-outline). Le README faisant autorité consigne la décision finale, owner_decision: ok et la date de validation. Le livrable a été produit en pending avant cette approbation, conformément au cycle benchmark. TASK-501 est clôturée ; sa dépendante TASK-502 est débloquée, sans lancement de son implémentation dans cette mise à jour.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Benchmark et maquettes validés par l’owner le 12 octobre 2026 : modal plein écran sur place sans glissement, transcript/source pleine largeur au début du fil, historique et nouvelle conversation en haut avec icône create-outline, composeur sans limite ni commandes ou statuts superflus. Décision et date consignées dans le README ; TASK-501 Done, TASK-502 débloquée.
<!-- SECTION:FINAL_SUMMARY:END -->
