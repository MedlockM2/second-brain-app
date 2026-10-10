---
id: TASK-438
title: >-
  Diagnostiquer et corriger le gel de l'app tierce quand on y revient après un
  partage vers notre app
status: Done
assignee:
  - '@Codex'
created_date: '2026-10-08 14:20'
updated_date: '2026-10-10 15:02'
labels:
  - mobile
  - bug
dependencies: []
references:
  - mobile/SHARE_INTENT_DIAGNOSTIC.md
priority: high
type: bug
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Symptôme observé par le propriétaire en usage beta : on partage un contenu depuis une app tierce vers notre app, notre app prend la main et ouvre son parcours d'enregistrement normalement, puis on repasse à l'app tierce — et celle-ci est parfois gelée. Son interface ne répond plus ; il faut la tuer et la relancer. C'est intermittent, et le partage lui-même aboutit : ce n'est pas une perte de contenu, c'est l'app d'en face qu'on laisse cassée. Le partage étant le premier geste d'usage du produit, c'est ce que le testeur rencontre le plus souvent.

Ce qui n'est pas encore établi et fait partie du travail : sur quel OS le gel se produit, depuis quelles apps tierces, pour quels types de contenu (URL, texte, image, fichier), et si l'intermittence suit un facteur identifiable (notre app déjà lancée ou démarrée à froid, session expirée, gros fichier).

Pistes de mécanique, à vérifier et non à présumer :
- Sur iOS, `expo-share-intent` génère une extension de partage (voir le bloc `"expo-share-intent"` de `mobile/app.config.ts` et le commentaire sur `iosShareExtensionName`). Une extension qui n'appelle jamais `completeRequest(returningItems:)`, ou qui l'appelle après avoir ouvert l'app hôte par son schéma d'URL, laisse le view service de l'extension vivant et la transition de la feuille de partage non résolue chez l'app présentatrice : c'est exactement ce qui se lit comme un gel. Le code concerné est généré par le plugin au prebuild, pas écrit dans le dépôt.
- Côté réception, l'intake passe par `src/contexts/ShareIntentContext.tsx`, `app/+native-intent.tsx` et `app/share-confirmation.tsx`. task-188 a déjà corrigé une course au démarrage à froid sur cette même chaîne, et task-278 un cas de session expirée : les deux sont des précédents utiles sur la façon dont ce chemin se comporte mal.
- Sur Android, l'entrée est un intent `SEND` déclaré par `androidIntentFilters` ; le mode de gel y serait différent (tâche/activité de l'app tierce bloquée) et doit être distingué du cas iOS.

Cadre de travail : l'implémenteur travaille dans un worktree isolé, sans build ni déploiement. Un gel de ce type ne se constate que sur un device avec un build natif, donc ce qui est attendu ici est un diagnostic écrit, étayé par la lecture du code et de la configuration (y compris le code généré par le plugin, à inspecter via un prebuild local), puis le correctif si la cause est dans ce que nous contrôlons.

