---
id: TASK-420
title: Retirer le seuil empirique CARD_MIN_OPACITY du fondu du menu contextuel
status: To Do
assignee: []
created_date: '2026-09-29 13:24'
labels:
  - mobile
  - cleanup
dependencies: []
references:
  - mobile/src/components/AnchoredContextMenu.tsx
  - mobile/src/components/GlassSurface.tsx
  - mobile/src/components/MediaDetailHero.tsx
  - docs/testflight-feedback-log.md
priority: low
type: chore
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Découvert au passage pendant le triage des feedbacks beta du 2026-09-29, sans être rapporté par un testeur : `AnchoredContextMenu` anime l'apparition de sa carte de menu en pilotant l'`opacity` de `cardWrapper`, un ancêtre de la vue de verre. Comme `expo-glass-effect` refuse de dessiner son matériau dès qu'une `opacity` inférieure à 1 est posée sur la vue ou l'un de ses ancêtres, le fondu part de `CARD_MIN_OPACITY = 0.05` au lieu de 0 (`mobile/src/components/AnchoredContextMenu.tsx:156`, `:239-244`).

Le commentaire en place est honnête sur ce qu'il fait : maintenir le matériau dans l'arbre de rendu pendant toute l'animation en restant invisible à la première image. **Mais 0,05 est une valeur trouvée à l'usage face à une contrainte formulée en « strictement inférieur à 1 » — pas une valeur que la contrainte autorise.** Rien ne garantit que la prochaine version d'`expo-glass-effect`, ou une autre densité d'écran, continue de peindre le matériau à 5 %. Ça fonctionne aujourd'hui ; ça repose sur un seuil, pas sur un mécanisme.

C'est exactement le piège qui a produit le défaut rapporté le 2026-09-29 sur le bandeau de titre de `MediaDetailHero` (registre `docs/testflight-feedback-log.md`, `ANlesyTagOEOrwZx2yj70ko`) : un `opacity: 0` posé sur un `GlassSurface` le laissait en boîte vide non teintée pour toute la vie de la page. Ce site-là ne repose plus sur un seuil — la vue masquée a disparu avec la mesure qui la justifiait. Celui-ci reste le dernier endroit du dépôt où une vue de verre dépend d'une valeur d'alpha empirique.

Pistes, à trancher par l'implémenteur — aucune ne demande d'arbitrage produit, l'animation doit rester identique à l'œil :
- animer autre chose que l'`opacity` d'un ancêtre du verre (l'échelle est déjà animée ; un fondu porté par une couche non-verre superposée, ou par le voile de la carte, ne touche pas le matériau) ;
- ou monter/démonter la carte sur les bornes de l'animation plutôt que la faire tendre vers l'invisible, en s'assurant que la vue de verre n'est jamais mise en page pendant qu'elle est masquée — `expo-glass-effect` n'installe l'effet qu'au premier passage de layout, donc un montage tardif est correct mais un montage masqué ne l'est pas.

Périmètre strictement local : un composant, aucune API publique, aucun choix de design ouvert — donc pas de benchmark.

**Note à l'owner, hors critères d'acceptation :** le rendu de l'animation ne se juge pas depuis un worktree. À regarder sur appareil iOS 26 (matériau `GlassView`) *et* sur un iOS antérieur (`BlurView`), en ouvrant le menu contextuel depuis une tuile de la Bibliothèque : la carte doit apparaître teintée dès la première image, sans saut d'opacité ni palier visible.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `CARD_MIN_OPACITY` n'existe plus dans `mobile/src/components/AnchoredContextMenu.tsx`, et aucune constante d'alpha empirique ne la remplace
- [ ] #2 Aucune `opacity` strictement comprise entre 0 et 1 n'est posée sur la vue de verre de la carte ni sur aucun de ses ancêtres, à aucune image de l'animation d'ouverture comme de fermeture
- [ ] #3 La vue de verre n'est jamais mise en page alors qu'elle est masquée : soit elle est absente de l'arbre, soit elle est visible
- [ ] #4 Les durées `OPEN_DURATION` et `CLOSE_DURATION` et la courbe d'échelle de la carte sont inchangées — l'animation reste la même à l'œil
- [ ] #5 Le commentaire de tête du composant explique le mécanisme retenu et pourquoi il ne dépend plus d'un seuil, en gardant la contrainte `expo-glass-effect` nommée pour le prochain lecteur
- [ ] #6 `GlassSurface.tsx` ne cite plus `CARD_MIN_OPACITY` comme l'exemple à suivre : sa section « No tolerance for alpha » renvoie au mécanisme retenu
- [ ] #7 `npx tsc --noEmit` et `npx eslint` sortent propres sur `mobile/`
<!-- AC:END -->
