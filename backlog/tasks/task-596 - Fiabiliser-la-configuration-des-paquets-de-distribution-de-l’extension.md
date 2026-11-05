---
id: TASK-596
title: Fiabiliser la configuration des paquets de distribution de l’extension
status: Done
assignee:
  - '@codex'
created_date: '2026-11-04 19:16'
updated_date: '2026-11-05 08:57'
labels:
  - web
  - v1-launch
  - agent
  - extension
dependencies: []
references:
  - extension/wxt.config.ts
  - extension/lib/config.ts
  - extension/lib/session.ts
  - extension/scripts/firefox_sources.py
  - extension/README.md
  - media_summarizer/api/endpoints/auth.py
priority: high
type: chore
ordinal: 203000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code/configuration/documentation et contrôles statiques dans son worktree. Aucun merge, push, déploiement, publication ou validation propriétaire demandé par les critères.

Les ZIP Chromium/Firefox passent au 2026-11-04 mais le paquet « production » construit localement utilise l’API AWS dev et une origine web localhost. WXT valide seulement la syntaxe des origines : il ne distingue pas paquet de développement et paquet à soumettre. Le README bannit aussi tout hôte dev pour publication, ce qui contredit la décision de garder le backend dev pendant la bêta. L’API dev n’est donc pas une erreur en soi ; le défaut est de pouvoir présenter un paquet local comme paquet de distribution sans vérifier la cible choisie.

Préparer un contrôle explicite des origines du manifeste et du bundle selon la livraison prévue. Le mode de vérification CI peut employer des origines fictives clairement identifiées, sans les annoncer comme domaines possédés ni soumettre le paquet. Réutiliser le même ZIP pour Chrome/Edge et le script de sources Firefox existant. Actualiser la documentation de session : le backend Cognito garde désormais un grant d’extension renouvelé, alors que lib/session.ts commente encore une rotation avec fenêtre de rejeu de 60 secondes ; ne pas réintroduire cette ancienne architecture. TASK-592/593 choisissent les valeurs réelles et publient. Aucune soumission, inscription de compte ni achat dans cette tâche agent.

Contraintes : aucun nouveau test automatisé. Ne pas modifier le sync Spotify, la livraison email, la génération des quiz, Whisper ni la facturation à crédits. Aucun secret, identité de compte ou compte reviewer dans les fichiers suivis. Les contrats restent sous /api/media et /api/artifacts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les commandes de livraison distinguent configuration locale, validation technique et distribution ; un paquet annoncé distribuable refuse une origine web localhost/incohérente et vérifie la concordance manifeste/bundle avec les origines choisies.
- [x] #2 La documentation autorise explicitement l’API dev pour la bêta lorsque retenue par le propriétaire, tout en exigeant la véritable origine publique de la web app et aucune URL exemple présentée comme publiée.
- [x] #3 Le paquet Chromium commun et le paquet/archive de sources Firefox existants sont intégrés au contrôle de livraison, sans copie de .env local, secret ou autre credential ; les permissions restent minimales.
- [x] #4 La documentation de session décrit le grant réellement servi par le backend courant sans réintroduire le mécanisme supprimé ; typecheck/lint et commandes de packaging passent avec une configuration de validation explicite.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Valider les origines WXT selon le mode réel : local/ci/distribution, avec HTTPS public obligatoire pour distribution, API dev autorisée et refus des noms réservés/loopback.
2. Ajouter une commande de packaging explicite qui construit puis inspecte ZIP, manifeste et bundle, et produit un reçu distinct pour validation/distribution ; garder le même ZIP Chromium pour Chrome/Edge.
3. Intégrer le script existant de sources Firefox sans récursion, en générant seulement le fichier d’origines publiques choisi et en contrôlant l’archive source.
4. Corriger les commentaires et le README sur le grant stable renouvelé, documenter les commandes et exécuter typecheck/lint/packaging de validation sous Node 22. Aucun appel backend/store et aucun test automatisé.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Node 22.23.3 : typecheck, lint et packaging de validation Chromium/Firefox réussis avec les deux origines réservées .invalid. Ruff check des scripts réussi. Le wrapper inspecte manifeste/permissions et présence des origines dans le bundle, contrôle le seul fichier d’origines publiques généré dans les sources Firefox et produit les SHA-256 avec distributable=false sous delivery/validation. Invocation distribution avec loopback => refus avant build (code 2).

Reconstruction opérationnelle : archive Firefox extraite dans un dossier temporaire isolé, npm ci autonome puis WXT zip en mode ci réussis ; tous les fichiers extraits du paquet reconstruit sont identiques octet par octet. Les archives finales ont été régénérées après les derniers ajustements de documentation/outillage. Aucune publication, compte ou API réelle requis. Aucun test automatisé ajouté.

Les commentaires et le README décrivent le grant stable réellement renvoyé par la branche extension de POST /api/auth/refresh : renouvellement de son délai et nouveau bearer de cinq minutes, sans rotation/rejeu ancien. L’API dev reste un choix valide du propriétaire pour la bêta ; seule l’origine publique web réelle convient à la distribution.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Sépare local, validation CI et distribution par des commandes de packaging explicites. Les ZIP vérifiés et les sources Firefox reçoivent un reçu lié aux origines choisies et aux empreintes ; une distribution refuse loopback/exemples et ne copie aucun environnement local. La documentation suit le grant courant. Contrôles Node 22 et reconstruction autonome Firefox réussis.
<!-- SECTION:FINAL_SUMMARY:END -->
