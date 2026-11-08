---
id: TASK-619
title: Envoyer les notifications push dans la langue de l'app de chaque appareil
status: Done
assignee: []
created_date: '2026-11-08 18:18'
updated_date: '2026-11-08 18:39'
labels:
  - mobile
  - backend
  - i18n
dependencies: []
references:
  - media_summarizer/core/services/push_notification_dispatch.py
  - media_summarizer/workers/digest/scheduler.py
  - media_summarizer/workers/push_notification_worker.py
  - media_summarizer/utils/push_token_db.py
  - media_summarizer/api/endpoints/push_tokens.py
  - mobile/src/services/pushNotificationService.ts
  - mobile/src/i18n/index.tsx
  - packages/core/src/i18n/locales.ts
priority: medium
type: enhancement
ordinal: 225000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'app est traduite en 11 langues (`SUPPORTED_LOCALES` dans `packages/core/src/i18n/locales.ts`, repli `en`), mais ses notifications push sont toujours en anglais, en dur côté backend : « Ready to deepen / Your podcast episode has been processed. » (`push_notification_dispatch.py`) et « Your daily/weekly digest is ready / You saved N items… » (`workers/digest/scheduler.py`). Un testeur francophone reçoit donc ses notifications en anglais alors que tout le reste de l'app lui parle français.

Le commentaire du code justifie l'anglais par « le backend ne connaît pas la langue de l'app » et renvoie à task-404 §7.10 ; cette section ne traite pas de la langue. La décision de l'owner (2026-11-08) : chaque appareil reçoit ses notifications dans la langue de l'interface de son app, transmise par l'app elle-même — pas la `reading_language` du compte, qui est une préférence de contenu et peut différer de la langue de l'interface.

## Responsabilité

