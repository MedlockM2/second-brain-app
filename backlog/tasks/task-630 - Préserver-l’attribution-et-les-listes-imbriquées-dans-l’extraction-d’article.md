---
id: TASK-630
title: Préserver l’attribution et les listes imbriquées dans l’extraction d’article
status: Done
assignee: []
created_date: '2026-11-15 12:57'
updated_date: '2026-11-15 13:15'
labels:
  - ingestion
  - backend
  - bug
dependencies: []
modified_files:
  - media_summarizer/infrastructure/resolvers/article_markdown.py
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
- [x] #1 Les listes imbriquées sont rendues comme des sous-listes Markdown, un niveau de retrait par niveau d’imbrication d’origine, au lieu d’être aplaties en une seule phrase.
- [x] #2 Le texte d’un figcaption placé en tête d’un élément de liste est conservé comme intitulé de cet élément.
- [x] #3 Sur la page de comparateur citée en description, le Markdown produit par article_markdown() contient le nom de chaque candidat et ses propositions numérotées restées distinctes ; la sortie obtenue est consignée dans la tâche.
- [x] #4 Le rendu d’un article sans figure ni liste imbriquée est inchangé, vérifié sur deux articles déjà traités.
- [x] #5 ruff et mypy passent.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Deux changements dans `article_markdown.py` :

1. `_captions_to_headings` s'exécute avant trafilatura. Quand un `<li>` commence par un `<figure>` (directement, ou à travers des `div`/`span`/`a` sans texte propre), ce figure est remplacé par un `<p>` qui porte le texte du `<figcaption>`. Le nom devient alors le premier paragraphe de l'élément, donc son intitulé.
2. `_list_lines` remplace `"- " + _flat(item)`. Les listes imbriquées sont rendues récursivement, avec un retrait égal à la largeur du marqueur parent (règle CommonMark) : `- ` donne 2 espaces, `1. ` en donne 3. Une `<list rend="ol">` est numérotée `1.`, `2.`… Chaque `<p>`/`<head>`/`<quote>` d'un élément occupe sa propre ligne de continuation, tandis que les liens `<ref>` restent dans leur phrase. Un élément sans texte propre rend ses sous-listes à son propre niveau. Le parseur partagé (`packages/core/src/chat/markdown.ts`) lit déjà les sous-listes (profondeur ≤ 2) et les lignes de continuation : rien à changer côté mobile ni côté web.

AC #3 : page https://www.ifrap.org/comparateurs/presidentielles-2027 récupérée le 2026-11-15 et passée dans `extract_clean_text` (donc `article_markdown` puis le normaliseur). La page compte 462 `<figcaption>` (14 candidats × 33 thèmes). Le Markdown produit contient 462 lignes `- <Nom>`, soit 33 pour chacun des 14 candidats. Début de la sortie :

```
## Finances publiques

## Economies & hausses de dépenses

- Nathalie Arthaud
  1. Réquisitionner les profits des compagnies pétrolières et d’armement :
     -> les consacrer aux besoins de la population : hôpitaux, écoles, logements, services publics...
  2. Réquisitionner les profits du grand patronat pour augmenter les salaires.
- Gabriel Attal
  Chiffre clé 150 Md€
  Lancer un plan de 150 Md€ d’économies sur le quinquennat.
  1. Faire un projet de loi de finances rectificative dès les premiers mois après l’élection.
  2. Faire une année blanche sur l’ensemble des prestations sociales pour le budget 2028 sans toucher aux petites retraites.
  ...
  7. Instaurer une loi de programmation économique, fiscale et énergétique sur dix ans.
- Nicolas Dupont-Aignan
  Chiffre clé 130 Md€
  Réaliser 130 Md€ d'économies d'ici 2032.
  1. Réaliser environ 130 Md€ d'économies d'ici 2032.
```

L'encadré « Chiffre clé » se trouve après la sous-liste sur la page. Il remonte ici sous le nom, car une ligne de continuation placée après la sous-liste serait rattachée à son dernier élément.

AC #4 : sortie identique octet pour octet, avant et après, sur deux articles déjà traités sur dev : Frandroid « GPT-6 Astra » et FrenchWeb « Mirakl vaut-il vraiment 35 milliards » (ce dernier contient deux listes plates). Seul autre écart constaté, sur Wikipedia « Spaced repetition » : sa liste de références `<ol>` sort désormais numérotée `1.`… au lieu de `-`, ce qui correspond à la page.

AC #5 : ruff check, ruff format --check et mypy passent sur le fichier.

Le texte déjà stocké ne change pas. Il faut repartager l'article après le déploiement (voir la note au propriétaire).
<!-- SECTION:NOTES:END -->