Note au propriétaire (hors critères d'acceptation) : la confirmation finale demande un build et un device réel. Après merge et build, refaire le parcours depuis au moins Safari, une app de messagerie et une app de photos, sur iOS et sur Android, app déjà lancée puis tuée, et vérifier que l'app tierce reste utilisable au retour. Si le diagnostic conclut que la cause est en amont dans `expo-share-intent`, la décision d'appliquer une rustine ou d'attendre l'upstream revient au propriétaire.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Une procédure de reproduction est écrite (OS, app tierce, type de contenu, état de notre app, enchaînement des gestes) ; si le gel ne se reproduit pas, les combinaisons essayées et le résultat de chacune sont listés
- [x] #2 Le diagnostic distingue explicitement le cas iOS (extension de partage) du cas Android (intent `SEND`), et dit lequel est en cause ou pourquoi la question reste ouverte
- [x] #3 La cause probable est désignée par un fichier et une ligne — dans le dépôt, dans la configuration de `app.config.ts`, ou dans le code natif généré par `expo-share-intent` au prebuild, qui est alors cité par son chemin généré
- [x] #4 Le chemin qui termine la requête de l'extension iOS et rend la main à l'app présentatrice est décrit tel qu'il existe aujourd'hui, avec le point exact où il peut ne pas s'exécuter
- [ ] #5 Les événements Sentry (task-413) sont consultés pour ce scénario, et le diagnostic dit ce qu'ils montrent ou constate qu'aucun événement n'est remonté
- [x] #6 Si la cause est dans notre code ou notre configuration, le correctif est en place dans le dépôt ; si elle est en amont dans `expo-share-intent` ou dans Expo, l'issue upstream est identifiée et les options (rustine, option de plugin, contournement) sont exposées avec leur coût
- [x] #7 Le diagnostic et la décision sont écrits dans un fichier du dépôt, là où le prochain lecteur du chemin de partage les trouvera
- [x] #8 `npx expo config --type public` aboutit dans `mobile/`, et `npm run lint` et `npx tsc --noEmit` passent
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Appliquer iosHideView:false et actualiser le diagnostic dans un worktree isolé. 2. Vérifier le code iOS généré par prebuild, expo config, lint et TypeScript, sans tests automatisés ni build natif local. 3. Consigner la validation et ses limites, committer uniquement TASK-438 et pousser main selon la demande du propriétaire.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Investigation ciblée du 2026-10-10 à la demande du propriétaire, sans implémenter le correctif. Diagnostic : mobile/SHARE_INTENT_DIAGNOSTIC.md.

Piste iOS forte : issues upstream https://github.com/achorein/expo-share-intent/issues/217 (Expo 55 / package 6.1.1, notre stack exacte) et https://github.com/achorein/expo-share-intent/issues/216. Notre configuration omet iosHideView ; le prebuild génère hideView=true et lance le traitement dans viewDidLoad (ios/MediaSummarizerShare/ShareViewController.swift:35). completeRequest est présent ligne 510 : la piste est une terminaison trop précoce dans le cycle UIKit, pas un appel nominal absent. Un commentaire upstream rapporte que la sélection via « Plus… » gèle l'app source, contrairement à la rangée de suggestions : facteur à inclure dans la reproduction.

Option candidate : iosHideView:false. Comparée dans une copie temporaire isolée : les deux prebuilds iOS réussissent ; la seule différence du contrôleur est le booléen ligne 16, qui sélectionne alors le traitement dans viewDidAppear. Non appliquée au dépôt. Coût : flash possible de la modale et nouveau binaire iOS ; une OTA JS seule ne suffit pas. Alternative : patch-package du cycle de présentation, avec entretien et validation native supplémentaires. Les issues sont toujours ouvertes. Le cas Android reste distinct et non établi.

Sentry consulté en lecture seule : un seul projet accessible avec les credentials configurés, plateforme python-fastapi, et une seule issue exemple FastAPI sur les 14 derniers jours, sans page suivante. Aucun diagnostic mobile exploitable dans ce périmètre ; vérifier que le DSN du binaire et les credentials de consultation ciblent le projet React Native. Cela ne prouve pas une absence d'événements ailleurs.

expo config --type public et tsc --noEmit : exit 0 ; npm run lint : exit 0 avec le warning préexistant de purchaseService.ts:136. Aucun test automatisé ajouté/exécuté. Aucun build ni déploiement. Aucun critère coché et tâche laissée To Do : investigation uniquement, OS du signalement non confirmé et reproduction sur appareil non effectuée. Le document décrit la procédure à exécuter et les limites de preuve.

Retour propriétaire du 2026-10-10 : il a comparé les deux chemins de sélection ; seul le partage via « Plus… » fait planter l'app source. Cela confirme le facteur de reproduction du commentaire upstream de #217. Diagnostic mobile/SHARE_INTENT_DIAGNOSTIC.md actualisé. Relecture upstream : #216 et #217 restent ouvertes ; iosHideView:false est le contournement documenté et rapporté efficace dans #216, avec flash possible de la modale. Aucun correctif runtime appliqué et aucun résultat du contournement sur notre build à ce stade.

Correctif appliqué le 2026-10-10 sur demande explicite du propriétaire : iosHideView:false dans mobile/app.config.ts, avec commentaire pointant vers mobile/SHARE_INTENT_DIAGNOSTIC.md. L'extension utilise ainsi viewDidAppear plutôt que viewDidLoad. Aucun patch de dépendance, aucune modification Android ni du parcours React.

Validation dans un worktree isolé : prebuild iOS --no-install exit 0, contrôleur généré ios/MediaSummarizerShare/ShareViewController.swift:16 = hideView:false et traitement dans viewDidAppear:42 ; expo config --type public exit 0 ; npm run lint exit 0 (un warning préexistant purchaseService.ts:136) ; tsc --noEmit exit 0. Aucun test automatisé ni build natif local.

AC #1 : procédure écrite dans le diagnostic, avec OS, apps/contenus, états et gestes ; le propriétaire confirme la différence Plus… / autre sélection, mais n'a pas précisé toutes les métadonnées de son essai. Aucun résultat du correctif sur appareil n'est affirmé. AC #2–4 et #6–7 : diagnostic livré avec distinction Android/iOS, chemins/lignes natifs, terminaison et options/coûts, décision propriétaire et option appliquée. AC #8 : commandes ci-dessus réussies.

AC #5 laissé non coché : Sentry a été consulté, mais les credentials configurés ne donnent accès qu'à un projet python-fastapi avec une issue exemple. Aucun projet mobile visible ; impossible de consulter les événements React Native avec cet accès. La limite et la méthode de récupération sont documentées, sans valeur sensible.

Confirmation finale hors AC : installer le nouveau binaire iOS que la CI doit produire après push et retester via Plus…, puis via les suggestions, avec plusieurs apps sources et états chaud/froid. Une OTA JavaScript seule ne livre pas cette modification native ; flash de modale possible. Le propriétaire a autorisé commit et push.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Contournement iOS iosHideView:false appliqué après reproduction propriétaire via Plus…. Diagnostic et décision livrés. Prebuild, expo config, lint et TypeScript passent ; confirmation sur nouveau binaire iOS encore nécessaire. AC #5 non coché : accès Sentry mobile indisponible.
<!-- SECTION:FINAL_SUMMARY:END -->
