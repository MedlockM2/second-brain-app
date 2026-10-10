# Identité de marque — Deepn

Le nom commercial définitif de l’app est **Deepn**, choisi par l’owner le **2026-10-10**. Cette décision remplace les placeholders « Media Summarizer » et « Second Brain » lorsqu’ils désignent le produit.

- **Graphie publique** : `Deepn`, identique dans toutes les langues ; ne pas traduire le nom.
- **Entité légale / développeur** : `Second Brain Labs`.
- **Bundle ID iOS / package Android** : `com.secondbrainlabs.core`, inchangé.
- **Cibles du rebrand mobile (task-186)** : ce que l’utilisateur voit — display name `Deepn`, libellé de share sheet `Deepn Share` (nom de cible distinct de l’app). Décision owner du 2026-10-10 : les identifiants invisibles (slug Expo, scheme de deep link, package npm, projet GCP) gardent `media-summarizer`.
- **Identité Expo** : project ID UUID et slug `media-summarizer` inchangés ; aucun renommage côté dashboard.

## Application de la décision

La documentation produit et les textes préparés pour les stores portent désormais Deepn. Ce que l’utilisateur voit dans l’app (display name, 11 locales natives, libellé `Deepn Share` de la share sheet) est renommée dans le dépôt par **task-186** le 2026-10-10. Cela ne signifie pas que les binaires installés, les consoles stores, Google OAuth ou les captures ont déjà été renommés : le nouveau nom n’apparaît qu’avec une build native fraîche, à coordonner avec les icônes de **task-180**.

Le choix du nom n’atteste ni l’achat d’un domaine, ni la disponibilité d’une marque ou de handles sociaux. Aucun domaine n’est déduit de « Deepn » ; les placeholders `<domaine>` restent à remplacer par un domaine effectivement acquis.

## État du backlog au 2026-10-10

- **task-115 — recherche du nom** : déjà `Done` avant cette décision ; aucune recherche supplémentaire demandée.
- **task-186 — rebrand mobile** : livré dans le dépôt le 2026-10-10 (nom visible uniquement) ; reste à confirmer le check de release sur CI.
- **task-180 — icônes**, **task-118 — Discord**, **task-357 — pages légales** et **task-425 — site / extension** : le nom est disponible comme input ; leurs livrables restent à produire. Le choix du nom seul ne clôture aucune de ces tâches.
