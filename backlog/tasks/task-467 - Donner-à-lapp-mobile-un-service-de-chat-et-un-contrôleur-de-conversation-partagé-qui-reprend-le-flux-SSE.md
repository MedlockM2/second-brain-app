---
id: TASK-467
title: >-
  Donner à l'app mobile un service de chat et un contrôleur de conversation
  partagé qui reprend le flux SSE
status: Done
assignee: []
created_date: '2026-10-10 18:00'
updated_date: '2026-10-10 22:32'
labels:
  - mobile
  - chat
  - feature
dependencies:
  - TASK-461
  - TASK-462
  - TASK-464
references:
  - docs/research/task-430-chatbot-architecture/README.md
  - >-
    docs/research/task-430-chatbot-architecture/complement-response-2026-10-07.md
  - docs/research/task-434-chatbot-integration-ui/README.md
  - mobile/app/_layout.tsx
  - mobile/src/services/apiClient.ts
  - mobile/src/constants/config.ts
  - mobile/app.config.ts
  - mobile/eas.json
  - scripts/mobile_ota_manifest_check.sh
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
modified_files:
  - mobile/src/types/chat.ts
  - mobile/src/services/chatService.ts
  - mobile/src/services/apiClient.ts
  - mobile/src/contexts/ChatSessionContext.tsx
  - mobile/app/_layout.tsx
  - mobile/src/constants/config.ts
  - mobile/app.config.ts
  - mobile/eas.json
  - scripts/mobile_ota_manifest_check.sh