- **Côté app** : l'enregistrement du jeton (`POST /api/push-token`, aujourd'hui `{expo_push_token, platform}`) transmet aussi la langue courante de l'interface. Elle est choisie par l'utilisateur dans les réglages (`ui_locale`) ou déduite du système : quand elle change dans l'app, l'appareil se réenregistre pour que la langue stockée suive.
- **Côté backend** : la langue est validée contre les langues supportées (repli `en`) et stockée avec le jeton, par appareil — un compte peut avoir deux appareils dans deux langues.
- **Rendu** : un message de la file part vers tous les appareils d'un compte, donc le texte ne peut plus être figé par le producteur. Les producteurs (média prêt, Digest quotidien et hebdomadaire) décrivent la notification (son type et ses paramètres : catégorie du média, nombre d'éléments) et le worker rend titre et corps dans la langue de chaque jeton. Les 11 langues sont couvertes, pluriels compris.
- **Règle inchangée** (task-368, task-407) : le corps ne nomme que la catégorie du média, jamais le titre, l'auteur ni le service, puisque le personnel d'Expo peut lire les payloads.
- Le nom du canal Android (`notifications.mediaReadyChannel`, déjà traduit dans l'app) doit continuer de dire la même chose que le titre de la notification.

Pas de travail côté web : il n'a pas de notifications push. Le commit qui touche `mobile/` porte `Web: n/a (push notifications exist on mobile only)`.

Retirer l'ancien chemin sans compatibilité : les messages en file qui portent un titre et un corps littéraux disparaissent avec cette tâche. Un jeton enregistré sans langue (installé avant) est rendu en `en` jusqu'à son prochain enregistrement.

Note owner : la vérification réelle demande un build sur appareil après déploiement. Régler l'app sur une autre langue que celle du système, partager un média, et vérifier que la notification « prêt » arrive dans la langue de l'app ; même contrôle sur le Digest.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L'app envoie la langue de son interface à l'enregistrement du jeton push et se réenregistre quand cette langue change dans les réglages ; le backend la valide contre les langues supportées (repli `en`) et la stocke avec le jeton dans `user_push_tokens`.
- [x] #2 Les notifications « média prêt » et Digest (quotidien et hebdomadaire) sont rendues par le worker dans la langue de chaque jeton, pour les 11 langues de `SUPPORTED_LOCALES`, pluriels compris ; un jeton sans langue reçoit l'anglais.
- [x] #3 Plus aucun producteur ne place de titre ou de corps littéral en anglais dans la file des notifications ; l'ancien chemin est supprimé sans compatibilité.
- [x] #4 Le corps ne nomme toujours que la catégorie du média (ni titre, ni auteur, ni service), et le nom du canal Android reste cohérent avec le titre dans chaque langue.
- [x] #5 Ruff/mypy côté backend et le lint/typecheck mobile passent, sans ajout de tests automatisés ; le commit touchant `mobile/` porte sa ligne `Web: n/a` avec la raison.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**App** : `registerForPushNotifications(locale)` envoie `{expo_push_token, platform, locale}`. `usePushNotifications` lit `useTranslation().locale` (choix fait dans l'app, sinon langue du système) et associe l'enregistrement au couple `userId:locale` : changer de langue dans les réglages ré-enregistre l'appareil. Ce ré-enregistrement recrée aussi les deux canaux Android, si bien que leur nom passe dans la nouvelle langue.

**Backend** :
- `PushTokenRequest.locale` est obligatoire et normalisé par `normalize_locale` (partie langue, repli `en` hors des 11). Il est écrit avec `save_token` (`SET … locale = :locale`) et relu dans `PushToken.locale`. Une ligne sans locale est rendue en `en`.
- Nouveau `core/services/push_notification_copy.py` : les 11 locales, les règles de pluriel CLDR écrites à la main (zero/one/two/few/many/other pour l'arabe ; 0 et 1 au singulier pour fr, pt et hi ; pas de pluriel pour ja et zh), le rendu « média prêt » (une phrase complète par catégorie et par langue, pour l'accord en genre) et le rendu Digest quotidien et hebdomadaire.
- Les producteurs (`push_notification_dispatch`, `digest/scheduler`) ne mettent plus en file qu'un `notification: {kind, media_category}` ou `{kind, digest_type, item_count}`. Le worker regroupe les jetons par locale, rend une fois par groupe et déduit le canal du `kind`. L'ancien format `title`/`body`/`channel_id` est supprimé, sans compatibilité : un message à l'ancien format est journalisé comme `malformed` puis abandonné.
- Le corps ne nomme toujours que la catégorie. Les 11 titres « prêt » ont été comparés par script aux valeurs de `notifications.mediaReadyChannel` des catalogues : ils sont identiques.

**Vérifié** : `ruff check` et `mypy` propres sur les 7 fichiers backend (`ruff format` n'est pas appliqué dans le dépôt, les fichiers existants n'y sont pas conformes) ; `npm run typecheck` et eslint propres côté mobile. Script de cohérence : chaque catégorie de pluriel atteignable a sa forme, pour chaque locale et chaque période. Sur la vraie table `user_push_tokens-dev` : `save_token` avec `fr` puis `ja-JP`, relecture `fr` puis `ja` par `list_tokens_for_user`, puis suppression (compte et jeton fictifs).

**Également** : commentaires devenus faux corrigés (`locales.ts`, `i18n/index.tsx`, `en.ts`, `_layout.tsx`) ; `docs/compliance/privacy-policy.md` indique que la langue de l'app est stockée avec le jeton (date de mise à jour : 2026-11-08). Les fiches App Store et Play Data Safety sont inchangées : la langue n'y est pas une catégorie de données.

**Vérification owner (build sur appareil après déploiement)** : régler l'app sur une langue différente de celle du système, partager un média, vérifier que la notification « prêt » arrive dans la langue de l'app ; même contrôle sur le Digest. Le site légal doit être republié pour la politique de confidentialité.
<!-- SECTION:NOTES:END -->
