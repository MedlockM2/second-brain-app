---
id: TASK-630
title: Préserver l’attribution et les listes imbriquées dans l’extraction d’article
status: To Do
assignee: []
created_date: '2026-11-15 12:57'
labels:
  - ingestion
  - backend
  - bug
dependencies: []
priority: medium
ordinal: 229000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Retour bêta du 15 novembre 2026 sur le build 27 (iPhone 16e, 390x844 pt, iOS 27.2.1, fr-FR) : « Ici il a mal digéré l’article en oubliant de noter qui a dit quoi », sur https://www.ifrap.org/comparateurs/presidentielles-2027

La page liste, par thème, chaque candidat (photo et nom) suivi de ses propositions numérotées. Dans « Texte complet », il ne reste que des puces, une par candidat, chacune collant toutes ses propositions en une seule phrase ; aucun nom n’apparaît.

Reproduit en local en passant la page dans article_markdown() : les noms des deux premiers candidats sont absents du Markdown produit. Deux causes, toutes deux dans media_summarizer/infrastructure/resolvers/article_markdown.py :

1. Le nom du candidat est dans un <figure><figcaption>, à côté de sa photo. trafilatura l’abandonne à l’extraction, qui est appelée sans images.
2. Chaque candidat est un <li> qui contient un <ol> de propositions. _blocks() rend chaque item par _flat(item), ce qui aplatit la liste imbriquée en une seule phrase.

Le défaut est côté backend : il est actif quel que soit le build installé, et il est partagé par le mobile et le web. Correction claire, sans choix technique ouvert : une tâche unique, sans benchmark.

Note au propriétaire, hors critères d’acceptation : repartager l’article depuis l’iPhone après le déploiement du backend pour vérifier le rendu dans « Texte complet ».
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Les listes imbriquées sont rendues comme des sous-listes Markdown, un niveau de retrait par niveau d’imbrication d’origine, au lieu d’être aplaties en une seule phrase.
- [ ] #2 Le texte d’un figcaption placé en tête d’un élément de liste est conservé comme intitulé de cet élément.
- [ ] #3 Sur la page de comparateur citée en description, le Markdown produit par article_markdown() contient le nom de chaque candidat et ses propositions numérotées restées distinctes ; la sortie obtenue est consignée dans la tâche.
- [ ] #4 Le rendu d’un article sans figure ni liste imbriquée est inchangé, vérifié sur deux articles déjà traités.
- [ ] #5 ruff et mypy passent.
<!-- AC:END -->