priority: medium
type: feature
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'architecture du chat est décidée par l'owner dans `docs/research/task-430-chatbot-architecture/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-10 — **source de vérité**, qui prime sur la Recommendation (pas de flux, polling) et sur le complément. L'intégration UI est décidée dans `docs/research/task-434-chatbot-integration-ui/README.md`, section Owner Validation : **direction F, composeur persistant, au niveau d'un média et d'un dossier, visible seulement dans l'onglet Lecture d'un média et dans l'onglet Sources d'un dossier**, pas sur la bibliothèque.

Cette tâche livre la couche non visuelle que l'UI (tâche suivante) consommera : le service réseau et le contrôleur de conversation. Decision point 1 : « Le service et le contrôleur de conversation mobiles sont **partagés entre les deux portées** ; la navigation entre écrans ne porte pas la durée de vie d'une génération. » Le README de task-434 §6.5 nomme la forme qui correspond : un contexte monté au-dessus de la navigation, comme `AuthContext`, `ThemeContext` et `UserPreferencesContext` le sont déjà dans `mobile/app/_layout.tsx`.

## Ce que la couche fait

- **`mobile/src/services/chatService.ts`** (neuf) : les appels REST sous `/api/chat` par `apiClient` (ouvrir, lister par portée, lire, supprimer une conversation ; envoyer un tour ; arrêter), selon le contrat écrit dans `docs/CANONICAL_MEDIA_API_CONTRACT.md` par les tâches backend ; et la **lecture du flux SSE** sur la porte de diffusion, par `expo/fetch` (`resp.body.getReader()`, `TextDecoderStream`, documentés en SDK 55, la version du dépôt — complément C1.10 : aucune dépendance npm nouvelle), avec l'en-tête `Authorization` existant.
- **Types** dans `mobile/src/types/chat.ts`, y compris les états d'un tour (en cours, terminé, interrompu avec sa cause — arrêt volontaire ou plafond de sortie atteint —, échec, échec partiel) et les refus typés.
- **Reprise** (Decision point 6) : le flux est repris avec l'identité de génération et le dernier numéro de séquence reçu ; les événements déjà reçus sont dédupliqués par séquence ; un 204 veut dire « plus rien d'actif » et déclenche une relecture de la conversation. Une coupure réseau ou un changement d'écran laisse la génération continuer côté serveur ; **au retour au premier plan** (`AppState`), le contrôleur relit l'état durable (lecture de la conversation) puis reprend le flux ou récupère la réponse finale. Quand le flux ne s'ouvre pas, repli sur la lecture de la conversation.
- **Arrêt** : seule une action explicite de l'utilisateur appelle la route d'arrêt. **Jamais depuis un nettoyage de démontage d'écran** (le patron cité dans le Decision : « Route cleanup is a disconnect, not an explicit stop »). Fermer le lecteur de flux n'est pas un arrêt.
- **`ChatSessionContext`** (neuf), monté au-dessus de la navigation : porte la conversation active par portée, son état de génération et le texte reçu, pour qu'un écran qui revient retrouve l'état sans relancer quoi que ce soit.
- **Configuration** : l'URL de la porte de diffusion est une variable publique (`EXPO_PUBLIC_…`) lue dans `mobile/app.config.ts` et `mobile/src/constants/config.ts` sur le modèle d'`API_BASE_URL` (qui lève si elle manque), posée dans **chaque** profil de `mobile/eas.json` ; `scripts/mobile_ota_manifest_check.sh` la vérifie comme il vérifie `apiBaseUrl`, sinon une publication OTA sans elle casse le chat en silence (complément C1.5). La valeur `-dev` est la sortie Terraform de l'URL de l'étage créée par la tâche de diffusion SSE (le lire en `-dev` par l'AWS CLI, profil `second-brain-app`, une fois déployée, ou laisser une note si elle ne l'est pas).

## Règles

Rien n'est déployé : pas de compatibilité. Pas de tests automatisés ni de suite Maestro en critère. Aucun texte visible dans cette tâche, donc pas d'i18n ici sauf messages d'erreur internes non affichés.

## Note à l'owner

La vérification se fait avec l'UI de la tâche suivante, sur un build de dev pointant l'API dev déployée.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 mobile/src/services/chatService.ts couvre l'ouverture, la liste par portée, la lecture et la suppression d'une conversation, l'envoi d'un tour et l'arrêt, selon le contrat de docs/CANONICAL_MEDIA_API_CONTRACT.md, et lit le flux SSE par expo/fetch sans dépendance npm nouvelle
- [x] #2 Le flux est repris avec l'identité de génération et le dernier numéro de séquence, les événements sont dédupliqués par séquence, un 204 ou un échec d'ouverture déclenche une relecture de la conversation
- [x] #3 Au retour au premier plan, le contrôleur relit l'état durable puis reprend le flux ou récupère la réponse finale
- [x] #4 La route d'arrêt n'est appelée que par une action explicite, jamais depuis un nettoyage de démontage, et la fermeture du flux n'appelle pas l'arrêt
- [x] #5 Un ChatSessionContext monté au-dessus de la navigation dans mobile/app/_layout.tsx porte la conversation active par portée et son état de génération, partagé entre média et dossier
- [x] #6 L'URL de diffusion est une variable publique lue dans app.config.ts et config.ts, posée dans chaque profil de eas.json et vérifiée par scripts/mobile_ota_manifest_check.sh
- [x] #7 npx tsc --noEmit et le lint du projet mobile passent
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Couche non visuelle du chat mobile.

- `src/types/chat.ts` : conversations, messages, états de tour (dont `interrupted` et ses causes `cancelled`, `output_limit` et `provider_error` pour l'échec partiel), identité de génération, refus typés, événements du flux.
- `src/services/chatService.ts` : ouvrir, lister par portée, lire, supprimer, envoyer un tour (avec un `client_request_id` de `expo-crypto`, réutilisé pour un renvoi de la même question), arrêter. Lecture SSE par `expo/fetch` (`body.getReader()` et `TextDecoder` installé par le runtime Expo), sans dépendance npm nouvelle, avec l'`Authorization` et le rejeu 401 existants (`sendAuthenticated`, désormais exporté de `apiClient`). Gère 204 → `idle`, 409 `generation_stale` → identité vivante, échec d'ouverture → `unavailable`.
- `src/contexts/ChatSessionContext.tsx`, monté dans `app/_layout.tsx` sous `PurchasesProvider` et au-dessus du navigateur. Il porte une session par portée (`media:<id>`, `folder:<id>`) : conversation active, génération suivie, texte reçu, `lastSeq`, phase. Le flux est repris avec l'identité et `after_seq`, et les fragments déjà reçus sont ignorés. Un 204, un `end` ou une coupure déclenchent la relecture de la conversation ; sur `replaced`, le texte repart de zéro sous la nouvelle tentative. Si le flux est indisponible, le contrôleur relit la conversation toutes les 2 s et retente le flux toutes les 10 s (pas de boucle de reconnexion). Au retour au premier plan (`AppState`), il relit l'état durable puis reprend ; en arrière-plan, au changement de compte ou en quittant un écran, il se déconnecte seulement. `stopGeneration` est le seul chemin vers la route d'arrêt. Hook `useChatSession(scope, scopeId)` pour l'UI.
- Configuration : `EXPO_PUBLIC_CHAT_STREAM_URL` → `extra.chatStreamUrl` (`app.config.ts`) → `Config.CHAT_STREAM_URL` (vide toléré : repli par relecture). La variable est posée dans chaque profil de `eas.json`, vide pour l'instant. `scripts/mobile_ota_manifest_check.sh` exige qu'elle soit déclarée dans le profil et que le manifest servi porte la même valeur ; il avertit si elle est vide. Testé hors ligne : conforme → 0, écart → 1.

Vérifications : `npx tsc --noEmit` passe ; `npm run lint` donne 0 erreur (1 avertissement préexistant dans `purchaseService.ts`).

Note à l'owner : l'URL de diffusion n'existe pas encore en dev (aucune REST API dans le compte au 2026-10-11 ; elle apparaîtra après le `terraform apply` de task-464). La valeur à poser dans chaque profil de `mobile/eas.json` est alors la sortie `chat_stream_url`. Comme `extra` entre dans l'empreinte native, ce changement demande un nouveau build, pas seulement une OTA. La vérification fonctionnelle se fera avec l'UI de task-468.
<!-- SECTION:FINAL_SUMMARY:END -->
