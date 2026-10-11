---
owner_decision: more   # pending | ok | abandoned | redo | more
---

# Benchmark : l'app web connectée de Deepn — cinq directions, la bibliothèque à 200 dossiers et plus, le chat

## Owner Validation

**Decision**: Complément demandé (2026-10-11). L'interface est décidée ; neuf points du reste du README sont revus ci-dessous. Le complément les intègre sans rouvrir ce qui est acté.

**Acté : l'interface de l'app web sur ordinateur est la direction de l'owner**, `mobile-design-mockups/web_app_owner_direction/` (maquette `code.html`, captures `screens/`, et son `README.md`, qui fait foi pour chaque écran ; sources dans `mockup-build/dir_owner*.{js,css}`). Elle remplace la direction A et tout ce qui lui est propre : barre latérale et arbre virtualisé, épinglés, palette ⌘K, sélecteur arborescent. Les dossiers n'ont qu'un niveau : on ne crée jamais un dossier dans un autre, et « Déplacer le dossier » n'existe pas.

**Consignes du complément :**

1. **Pas de version téléphone de l'app web en V1.** Sous 900 px, `app.<domaine>` invite à installer l'app mobile, avec les liens vers les stores. Les écrans téléphone de la maquette (`screens/21-tel-*` à `37-tel-*`) restent une référence pour plus tard, hors périmètre. Le rejet de React Native Web (§9.1) tient donc pour la V1. Écrire, sans le rouvrir, qu'il serait à réévaluer si une version téléphone fidèle à l'app était un jour demandée.
2. **Le paiement web n'est pas figé.** Retirer « Stripe Billing via RevenueCat » des conclusions reprises (§11) et du lot W4. Le choix du moteur sera fait par une étude dédiée à la fin de la bêta. Les options à y comparer sont Paddle (vendeur à la place de Deepn : TVA, factures, litiges), RevenueCat Billing avec ses liens d'achat hébergés, et Stripe Billing. Les sources sont les pages RevenueCat Web SDK, Paddle et Web Purchase Links.
3. **Remplacer le chiffrage en jours (§10.2) par un découpage en tâches de backlog**, établi sur la direction de l'owner, au format de ce que task-431 fait pour le chat. Chaque tâche a un périmètre, ses dépendances et des AC satisfaisables par un agent en worktree (règle du `CLAUDE.md`). Le complément liste ces tâches ; il ne les crée pas dans le backlog.
4. **Connexion Google et Apple sur le web (§9.4)** : le serveur accepte déjà les audiences web. C'est `GOOGLE_CLIENT_ID` dans `_google_native_accepted_audiences` et `APPLE_CLIENT_ID` dans la vérification Apple (`media_summarizer/api/endpoints/auth_social.py`). Retirer ce point de « à vérifier » ; il reste la création des identifiants web, et pour Apple le domaine vérifié (task-443).
5. **Le domaine de l'API (task-445) devient un prérequis du développement de l'app web**, pas seulement de sa publication. La session repose sur un cookie posé par `api.<domaine>`. Le reporter dans les dépendances du découpage.
6. **Vérifier sur dev le CORS de la façade de streaming du chat** (§12, point 3), qui existe depuis task-467. Lancer un pré-vol `OPTIONS` depuis une origine web avec l'en-tête `Authorization`, et consigner le résultat. Si le CORS manque, en faire une tâche du découpage.
7. **Appairage de l'extension en un clic.** La page Compte de l'app web, déjà connectée, transmet à l'extension un jeton qui lui est propre, via `externally_connectable` (déclaré pour la seule origine `app.<domaine>`). Le code à recopier ne reste qu'en secours. Préciser la portée et la révocation de ce jeton.
8. **Frais du Chrome Web Store** : 5 $, payés une fois, publiés par Google. Corriger §10.1 et §12, point 9.
9. **Hébergement tout AWS, dans Terraform.** Le domaine et le DNS sont dans Route 53 ; `app.<domaine>` (l'app web) et `www.<domaine>` (pages légales et page d'installation de l'extension, en HTML statique) sont sur S3 + CloudFront ; l'API est sur `api.<domaine>` via le domaine personnalisé d'API Gateway. Pas de Cloudflare, pas d'Astro. Remplacer §9.5 et la ligne Cloudflare du §11 en conséquence. Ce choix vaut aussi pour task-357, validé le même jour.
10. **Identité du texte extrait par l'extension.** Le texte envoyé par le navigateur (`extracted_text`, §6 de `README.owner-rejected-2026-10-05.md`) peut venir d'une page payante ou privée. Il ne doit jamais prendre l'identité de l'adresse seule : sinon un autre compte qui enregistre le même lien le recevrait par la mise en commun des transcripts (`media_summarizer/core/services/media_identity.py`, `generate_media_key`). La règle à écrire dans le contrat est une identité propre au compte (`generate_account_scoped_media_key`), ou au minimum l'adresse et ce texte ensemble, comme pour les articles (`generate_article_media_key`, task-392). Le complément tranche entre les deux et reporte la règle dans le découpage en tâches. L'app mobile n'est pas concernée : ses chemins sont déjà publics par construction, ou propres au compte.
**Validated at**: _(date ISO à remplir par l'owner lors du passage à `ok`)_

---

## Recommendation

**Direction A, « L'arbre latéral », avec la palette ⌘K de la direction C greffée dessus.** C'est l'app web en trois volets : l'arbre des dossiers à gauche (filtrable, épinglés et récents en tête), la page ouverte au centre, la conversation à droite quand on l'ouvre.

**Repli : C, « La barre de saut »**, si l'owner préfère une page de lecture pleine largeur à une hiérarchie toujours visible.

Le fait qui tranche est le critère que la décision du 2026-10-10 déclare majeur : **une bibliothèque agréable avec beaucoup de dossiers**. La §5 rejoue les six parcours exigés sur le même corpus de 295 dossiers. **A est la seule direction qui les réussit tous dans la même surface, sans changer de mode** :

- retrouver un dossier peu utilisé (filtre `/` qui garde les ancêtres visibles) ;
- voir le dossier actif et son chemin (surligné dans l'arbre, et fil d'Ariane) ;
- passer d'un dossier à l'autre sans perdre sa place (l'arbre ne bouge pas quand le centre change) ;
- créer ou renommer sur place ;
- choisir une destination (le même arbre, dans le sélecteur).

Les quatre autres directions ont chacune un parcours où il faut changer de surface :

- **B** perd la vue en colonnes dès qu'on ouvre un média.
- **C** demande de se souvenir d'un nom, ou de passer par l'index.
- **D** sépare la structure dans un dialogue « Gérer les dossiers ».
- **E** demande d'ouvrir un onglet pour chaque endroit.

**Ce que la palette de C ajoute à A, et pourquoi elle est nécessaire.** À 1 000 dossiers (§5.3), un arbre, même filtré, reste un outil de parcours. Retrouver un dossier dont on se souvient du nom va plus vite par recherche que par arbre. La palette (⌘K) cherche dans les dossiers, les médias et les actions. Elle affiche le **parent immédiat en premier**, ce qui départage les 20 « Notes de lecture » du corpus. Elle ne coûte qu'un composant, déjà dessiné dans C (`screen-palette.png`).

**Le chat suit exactement la Decision de task-434** dans les cinq directions :

- le composeur persistant n'existe que dans **Lecture** d'un média et dans **Sources** d'un dossier ;
- il n'y a aucune portée bibliothèque ;
- l'onglet IA, le digest, l'accueil et la recherche n'ont aucun composeur.

Sur bureau, A ouvre la conversation dans un **volet droit** : le texte reste lisible à côté, et les citations `§n` surlignent le paragraphe cité. Les états de task-430 sont dessinés et adressables : envoi, flux, arrêt volontaire, échec partiel, reprise après rechargement, refus de contexte et minutes épuisées (§6).

**Ce que cette passe change dans le chiffrage technique de la passe du 2026-10-10.** Stack, hébergement, session et partage de code sont **repris** (§9). Trois ajouts viennent du chat et des dossiers :

1. **Un deuxième CORS.** Le flux SSE passe par une **API Gateway REST dédiée en mode `STREAM`** (Decision de task-430 §5). C'est une seconde façade, avec son propre traitement CORS.
2. **Le flux s'authentifie par `fetch`, pas par `EventSource`.** `EventSource` ne peut pas envoyer d'en-tête `Authorization`. Le client web lit donc le flux par `fetch` + `ReadableStream`, avec le jeton d'accès en mémoire.
3. **Un lot de plus, WC, pour le chat web**, dépendant du backend du chat (découpage de task-431) et de task-439. Le total passe de 33 à 50 j à **42 à 63 j** pour la parité complète, extension Chrome comprise (§10).

### Ce qui est déjà acté, et ce que ce README recommande

| | Statut | Où |
|---|---|---|
| Une app web connectée, pas une vitrine | **acté** (rejet du 2026-10-05) | §0 |
| Chat à portée média (Lecture) et dossier (Sources), pas de bibliothèque | **acté** (task-434) | §6 |
| Architecture du chat, SSE reprenable, `gpt-6-luna` Standard | **acté** (task-430, task-439) | §6.3 |
| Nom Deepn | **acté** (`docs/BRAND_IDENTITY.md`) | toutes les maquettes |
| Extension WXT, Stripe via RevenueCat, hébergement Cloudflare de task-357 | **repris** des passes précédentes, rien ne les remet en cause | §11 |
| Direction A + palette de C | **recommandé** | §8 |
| Lots W0–W4, WC, X1–X3 | **recommandé** | §10 |

---

## 0. Mode redo : ce que cette passe intègre

Le README actif portait `owner_decision: redo`. Il a été archivé en `README.owner-rejected-2026-10-10.md`, conformément au workflow. Deux rejets s'appliquent : les consignes du 2026-10-05 restent en vigueur quand celles du 2026-10-10 ne les remplacent pas.

| Consigne | Origine | Comment cette passe y répond |
|---|---|---|
| L'app web est le périmètre ; ne pas rouvrir « vitrine ou app » | 2026-10-05 | Rien n'est rouvert. Les cinq maquettes sont des écrans **connectés** ; la vitrine, les pages légales et l'installation de l'extension restent étudiées (§9.5, §11). |
| Maquettes sous `mobile-design-mockups/web_app/direction_<x>_<slug>/`, rendu desktop de référence, Amber Clarity | 2026-10-05 | Fait. Les quatre anciens répertoires sont supprimés : il n'existe plus qu'un jeu actif de cinq directions. |
| **Exactement cinq** directions A–E, distinctes par leur structure et leurs parcours | 2026-10-10 §1 | §4. Hiérarchie toujours visible (A) ; hiérarchie disposée en chemin (B) ; rappel par recherche sans hiérarchie visible (C) ; contenu d'abord, dossier comme filtre (D) ; espace de travail à onglets avec sommaire (E). |
| Intégrer le chat selon la **Decision** de task-434 (direction F, média/Lecture et dossier/Sources), pas sa Recommendation D | 2026-10-10 §2 | §6. Aucune direction n'a de portée bibliothèque ni de composeur hors de ces deux onglets. |
| Inventaire refait depuis le code, matrice fonctionnalité → source → web → A..E → lot | 2026-10-10 §3 | §1 (inventaire, 74 lignes) et §2 (matrice). |
| Corpus d'au moins 200 dossiers, trois niveaux, noms longs, homonymes ; comportement à 1 000 | 2026-10-10 §4 | §3 et §5 : 295 dossiers sur trois niveaux, variante de 1 018 dossiers dans chaque prototype. |
| Captures dédiées, issues du HTML rendu | 2026-10-10 §5 | Chaque direction a `screen.png` (1440), `screen-mobile.png` (390), `screen-library-many-folders.png`, `screen-media-chat.png` et `screen-folder-chat.png`, plus une capture propre à son mécanisme pour C, D. |
| Conserver les conclusions acquises sur l'extension, le paiement et l'hébergement ; sourcer toute révision | 2026-10-10 §5 | §11 : rien n'est révisé ; deux points sont **ajoutés** (CORS du flux, auth du flux). |
| Ne pas réintroduire les tags | 2026-10-10 §3 | Aucune maquette n'a de tags. Le lot X2 de la passe précédente mentionnait « tags » dans la popup de l'extension : **retiré** (§11). |

**Ce qui n'est pas repris de la passe rejetée : ses quatre directions et sa recommandation « A, Le classeur ».** Le Classeur était aussi un trois-volets. La nouvelle direction A n'en est pas la reconduction : le rejet portait sur le traitement des nombreux dossiers, et c'est justement ce qui est neuf ici (filtre avec ancêtres, épinglés et récents, sélecteur de destination arborescent, palette ⌘K, corpus réel, comportement à 1 000).

---

## 1. Inventaire actuel des fonctionnalités de l'app

Il est établi depuis le code, pas depuis la liste indicative de la tâche. Les sources sont les routes de `mobile/app/` (27 fichiers), les composants de `mobile/src/components/` (33), les hooks (13), les services (21), les contextes (5) et les routes d'API que ces services appellent. Les libellés du catalogue `mobile/src/i18n/en.ts` ont servi de contre-vérification : chaque section du catalogue correspond à au moins une ligne ci-dessous.

**Ce qui n'est pas dans l'inventaire, et pourquoi.** Les routes d'API `feeds`, `follows`, `podcasts` et `podcast-search` ainsi que `PATCH /api/digest/settings` existent dans `media_summarizer/api/endpoints/`, mais aucun écran mobile ne les appelle (`grep` sur `mobile/src` et `mobile/app` : zéro référence). `follows.py` n'est même pas monté. Ce ne sont pas des fonctionnalités de l'app : l'app web ne les porte pas. Les **tags** ont été supprimés et ne reviennent pas.

Les lignes sont numérotées (F1…F74) pour que la matrice du §2 y renvoie.

### 1.1 Entrée, compte, session

| # | Fonctionnalité / action / état | Source |
|---|---|---|
| F1 | Connexion e-mail + mot de passe | `app/(auth)/login.tsx`, `authService.ts` → `POST /api/auth/login` |
| F2 | Inscription | `app/(auth)/register.tsx` → `POST /api/auth/register` |
| F3 | Connexion Google | `SocialAuthButtons.tsx`, `useGoogleSignIn.ts` → `POST /api/auth/google/native` |
| F4 | Connexion Apple | `SocialAuthButtons.tsx` → `POST /api/auth/apple/native` |
| F5 | Choix de la langue de lecture à l'inscription (garde bloquante) | `app/onboarding/language.tsx`, `(tabs)/_layout.tsx` (garde) |
| F6 | Rafraîchissement de session, expiration | `sessionManager.ts`, `tokenStorage.ts` → `POST /api/auth/refresh` |
| F7 | Écran d'erreur au démarrage | `StartupErrorGate.tsx`, `StartupErrorScreen.tsx` |
| F8 | Synchronisation du fuseau horaire | `useDeviceTimezoneSync.ts` → `PATCH /api/auth/me` |
| F9 | Notifications push (digest, « Ready to deepen ») | `usePushNotifications.ts`, `pushNotificationService.ts` → `/api/push-token` |

### 1.2 Accueil et ajout

| # | Fonctionnalité | Source |
|---|---|---|
| F10 | Ajouts récents (12 vignettes, états en cours / échec) | `app/(tabs)/inbox.tsx`, `HomeTile.tsx`, `useMediaList.ts` |
| F11 | « Reprendre » (médias et dossiers récents, progression) | `useHomeSections.ts` → `GET /api/engagements/recent` |
| F12 | Carte d'entrée « Tri des non classés » avec compte | `inbox.tsx` → `GET /api/folders/unsorted-count` |
| F13 | Alerte de minutes (masquable) | `MinutesWarningBanner.tsx`, `usageWarningDismissal.ts` |
| F14 | Bandeau d'essai gratuit | `FreeTrialNotice.tsx` |
| F15 | Ajouter un lien (saisie) | `AddSourceSheet.tsx`, `UrlEntryDialog.tsx` → `POST /api/media/ingest-url` |
| F16 | Importer un fichier (PDF, Office, image, audio) | `AddSourceSheet.tsx`, `localImport.ts`, `presignedUpload.ts` → `POST /api/media/upload-url`, `/upload`, `/upload-audio` |
| F17 | Importer une photo de la galerie | `AddSourceSheet.tsx` |
| F18 | Prendre une photo (bouton appareil) | `inbox.tsx` (« home.takePhotoA11y ») |
| F19 | Partage depuis une autre app (share sheet, texte, note) | `+native-intent.tsx`, `ShareIntentContext.tsx`, `sharedContentService.ts` → `/api/media/ingest-shared-content` |
| F20 | Confirmation après ajout : « ranger dans un dossier ? » | `app/share-confirmation.tsx` |
| F21 | Refus d'ajout : quota, format, taille, transfert, note vide | `share-confirmation.tsx`, `quotaError.ts`, catalogue `share.*`, `upload.*` |
| F22 | Rafraîchissement des vignettes en cours de traitement | `useProcessingRefresh.ts`, `mediaSaveNotice.ts` |

### 1.3 Bibliothèque et dossiers

| # | Fonctionnalité | Source |
|---|---|---|
| F23 | Bibliothèque : section Dossiers (repliable, préférence mémorisée) | `app/(tabs)/search.tsx`, `useFoldersSectionExpanded.ts` |
| F24 | « Tous les médias », du plus récent au plus ancien, paginé | `search.tsx` → `GET /api/media` |
| F25 | Filtrage local des dossiers par nom pendant la saisie | `lib/folderSearch.ts` |
| F26 | Créer un dossier à la racine depuis la Bibliothèque | `search.tsx` (task-436), `RenameDialog.tsx` → `POST /api/folders` |
| F27 | Page dossier, onglet **Sources** : sous-dossiers puis médias | `app/media/folders/[id].tsx`, `SubfolderCard.tsx`, `MediaListCard.tsx` |
| F28 | Page dossier, onglet **IA** (génération sur tout le sous-arbre) | `folders/[id].tsx`, `ArtifactsPanel.tsx` |
| F29 | Explorateur de dossiers (racine) avec entrée « Non classés » | `app/media/folders/index.tsx` |
| F30 | Renommer un dossier (appui long ou `…`) | `useFolderActions.ts`, `RenameDialog.tsx` → `PUT /api/folders/{id}` |
| F31 | Supprimer un dossier (les sources vont dans Non classés, le sous-arbre est supprimé) | `useFolderActions.ts` → `DELETE /api/folders/{id}` |
| F32 | Sélecteur de dossier : recherche, Non classés, arbre, création en ligne | `FolderPickerView.tsx`, `app/media/folder.tsx` |
| F33 | Ranger / déplacer un média | `useMediaActions.ts` → `PATCH /api/media/{id}` |
| F34 | Renommer un média | `useMediaActions.ts`, `RenameDialog.tsx` |
| F35 | Supprimer un média | `useMediaActions.ts` → `DELETE /api/media/{id}` |
| F36 | Menus contextuels (appui long avec copie soulevée) | `AnchoredContextMenu.tsx` |
| F37 | Tri des non classés : file figée, Écarter / Approfondir / Ranger, balayage | `app/media/unsorted-review.tsx`, `FolderSaveSheet.tsx` |
| F38 | État vide, échec de chargement, nouvel essai (bibliothèque et dossiers) | `search.tsx`, `folders/*.tsx` |
| F39 | Badges de type (dont SHORT et PHOTOS), marqueur d'échec, balayage de traitement | `mediaTypeDisplay.ts`, `MediaFailureBadge.tsx`, `MediaProcessingSweep.tsx` |
| F40 | Titre générique d'un média sans nom (« Vidéo YouTube — date ») | `lib/mediaTitle.ts` |

### 1.4 Média et lecture

| # | Fonctionnalité | Source |
|---|---|---|
| F41 | Bandeau de couverture, créateur, titre | `MediaDetailHero.tsx` |
| F42 | Ligne de métadonnées : lien vers la source, date, durée, langue, longueur | `MediaDetailHero.tsx` |
| F43 | Onglets **Lecture** / **IA** | `CompletedDetailView.tsx`, `ScreenTabs.tsx` |
| F44 | « L'essentiel » (aperçu `review_blurb`, trois états) | `SourcePreview.tsx` |
| F45 | Texte intégral, paragraphes sélectionnables | `TranscriptReader.tsx` → `GET /api/media/{id}/raw-content` |
| F46 | Traduction automatique dans la langue de lecture ; bascule original / traduction | `TranscriptReader.tsx`, `useTranslationRefresh.ts` (task-419) |
| F47 | États de traduction : en cours, échec, bloquée, « vérifier à nouveau » | catalogue `transcript.*` |
| F48 | Barre repliée (miniature, titre, segment, progression de lecture) | `MediaReaderBar.tsx` |
| F49 | Suivi de lecture (alimente « Reprendre ») | `engagementService.ts` → `POST /api/engagements` |
| F50 | États du média : en traitement, trop long, échec avec message par code | `app/media/[id].tsx`, `useMediaDetailPolling.ts`, catalogue `mediaError.*` |
| F51 | « Demander cette source » après un échec non pris en charge | `SourceSupportRequestCard.tsx` → `POST /api/bug-reports` |
| F52 | Menu `…` du média : Ranger, Renommer, Supprimer | `useMediaActions.ts` |

### 1.5 IA

| # | Fonctionnalité | Source |
|---|---|---|
| F53 | Cinq types à générer : Résumé, Résumé détaillé, Notes, Flashcards, Quiz | `ArtifactsPanel.tsx`, `ArtifactTile.tsx` → `POST /api/artifacts` |
| F54 | États par type : générer / en file / génération / généré / échec | `ArtifactTile.tsx` |
| F55 | Historique append-only, avec nombre de sources | `ArtifactHistoryRow.tsx`, `lib/artifactHistory.ts` |
| F56 | Refus : dossier vide, trop de sources, trop de texte, média sans texte | `lib/artifactRefusal.ts` |
| F57 | Visionneuse : résumé (points clés, à retenir), résumé détaillé (contexte, thèmes, citations, conclusion), notes (objectifs, concepts, actions, glossaire) | `app/artifacts/[artifactId].tsx` |
| F58 | Flashcards à retourner | `[artifactId].tsx` |
| F59 | Quiz : progression, options, correction, explication | `[artifactId].tsx` |
| F60 | Artefact en attente, échec, « Générer à nouveau » | `[artifactId].tsx` |

### 1.6 Digest, recherche

| # | Fonctionnalité | Source |
|---|---|---|
| F61 | Choix de la période : piles quotidienne / hebdomadaire | `app/(tabs)/digest/index.tsx`, `DigestCoverStack.tsx` |
| F62 | Carrousel d'une période (pages média complètes, points, position « 3 / 7 ») | `digest/[period].tsx`, `PaginationDots.tsx` |
| F63 | Recherche plein texte avec extraits surlignés | `search.tsx`, `searchService.ts` → `GET /api/search/transcripts`, `lib/highlightSnippet.ts` |

### 1.7 Compte et réglages

| # | Fonctionnalité | Source |
|---|---|---|
| F64 | E-mail du compte, carte de forfait (bêta, essai, actif, minutes restantes, renouvellement) | `app/(tabs)/account.tsx`, `SubscriptionStatusCard.tsx`, `PurchasesContext.tsx` → `/api/entitlements/status` |
| F65 | Paywall : forfaits, recommandation, achat, conditions — **masqué pendant la bêta** (task-429) | `app/paywall.tsx`, `purchaseService.ts`, `pricingService.ts` |
| F66 | Langue de lecture (une modification par mois) | `app/settings/reading-language.tsx` |
| F67 | Langue de l'app (11 langues, suivre l'appareil, RTL) | `app/settings/interface-language.tsx` |
| F68 | Thème clair / sombre / appareil | `app/settings/theme.tsx`, `ThemeContext.tsx` |
| F69 | Demandes de fonctionnalités (tableau externe) | `feedbackService.ts` → `GET /api/feedback/token` |
| F70 | Signaler un bug, avec pièce jointe | `app/bug-report.tsx`, `bugReportService.ts` |
| F71 | Se déconnecter | `account.tsx`, `AuthContext.tsx` → `POST /api/auth/logout` |
| F72 | Supprimer le compte (avertissements, abonnement à annuler, accusé, confirmation) | `app/settings/delete-account.tsx` → `DELETE /api/account` |

### 1.8 À ajouter, validé mais pas encore implémenté

| # | Fonctionnalité | Source de la décision |
|---|---|---|
| F73 | **Chat** multi-tours, portée média (Lecture) et dossier (Sources), historique, flux, arrêt, reprise, échec partiel | task-434 Decision, task-430 Decision |
| F74 | **Extension navigateur** et son appairage | passes précédentes de task-424 (§11) |

---

## 2. Matrice de couverture

Pour chaque ligne : l'équivalent web, l'emplacement dans chaque direction et le lot (§10). « Commun » signifie que la surface est la même dans les cinq prototypes : rendu partagé, placé différemment par chaque coquille (lien « Parcours de la maquette » en bas à gauche de chaque prototype). Les emplacements se vérifient dans les prototypes par le hash indiqué en §3.3.

| # | Équivalent web | A — arbre | B — colonnes | C — saut | D — facettes | E — onglets | Lot |
|---|---|---|---|---|---|---|---|
| F1–F4 | Écran de connexion / inscription ; Google via Google Identity Services, Apple via Sign in with Apple JS (§9.4) | Commun : `#s=login`, `#s=register` | idem | idem | idem | idem | W0 |
| F5 | Même garde, page `#s=onboarding` | Commun | idem | idem | idem | idem | W0 |
| F6 | Cookie `HttpOnly` + jeton en mémoire (§9.3) | invisible | invisible | invisible | invisible | invisible | W0 |
| F7 | Error boundary React | invisible | invisible | invisible | invisible | invisible | W0 |
| F8 | `Intl.DateTimeFormat().resolvedOptions().timeZone` | invisible | invisible | invisible | invisible | invisible | W0 |
| F9 | **Différé, contrainte de plateforme** : Web Push possible, mais demande permission, service worker et VAPID ; hors des lots ci-dessous, l'app mobile reste le canal des notifications | — | — | — | — | — | hors lot (§10.3) |
| F10–F14 | Page Accueil | lien « Accueil » de la barre latérale | onglet « Accueil » du haut | « Accueil » de la barre | icône Accueil du rail | « Accueil » de la barre | W1 |
| F15–F17 | Dialogue « Ajouter » : champ lien, zone de dépôt (fichiers, images) ; **en plus** : dépôt n'importe où, ⌘V hors champ | bouton « Ajouter » de la barre latérale | bouton « Ajouter » du haut | « Ajouter » ou palette | bouton + du rail | « Ajouter » de la barre | W3 |
| F18 | **Contrainte** : pas d'appareil photo sur bureau ; sur mobile, `<input accept="image/*" capture>` | idem F15 | idem | idem | idem | idem | W3 |
| F19 | **Remplacé** par l'extension (X1), le dépôt et le collage | — | — | — | — | — | X1 |
| F20 | Second écran du dialogue « Ajouter » → sélecteur de destination | Commun `#modal=add2` puis sélecteur propre à la direction | idem | idem | idem | idem | W3 |
| F21 | Messages identiques (mêmes catalogues), refus de quota **sans paywall pendant la bêta** | dans le dialogue | idem | idem | idem | idem | W3 |
| F22 | Relecture bornée des vignettes en cours | invisible | invisible | invisible | invisible | invisible | W1 |
| F23–F24 | Bibliothèque | arbre + « Tous les médias » (`#s=library`) | colonnes (racine = 1re colonne) | Index A–Z (`#s=library`) | « Tous les médias » sans facette | onglet « Sommaire » | W1 |
| F25 | Repérage de dossier | filtre `/` avec ancêtres | « Aller à un dossier » + filtre par colonne au-delà de 20 | palette ⌘K + filtre de l'index | facette « Dans le dossier… » | filtre du sommaire | W1 |
| F26 | Créer un dossier | `+` de l'en-tête Dossiers, `…` › Nouveau sous-dossier | `+` en tête de chaque colonne | palette › « Nouveau dossier » | « Gérer les dossiers » › Nouveau | « + Dossier » du sommaire | W3 |
| F27 | Page dossier, Sources | centre | dernière colonne | page pleine largeur | liste filtrée + volet de lecture | onglet de travail | W1 |
| F28 | Page dossier, IA | onglet IA du centre | onglet IA de la colonne | onglet IA de la page | onglet IA de la liste | onglet IA de l'onglet | W1 (lecture), W3 (générer) |
| F29 | Non classés | entrée « Non classés » de la barre latérale | 1re ligne de la 1re colonne | « Non classés · 12 » de la barre | icône du rail | « Non classés » du sommaire | W1 |
| F30–F31 | Renommer / supprimer un dossier | `…` sur la ligne d'arbre et sur la page | `…` de la colonne de détail | `…` de la page | `…` de la liste, « Gérer les dossiers » | `…` de l'onglet | W3 |
| F32–F33 | Sélecteur de destination | dialogue : filtre, récents, arbre | dialogue : colonnes miniatures + « Aller à » | palette « Ranger dans… » | puce « Dossier ▾ » ouvrant une liste à saisie | dialogue : sommaire racines + deux niveaux | W3 |
| F34–F35 | Renommer / supprimer un média | menu `…` de la ligne et du lecteur, clic droit | idem | idem | idem | idem | W3 |
| F36 | Menu contextuel : clic droit, bouton `…`, Maj+F10 | idem | idem | idem | idem | idem | W3 |
| F37 | Tri des non classés : touches ← → et D / O / R | `#s=unsorted` | onglet « Non classés » | « Non classés » de la barre | icône du rail | « Non classés » de la barre | W3 |
| F38–F40 | États vides, erreurs, badges, titres génériques | Commun | idem | idem | idem | idem | W1 |
| F41–F45 | Page média, Lecture | centre | à côté de la colonne de ses voisins | pleine largeur | volet de lecture à droite de la liste | onglet de travail | W1 |
| F46–F47 | Bascule original / traduction (puce « Voir l'original ») | Commun | idem | idem | idem | idem | W1 |
| F48 | **Pas d'équivalent nécessaire** : sur bureau, les onglets Lecture / IA restent visibles ; sur 390 px, barre collante | — | — | — | — | — | W1 |
| F49 | Progression de lecture envoyée au défilement | invisible | invisible | invisible | invisible | invisible | W1 |
| F50–F51 | États en traitement / échec, « Demander cette source » | `#s=media&m=m10`, `m=m12` | idem | idem | idem | idem | W1 |
| F52 | Menu `…` du média | à droite des onglets | idem | idem | idem + puce « Dossier ▾ » | idem | W3 |
| F53–F56 | Onglet IA : tuiles, états, historique, refus | Commun (`#tab=ai`) | idem | idem | idem | idem | W1 (lecture), W3 (générer) |
| F57–F60 | Visionneuse d'artefact (flashcards : Espace, ← →) | page `#s=artifact` | idem | idem | idem | idem | W1 ; interactions W3 |
| F61–F62 | Digest : choix de période + lecture page par page (← →) | « Digest » | onglet « Digest » | « Digest » | icône du rail | « Digest » | W2 |
| F63 | Recherche plein texte + dossiers correspondants | « Recherche » (⌘K) | champ du haut | palette › « Rechercher dans le texte » | icône du rail | champ du haut | W2 |
| F64 | Compte, carte de forfait (bêta) | « Compte » | avatar | avatar | icône du rail | avatar | W2 |
| F65 | Paywall web (Stripe via RevenueCat), **absent pendant la bêta** | Commun `#s=paywall&beta=0` | idem | idem | idem | idem | W4 |
| F66–F68 | Réglages : langue de lecture, langue de l'app (**RTL sans redémarrage** : `dir="rtl"`), thème | Commun `#s=settings&sub=…` | idem | idem | idem | idem | W2 |
| F69–F70 | Demandes de fonctionnalités, signaler un bug (pièce jointe par `<input type=file>`) | Commun | idem | idem | idem | idem | W2 |
| F71 | Déconnexion (« sur ce navigateur ») | Commun | idem | idem | idem | idem | W0 |
| F72 | Suppression du compte (le texte d'abonnement ajoute le cas web) | Commun | idem | idem | idem | idem | W2 |
| F73 | Chat : composeur dans Lecture / Sources uniquement | conversation en volet droit | conversation en partage horizontal de la colonne | carte flottante au-dessus du composeur | dossier : volet droit ; média : feuille dans le volet de lecture | vue partagée dans l'onglet, séparateur déplaçable | WC |
| F74 | Extension : page « Relier ce navigateur » | Compte › Extension | idem | idem | idem | idem | X1 |
| — | **Ajout web, absent du mobile** : déplacer un dossier (l'API l'accepte : `PUT /api/folders/{id}` avec `parent_folder_id`) | `…` › Déplacer | idem | idem | « Gérer les dossiers », glisser-déposer | `…` › Déplacer | W3 |
| — | **Ajout web** : épingler un dossier | épingle sur la page et dans le menu | — | puces « Épinglés » de l'index | — | — | W1 (local) |

**Rien n'est supprimé implicitement.** Les trois écarts sont nommés :

- **F9, notifications push** : différé, avec sa contrainte (Web Push).
- **F19, share sheet** : remplacé par l'extension, le dépôt et le collage.
- **F48, barre repliée** : sans objet sur bureau.

La caméra (F18) a son équivalent mobile web et aucun sur bureau.

---

## 3. Méthode des maquettes

### 3.1 Un noyau commun, cinq coquilles

Chaque `code.html` est autonome : ni `<link>`, ni `<img>`, ni `<script src>`, donc aucune requête réseau. Il est produit par `docs/research/task-424-website-and-browser-extension/mockup-build/build.mjs` à partir de trois parties :

- **un noyau commun** : corpus, rendus du lecteur, de l'onglet IA, de la visionneuse, du chat, du digest, de la recherche, du tri et du compte ;
- **une coquille par direction**, qui porte la navigation, le repérage des dossiers, le sélecteur de destination et l'emplacement de la conversation ;
- **les contours exacts d'Ionicons.ttf**, la fonte de l'app, extraits par `extract_icons.py`.

Ce partage est voulu : les cinq directions diffèrent par leur **structure et leurs parcours**, pas par cinq dessins de la même visionneuse de quiz. Pour changer une maquette, on modifie les sources puis on relance `build.mjs` et `shoot.sh`.

Les tokens sont ceux de `mobile/src/constants/theme.ts`, clair et sombre, repris tels quels. L'échelle de texte est limitée à 32 / 20 / 16 / 14 / 13 px. Deux écarts déclarés :

- **Polices** : Plus Jakarta Sans et Inter sont déclarées, mais sans réseau la maquette affiche la police système de repli.
- **Couvertures** : un bloc teinté portant le glyphe du type remplace la vignette réelle.

### 3.2 Le corpus de référence, identique dans les cinq

Le corpus est généré de façon déterministe (`mockup-build/data.js`), avec la même graine pour les cinq directions.

| Corpus | Dossiers | Par niveau | Hash |
|---|---|---|---|
| Petit | 7 | 3 / 3 / 1 | `#corpus=small` |
| **Référence** | **295** | **15 / 83 / 197** | défaut |
| Grand | **1 018** | 38 / 221 / 759 | `#corpus=xl` |

- **Noms longs** : par exemple « Psychologie cognitive et sciences de l'apprentissage appliquées à l'enseignement secondaire » (91 caractères) ou « Histoire économique de l'Europe industrielle (1780-1914) — séminaire du jeudi ».
- **Homonymes dans des parents différents** : « Références » ×21, « Notes de lecture » ×20, « Entretiens » ×19, « Archives » ×17.
- **Le dossier rare des parcours** : « Neurosciences de l'attention › Mémoire de travail › Notes de lecture », ouvert il y a six mois. C'est un homonyme parmi vingt, enfoui au troisième niveau.

### 3.3 États adressables

Chaque état est une URL. Le bouton « Parcours de la maquette », en bas à gauche, liste une soixantaine de parcours, et `#shot=1` le masque pour les captures. Exemples :

- `#s=folder&f=f5&q=neuro%20notes` (A) : retrouver le dossier rare ;
- `#s=media&m=m1&chat=open&cs=resuming` : reprise d'une réponse après rechargement ;
- `#s=account&beta=0` : compte après la bêta ;
- `#theme=dark` : thème sombre.

### 3.4 Captures

Les captures sont produites par `mockup-build/shoot.sh`, qui pilote Chrome sans interface par le protocole DevTools (`cdp_shot.mjs`). **Ce détail compte** : l'option `--window-size` de Chrome ne descend pas sous **500 px** de large (mesuré : `innerWidth` = 500 pour une fenêtre demandée à 390). Une capture « 390 px » faite par la ligne de commande est donc une mise en page de 500 px rognée. Le script émule un viewport exact et journalise `innerWidth` et `scrollWidth` : **390 × 844, sans défilement horizontal**, pour les cinq. Desktop à 1440 × 900, mobile à 390 × 844 en densité 2. Chaque capture a été relue. Rendu vérifié dans Chrome uniquement.

---

## 4. Les cinq directions

### A — « L'arbre latéral » (`direction_a_arbre_lateral/`)

**Thèse : la hiérarchie est toujours visible.**

- **Navigation.** Une barre latérale de 300 px porte Accueil, Recherche, Digest, Non classés, puis les dossiers : un filtre (`/`), les **épinglés**, les **récents**, puis l'arbre complet.
- **Contenu.** Le centre affiche la page ouverte, avec le fil d'Ariane du dossier actif.
- **Conversation.** La droite s'ouvre en volet de 400 px quand on écrit dans le composeur.
- **Clavier.** Le modèle WAI-ARIA *treeview* : flèches, Début/Fin, recherche par première lettre, `*` pour déplier les frères.
- **Filtre.** Il garde les ancêtres de chaque résultat et déplie leurs branches : c'est ce qui départage deux « Notes de lecture ».
- **Mobile.** La barre latérale devient un tiroir (`screen-mobile.png`), la conversation une feuille.
- **Référence.** La barre latérale des gestionnaires de fichiers et des apps de notes (Finder, VS Code, Notion, Obsidian).

### B — « Les colonnes » (`direction_b_colonnes/`)

**Thèse : le chemin est la mise en page.**

- **Navigation.** Une colonne par niveau, de gauche à droite (colonnes de Miller, la vue en colonnes du Finder). La dernière colonne est la page du dossier.
- **Repérage.** Le champ « Aller à un dossier… » (⌘K) saute n'importe où et reconstruit les colonnes. Au-delà de 20 dossiers, une colonne a son propre filtre.
- **Clavier.** ← → entre colonnes, ↑ ↓ dans une colonne.
- **Média.** Un média s'ouvre à côté de la **liste de ses voisins**, pour lire un dossier source après source.
- **Conversation.** Elle partage la colonne horizontalement, avec une poignée de redimensionnement.
- **Mobile.** Un niveau par écran, comme l'app Fichiers.

### C — « La barre de saut » (`direction_c_barre_de_saut/`)

**Thèse : au-delà de quelques centaines de dossiers, se souvenir d'un nom va plus vite que parcourir l'arbre.** Aucun arbre n'est affiché en permanence. Trois outils le remplacent :

- **la barre de saut** : chaque segment du chemin ouvre la liste de ses voisins (`screen.png`), comme la barre de saut d'Xcode ou la barre d'adresse de l'Explorateur Windows ;
- **la palette ⌘K** : dossiers, médias et actions, avec le parent immédiat en premier et le marqueur « homonyme » (`screen-palette.png`) ;
- **l'index A–Z** : une entrée par **nom**, et un nom porté par 20 dossiers est **une seule entrée** qui liste ses 20 parents (`screen-library-many-folders.png`).

La page est pleine largeur, la meilleure pour la lecture. La conversation est une carte flottante au-dessus du composeur.

### D — « Le flux à facettes » (`direction_d_flux_a_facettes/`)

**Thèse : on cherche un contenu, pas un contenant.**

- **Bibliothèque.** C'est la liste de toutes les sources. Un dossier est un **filtre** qu'on choisit en tapant (facette « Dans le dossier… »), avec l'option « Inclure les sous-dossiers ». D'autres facettes s'y ajoutent : type et état.
- **Page dossier.** C'est cette liste filtrée, et son onglet Sources **est** la liste. La lecture se fait dans un volet à droite (liste–détail, comme dans un client mail).
- **Structure.** Elle se modifie dans un dialogue séparé, « Gérer les dossiers » (`screen-manage-folders.png`).
- **Conversation.** Pour un dossier, elle occupe le volet de droite ; pour un média, c'est une feuille dans le volet de lecture.

### E — « Les onglets de travail » (`direction_e_onglets_de_travail/`)

**Thèse : on ne perd jamais sa place, parce que chaque endroit est un onglet.**

- **Onglets.** Chaque dossier ou média ouvert reste ouvert, avec son défilement, son onglet interne et sa conversation. Un point ambre signale l'onglet où une réponse s'écrit.
- **Carte de la bibliothèque.** Un **sommaire** : les racines à gauche, deux niveaux disposés dans la page (enfants en lignes, petits-enfants en puces), sans rien à déplier.
- **Conversation.** Elle s'ouvre en vue partagée dans l'onglet, avec un séparateur déplaçable.
- **Mobile.** Les onglets deviennent un sélecteur en grille (`screen-mobile.png`).

---

## 5. La bibliothèque avec beaucoup de dossiers

### 5.1 Les six parcours, rejoués sur le corpus de référence

Les cellules résument les parcours rejoués dans chaque prototype. « 1 surface » signifie que le parcours se fait sans quitter la vue où l'on est.

| Parcours | A — arbre | B — colonnes | C — saut | D — facettes | E — onglets |
|---|---|---|---|---|---|
| **Retrouver un dossier peu utilisé** (le « Notes de lecture » de Mémoire de travail) | `/` puis « neuro notes » : 3 résultats, ancêtres visibles ; **1 surface** | « Aller à » puis « neuro notes » : 3 résultats avec parent ; les colonnes se reconstruisent | ⌘K puis « neuro notes » : 3 résultats, parent d'abord ; **le plus rapide quand on se souvient du nom** | facette : 20 résultats pour « notes », parent sous chaque nom | filtre du sommaire : 20 puces surlignées dans 9 racines ; il faut faire défiler |
| **Identifier le dossier actif et son chemin** | ligne surlignée dans l'arbre **et** fil d'Ariane | colonnes surlignées : le chemin est la mise en page | barre de saut | parent au-dessus du nom dans la puce de facette | fil d'Ariane, et nom de l'onglet |
| **Passer d'un dossier à l'autre sans perdre sa place** | l'arbre ne bouge pas, le centre change | les colonnes restent tant qu'on ne quitte pas la bibliothèque ; **ouvrir un média les remplace** | voisins par la barre de saut ; un dossier éloigné demande la palette | la liste change, la facette se reconstruit | **meilleur** : chaque endroit reste un onglet |
| **Parcourir une longue liste sans bloquer la lecture** | arbre défilant indépendant (virtualisé à l'implémentation) | colonnes défilant indépendamment | index sur sa propre page, pas à côté de la lecture | liste et lecture côte à côte | sommaire dans son propre onglet |
| **Créer / renommer** | sur place dans l'arbre | `+` en tête de colonne | commande de la palette | dialogue séparé | `+ Dossier`, `…` |
| **Choisir une destination** (ajout, déplacement) | même arbre filtrable dans le dialogue, avec récents | colonnes miniatures + « Aller à » | palette « Ranger dans… » | liste à saisie ancrée à la puce « Dossier ▾ » | sommaire racines + deux niveaux |

### 5.2 Libellés longs, branches, défilement, clavier, responsive

| | A | B | C | D | E |
|---|---|---|---|---|---|
| **Libellés longs** | une ligne avec ellipse, chemin complet en infobulle ; titre de page sur plusieurs lignes | **deux lignes** dans une colonne de 250 px, puis ellipse | segment de barre limité à 240 px, index en entier sur plusieurs colonnes | puce de facette sur plusieurs lignes | ligne d'enfant sur plusieurs lignes |
| **Branches** | dépliées à la demande ; la branche active est révélée | pas de dépliage : un niveau par colonne | pas d'arbre | pas d'arbre, sauf dans « Gérer » | deux niveaux toujours visibles, le troisième en puces |
| **Résultats ambigus** | ancêtres affichés | parent immédiat en premier | parent en premier + marqueur « homonyme » ; index groupé | parent en premier | racine en titre de section |
| **Clavier** | WAI-ARIA *treeview* | ← → ↑ ↓ entre et dans les colonnes | ⌘K, ↑ ↓ ↵, Tab pour le chemin complet | J / K dans la liste | ⌘T, ⌘W, ⌃Tab |
| **390 px** | tiroir | un niveau par écran | barre réduite au segment courant + loupe ; rail A–Z | barre de filtre + feuille | sélecteur d'onglets en grille |

### 5.3 À 1 000 dossiers

Les cinq prototypes s'ouvrent sur 1 018 dossiers avec `#corpus=xl` : 38 racines, 221 dossiers au deuxième niveau, 759 au troisième.

| | Ce qui tient | Ce qui casse, et le remède |
|---|---|---|
| **A** | Le filtre reste instantané : c'est un parcours en mémoire, comme `filterFoldersByName` aujourd'hui. Les épinglés et les récents restent en tête. | L'arbre complet devient long (38 racines repliées, c'est encore une liste courte ; c'est le dépliage qui rallonge). Remède : **virtualisation** de la liste aplatie, et palette ⌘K pour le saut par nom (la greffe recommandée). |
| **B** | Une colonne ne montre que des frères : au plus 38 lignes à la racine. | Une profondeur de 5 (`MAX_FOLDER_DEPTH = 5`, `media_summarizer/core/models/folder.py:18`) veut dire 5 colonnes de 250 px + le détail = 1 810 px : **défilement horizontal**, le défaut connu des colonnes de Miller. |
| **C** | **La meilleure** : une recherche ne voit pas le nombre de dossiers. L'index groupe les homonymes : 1 018 dossiers, environ 160 noms. | Sans nom en tête, l'index devient un long document ; on parcourt mal ce qu'on ne connaît pas. |
| **D** | La facette à saisie se comporte comme la palette. | « Inclure les sous-dossiers » sur une racine de 30 dossiers mélange 300 sources. La structure n'est visible que dans « Gérer les dossiers ». |
| **E** | Les onglets ne dépendent pas du volume. | Le sommaire de 38 sections devient un long document ; le filtre est indispensable. |

**Le coût côté serveur, le même pour les cinq.** `GET /api/folders` renvoie la liste à plat **en une seule réponse, sans pagination**, avec `media_count` pour chaque dossier (`media_summarizer/api/endpoints/folders.py:181-194`). Le modèle de réponse indique que ce comptage est « a full pass over the user's library partition » (`folders.py:117-118`). À 1 000 dossiers, la réponse reste petite, de l'ordre de 200 à 300 Ko de JSON, et le parcours reste borné par la bibliothèque, pas par le nombre de dossiers. **Aucun nouvel endpoint n'est nécessaire pour l'arbre.** Ce point n'a pas été mesuré sur `-dev` (§12).

**Les récents existent déjà côté API**, ce que la passe précédente n'avait pas relevé. `GET /api/engagements/recent` mêle médias et dossiers (`kind: Literal["media", "folder"]`, `media_summarizer/api/endpoints/engagements.py:42`). Les « Récents » de A, C et D ne demandent donc rien de neuf. **Les épinglés sont neufs** : stockés en local par navigateur au lot W1, ou sous forme d'un champ de dossier si l'owner les veut sur tous les appareils.

---

## 6. Le chat dans les cinq directions

### 6.1 Les portées, exactement celles de la Decision de task-434

| Écran | Composeur | Raison |
|---|---|---|
| Média, onglet **Lecture** | **oui**, portée « Ce média » | Decision task-434 |
| Dossier, onglet **Sources** | **oui**, portée « Ce dossier · N sources » | Decision task-434 |
| Média ou dossier, onglet **IA** | non ; passer sur IA réduit la conversation sans l'arrêter | Decision task-434 |
| Bibliothèque, accueil, digest, recherche, tri, compte | non | « Aucun chat à portée bibliothèque » |
| Page de digest | non : le digest affiche l'aperçu et renvoie à la page du média, où se trouve le composeur | la page de digest n'est pas l'onglet Lecture d'un média |

C'est vérifiable dans chaque prototype : `chatScope()` (`mockup-build/core.js`) ne renvoie une portée que pour ces deux cas, et le composeur n'est rendu que dans ces cas-là.

### 6.2 Les états, tous dessinés

Ils suivent la Decision de task-430 §6 et sont adressables par `#cs=…` :

| État | Ce que l'écran dit | Hash |
|---|---|---|
| Envoi | indicateur « Envoi de la question… » | `cs=sending` |
| Flux | texte qui s'écrit, curseur, « vous pouvez quitter la page, elle continue », bouton Arrêter (Échap) | `cs=streaming` |
| Arrêt volontaire | « Réponse arrêtée par vous. Le texte reçu est conservé. » + Relancer | `cs=stopped` |
| Échec partiel | message d'erreur, le texte reçu est conservé, « Réessayer » ; « une nouvelle tentative écrit une nouvelle réponse ; elle ne complète pas celle-ci. Aucun second débit de minutes. » | `cs=failed` |
| Reprise | « Reprise de la réponse là où elle en était… (la page a été rechargée) » | `cs=resuming` |
| Refus de contexte | « Ce dossier contient trop de texte pour une conversation… Ouvrez un sous-dossier plus petit. » (refus explicite, task-430 §7) | `cs=refused` |
| Minutes épuisées | variante bêta, sans entrée vers l'abonnement | `cs=quota` |
| Historique | conversations de **cette** portée, « Nouvelle », mention qu'il n'existe pas de discussion sur toute la bibliothèque | `cs=history` |

Le fil d'un dossier montre aussi, **dans l'historique**, une réponse arrêtée plus tôt : une réponse interrompue reste identifiable comme telle (task-430 §6). Les citations (`§2`, `1`, `7`) renvoient au paragraphe du média, qui est surligné dans le texte, ou à une source du dossier.

### 6.3 Ce que le chat demande au web, et qui n'était dans aucune passe

L'architecture n'est pas rouverte. Ce sont ses conséquences pour un client navigateur :

1. **Deux façades, deux CORS.** Les opérations `/api/chat` restent sur l'API HTTP actuelle, déjà traitée par la passe précédente : `cors_configuration`, `allow_credentials`. Le **flux** passe par une **API Gateway REST régionale dédiée en mode `STREAM`** (Decision task-430 §5). AWS documente que le streaming de réponse est réservé aux intégrations proxy (`HTTP_PROXY`, `AWS_PROXY`), qu'il est **pris en charge par les API REST et pas par les API HTTP**, et qu'un flux dure au plus 15 minutes, avec 5 minutes d'inactivité sur un point régional ([AWS, *response transfer mode*](https://docs.aws.amazon.com/apigateway/latest/developerguide/response-transfer-mode.html)). En intégration proxy, ce sont la Lambda de diffusion **et** la réponse au pré-vol `OPTIONS` qui doivent porter `Access-Control-Allow-Origin: https://app.<domaine>` et autoriser l'en-tête `Authorization`. **À écrire dans le service de diffusion, pas dans Terraform seul.**
2. **Le flux s'authentifie par en-tête, donc pas par `EventSource`.** Le constructeur `EventSource` n'accepte que l'option `withCredentials` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource)) : il ne peut pas envoyer `Authorization: Bearer`. Le client web lit donc le SSE par `fetch` + `ReadableStream`, avec le jeton d'accès en mémoire (§9.3). C'est exactement la forme que task-430 a retenue sur mobile (`expo/fetch`, `resp.body.getReader()`). **Aucun cookie n'est nécessaire sur l'origine du flux**, donc pas de `allow_credentials` sur la façade REST, et le jeton n'apparaît jamais dans une URL.
3. **Reprise après rechargement.** Un rechargement perd le jeton en mémoire. La séquence est : (a) `POST /api/auth/refresh` avec le cookie, (b) `GET` de la conversation sur la façade HTTP pour relire l'état durable, (c) rattachement au flux avec l'identité de génération et le curseur de séquence, en dédupliquant (task-430 §6). C'est l'état `cs=resuming`.
4. **Plusieurs onglets.** Deux onglets sur la même conversation ouvriraient deux flux, ce qui compte dans le budget de connexions que task-430 §5 demande de définir. Recommandation : **seul l'onglet visible reste attaché**. Sur `visibilitychange` vers caché, il se détache ; au retour, il se rattache avec le curseur. Un `BroadcastChannel` partage le jeton rafraîchi entre onglets. Cela pèse surtout pour la direction E, dont c'est le principe (§7).
5. **Arrêter, ce n'est pas fermer le flux.** Le bouton Arrêter appelle `POST …/stop` sur la façade HTTP. Fermer l'onglet ou naviguer n'est qu'une déconnexion (task-430 §6).
6. **Partage de code avec le mobile.** Le service et le contrôleur de conversation que task-430 §1 veut communs aux deux portées doivent être écrits en `fetch` standard, sans `expo/fetch` dans leur cœur. L'app web les importe alors par l'alias `mobile/src/services` de la passe précédente (§9.2). **C'est une contrainte à transmettre au découpage de task-431**, pas une décision de ce benchmark. Elle ne coûte rien si elle est connue avant l'écriture.

---

## 7. Comparaison sur une grille commune

Notes de 1 (faible) à 5 (fort), justifiées dans les sections citées. La pondération reflète la consigne : la bibliothèque avec beaucoup de dossiers est « un critère majeur ».

| Critère | Poids | A | B | C | D | E |
|---|---|---|---|---|---|---|
| **Bibliothèque à 200 dossiers et plus** : les six parcours (§5.1) | ×3 | **5** | 3 | 4 | 3 | 3 |
| **Tenue à 1 000 dossiers** (§5.3) | ×2 | 4 (5 avec la palette) | 2 | **5** | 4 | 3 |
| **Exhaustivité** (matrice §2 : toutes les fonctions ont un emplacement) | ×2 | 5 | 5 | 5 | 4 (structure à part, facettes neuves) | 5 |
| **Lecture et chat** : largeur, texte visible pendant la conversation | ×2 | 4 (texte à côté, ~740 px) | 3 (moitié de hauteur) | 4 (pleine largeur ; la carte masque le bas du texte) | 3 (quatre zones) | 4 (vue partagée) |
| **Clavier et accessibilité** | ×1 | **5** (motif WAI-ARIA normalisé) | 4 | 4 | 3 | 3 (raccourcis d'onglets en concurrence avec ceux du navigateur) |
| **Responsive 390 px** | ×1 | 4 | **5** | 4 | 3 | 3 |
| **Continuité avec le mobile** (un dossier est un lieu ; Sources et IA) | ×1 | 5 | 4 | 5 | 2 (le dossier devient un filtre) | 4 |
| **Effort** (§10.2) | ×1 | 4 | 3 | 4 | 2 | 2 |
| **Total pondéré** (sur 65) | | **59** | 45 | **57** | 41 | 45 |

Le calcul se lit ligne à ligne. A : 15 + 8 + 10 + 8 + 5 + 4 + 5 + 4 = 59 (sa note à 1 000 dossiers vaut 4 sans la palette, 5 avec). C : 12 + 10 + 10 + 8 + 4 + 4 + 5 + 4 = 57. B : 9 + 4 + 10 + 6 + 4 + 5 + 4 + 3 = 45. D : 9 + 8 + 8 + 6 + 3 + 3 + 2 + 2 = 41. E : 9 + 6 + 10 + 8 + 3 + 3 + 4 + 2 = 45. L'écart entre A et C est faible et assumé : **c'est pourquoi C est le repli, et pourquoi sa palette est greffée sur A.**

### 7.1 Les références UX sur lesquelles la grille s'appuie

| Fait | Source | Ce qu'il fonde |
|---|---|---|
| *Treeview* : « Right Arrow: When focus is on a closed node, opens the node », « Type-ahead … focus moves to the next node with a name that starts with the typed character », « * … Expands all siblings » | [WAI-ARIA APG, Tree View](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) | la note clavier de A : un motif normalisé, que les lecteurs d'écran annoncent |
| Fil d'Ariane : « not intended to show the history of pages traversed », « augment but do not replace » la navigation principale ; « The last breadcrumb … should not be a link » ; sur mobile, ils « can quickly wrap to multiple lines » | [NN/g, *Breadcrumbs: 11 Design Guidelines*](https://www.nngroup.com/articles/breadcrumbs/) | aucune direction ne fait du fil d'Ariane sa seule navigation ; C le rend actif (voisins), et le réduit au segment courant sur mobile |
| Colonnes de Miller : « multiple levels of the hierarchy to be open at once » et « a visual representation of the current location », mais l'approfondissement rend les colonnes trop étroites et impose le défilement horizontal | [Wikipédia, *Miller columns*](https://en.wikipedia.org/wiki/Miller_columns) | la force de B sur « où suis-je », et sa faiblesse à 1 000 dossiers et 5 niveaux |
| Quick Open : « quickly search and open a file by its name » ; un fichier ouvert ajoute un onglet, en mode aperçu tant qu'on ne l'édite pas | [VS Code, *User Interface*](https://code.visualstudio.com/docs/getstarted/userinterface) | la palette de C (greffée sur A) ; le modèle d'onglets de E, et son coût |
| Facettes : « multiple filters, one for each different aspect of the content », pour de « extremely large content sets » ; une structure « significantly more expensive to create and maintain » ; un filtre simple « can often be easier to understand and faster to use » | [NN/g, *Filters vs. Facets*](https://www.nngroup.com/articles/filters-vs-facets/) | la note d'effort de D, et sa pertinence discutable pour une bibliothèque personnelle |
| Liste–détail : convient aux « file browsers » ; liste de largeur fixe, détail flexible ; sur écran étroit, l'un ou l'autre | [Android Developers, *Canonical layouts*](https://developer.android.com/develop/adaptive-apps/guides/canonical-layouts) | la mise en page de D, et sa réduction sur mobile |
| *Supporting pane*, l'autre disposition canonique de Material 3 | idem | le volet de conversation de A et E |

---

## 8. La recommandation en détail

**A, avec la palette de C.** Concrètement, pour l'implémentation (task-425 et ses lots) :

1. **La coquille** est celle de A. Barre latérale : navigation, puis Dossiers (filtre `/`, épinglés, récents, arbre virtualisé). Centre : la page. Volet droit : la conversation.
2. **La palette ⌘K de C** : dossiers (parent immédiat en premier, marqueur « homonyme »), médias, actions. Le bouton « Recherche ⌘K » de A y mène. La recherche plein texte devient une action de la palette, en plus de sa page.
3. **Le sélecteur de destination** est celui de A : filtre, récents, arbre, création en ligne. C'est le `FolderPickerView` mobile transposé, donc la règle « la même réponse partout à “quel dossier ?” » est conservée.
4. **Le regroupement des homonymes** dans les résultats de la palette, emprunté à l'index de C, si l'owner le juge utile au-delà de l'affichage du parent.

**Ce qui ferait choisir le repli C :** si l'owner juge que la page de lecture doit occuper tout l'écran, et qu'une hiérarchie toujours affichée encombre plus qu'elle n'aide. C est aussi la direction qui tient le mieux à 1 000 dossiers. Ce qu'elle perd : la découverte de la structure par simple regard.

**Ce que la recommandation écarte, et pourquoi :**

- **B** : excellente pour savoir où l'on est, mais elle mange la largeur et casse à 5 niveaux. Elle est aussi la seule qui doive changer de mise en page entière pour lire un média.
- **D** : elle fait du dossier un filtre, ce qui contredit le modèle mobile où un dossier est un lieu avec ses onglets Sources et IA. Elle exige aussi des comptages par facette que l'API n'a pas : `GET /api/media` accepte `folder_id` (sous-dossiers compris), `type`, `status_filter` et `q` (`media_summarizer/api/endpoints/media.py`), mais ne renvoie **aucun comptage** et n'accepte qu'**un seul** type à la fois.
- **E** : elle double les onglets du navigateur avec un second système, alourdit le budget de flux du chat (§6.3, point 4), et coûte un état d'onglets persistant à maintenir.

---

## 9. Stack, hébergement, session, CORS, partage de code : actualisés

Tout ce qui suit est **repris** de `README.owner-rejected-2026-10-10.md`. La consigne du 2026-10-10 les conserve « lorsqu'aucun fait actuel ne les remet en cause ». Seuls les points touchés par le chat ou par la direction recommandée sont détaillés.

### 9.1 Stack — reprise

Vite + React 19 + React Router en mode framework `ssr: false`, SPA pré-rendue. React Native Web reste rejeté (rejeté-2026-10-10 §3.2 et §3.3). **Ce que la direction recommandée y ajoute** : un arbre virtualisé (une liste aplatie des nœuds visibles, rendue fenêtrée) et une palette. Ce sont deux composants à écrire, pas une dépendance à choisir. Si une bibliothèque de virtualisation est envisagée, c'est un choix d'implémentation, sans benchmark.

### 9.2 Partage de code — repris, et une contrainte nouvelle

L'alias de build vers `mobile/src/{types,lib,services,i18n,constants}` reste la forme du lot W0 (rejeté-2026-10-10 §4). **Nouveau** : `lib/folderTree.ts` et `lib/folderSearch.ts` font déjà l'arbre et le filtre dont A a besoin ; la palette les réutilise. **Contrainte nouvelle** : le client de chat doit être écrit en `fetch` standard pour être partageable (§6.3, point 6).

### 9.3 Session — reprise, avec deux conséquences du chat

Cookie `HttpOnly` de rafraîchissement sur `api.<domaine>`, jeton d'accès en mémoire, plafond absolu et expiration par inactivité, comme le demande la RFC 10017 (rejeté-2026-10-10 §6). **Conséquences du chat** : le jeton en mémoire **est** l'authentification du flux (§6.3, point 2), et la reprise après rechargement passe d'abord par `/refresh` (§6.3, point 3). Rien ne change dans le modèle de session.

### 9.4 Connexion sociale sur le web — un point que la passe précédente n'avait pas détaillé

Les deux routes natives prennent un jeton d'identité obtenu par le SDK du téléphone : `POST /api/auth/google/native` et `/apple/native` (`media_summarizer/api/endpoints/auth_social.py`). Sur le web, le jeton vient de Google Identity Services et de Sign in with Apple JS. Deux points sont **à vérifier à l'implémentation** (§12) :

- que la vérification côté serveur accepte l'audience du **client OAuth web** ;
- que Sign in with Apple accepte un *Services ID* web, qui suppose un domaine vérifié, donc task-443.

L'ancienne route web `GET /api/auth/google/callback` n'émet plus de jeton depuis task-293. Ne pas la ressusciter, conclusion reprise de la passe 1.

### 9.5 Hébergement et CORS — repris, et une seconde façade

Cloudflare Workers static assets, deux projets : `www.<domaine>` pour la vitrine Astro, les pages légales et la page d'installation de l'extension, et `app.<domaine>` pour la SPA (rejeté-2026-10-10 §5). Le CORS de l'API HTTP se règle dans `cors_configuration` (`infrastructure/terraform/modules/platform/lambda_api.tf`), et non dans FastAPI : rejeté-2026-10-10 §1.1, toujours vrai. **Nouveau** : le CORS de la façade REST du flux, porté par la Lambda de diffusion et le pré-vol (§6.3, point 1).

---

## 10. Coûts et lots

### 10.1 Coût fixe sur douze mois — inchangé

Il est de **0 $** au-delà du domaine de task-357 / task-443 (environ 11 $) et du frais unique du Chrome Web Store, dont le montant n'est pas publié (rejeté-2026-10-10 §9.1). Le chat ajoute un coût **variable**, déjà chiffré par task-430 §6 et réglé en minutes de quota par tour. Le client web ne change pas ce coût par conversation : il ajoute des conversations, pas un coût unitaire. Le streaming REST d'API Gateway est facturé à la requête et au transfert. À l'échelle de la bêta, il reste dans le même ordre que l'API HTTP (rejeté-2026-10-10 §9.2), mais il n'est **pas chiffré ici** (§12).

### 10.2 Lots

| Lot | Contenu | Dépend de | Ordre de grandeur |
|---|---|---|---|
| **W0 — fondations** | Session web, CORS (API HTTP), projet Vite + React Router, **coquille A** (barre latérale, arbre virtualisé, filtre, épinglés locaux, récents), palette ⌘K, i18n sur les 11 catalogues, connexion / inscription / langue de lecture, thème, déconnexion, hébergement | task-357 / task-443 pour **publier** | **6 à 9 j** (contre 4 à 6 à la passe précédente : arbre et palette) |
| **W1 — lire** | Accueil (F10–F14), bibliothèque et dossiers (F23–F25, F27, F29, F38–F40), page média et lecteur (F41–F51), onglet IA en lecture (F53–F57), suivi de lecture | W0 | **8 à 12 j** |
| **W2 — digest, recherche, compte** | F61–F64, F66–F70, F72 ; carte de forfait **sans** entrée vers l'abonnement pendant la bêta | W0 | **6 à 9 j** |
| **W3 — écrire** | Ajouter (lien, fichier, dépôt, collage) et confirmation (F15–F21), sélecteur de destination, créer / renommer / déplacer / supprimer médias et dossiers (F26, F30–F36), **déplacer un dossier** (ajout web), tri des non classés (F37), générer et générer à nouveau (F53–F60) | W1, W2 | **8 à 11 j** |
| **WC — chat web** | Composeur dans Lecture / Sources, volet de conversation, historique, flux par `fetch`, arrêt, reprise, échec partiel, refus, minutes (F73) ; CORS de la façade REST du flux | **le backend du chat issu de task-431** (première livraison fonctionnelle : flux reprenable, deux portées), task-439, W1 | **5 à 8 j** |
| **X1 — extension Chrome** | Reprise de la passe 1, appairage délivré par l'app web (Compte › Extension) | W0 | **5 à 8 j** |
| **X2 — Firefox, Edge** | Reprise ; **sans tags** dans la popup (retirés, §0) | X1 | **5 à 8 j** |
| **W4 — abonnement web** | Paywall (F65), Stripe Billing via RevenueCat, `SubscriptionPlatform.web` | W2, **fin de la bêta** (task-429, task-442) | **4 à 6 j** |
| **X3 — Safari** | optionnel | X1, Xcode | **4 à 6 j** |

**Totaux.** Parité complète avec le chat, hors X2 et X3 : W0 à W4 + WC + X1 = **42 à 63 j**. La passe précédente donnait 33 à 50 j pour les mêmes lots hors chat. Le chiffrage repose, comme alors, sur des ordres de grandeur sans donnée de vélocité du dépôt (§12).

**L'ordre.** W0 → W1 → (W2 ∥ W3) → WC dès que le backend du chat est livré → W4 après la bêta. **Le chat web ne bloque pas les lots de lecture, et ne les attend pas au-delà de W1.**

### 10.3 Différé et hors lots, explicitement

| Fonction | Statut | Raison |
|---|---|---|
| F9 Notifications push | hors lots | Web Push suppose service worker, VAPID et permission ; à décider après usage réel de l'app web |
| F18 Appareil photo | équivalent mobile web seulement | contrainte de plateforme |
| F19 Share sheet | remplacé par X1, le dépôt et le collage | contrainte de plateforme |
| Épinglés synchronisés entre appareils | non retenu au W1 | demanderait un champ backend ; local d'abord |

### 10.4 Dépendances avec le chatbot

- **WC dépend du découpage de task-431**, qui n'existe pas encore en tâches dispatchables (task-431 `To Do`).
- **task-425 reste dépendante de task-424.** Son implémenteur doit lire ce README une fois validé.
- **Contrainte à transmettre à task-431** : client de chat en `fetch` standard (§6.3, point 6) ; CORS de la façade REST du flux pour l'origine `app.<domaine>` (§6.3, point 1).

---

## 11. Extension, paiement, task-357 : repris

| Conclusion | Statut | Où elle est argumentée |
|---|---|---|
| WXT, Chrome Web Store d'abord, capture URL + texte + sélection, `activeTab` | repris | rejeté-2026-10-05 §3–§6 |
| Appairage délivré par l'app web plutôt que par le mobile | repris | rejeté-2026-10-10 §10.2 |
| Stripe Billing via RevenueCat, jamais en direct ; TVA ; Managed Payments en repli ; dernier lot | repris | rejeté-2026-10-05 §10, rejeté-2026-10-10 §11 |
| Hébergement Cloudflare de task-357, Workers plutôt que Pages | repris | rejeté-2026-10-05 §0.5, rejeté-2026-10-10 §5 |
| « Tags » dans la popup de l'extension (lot X2 ancien) | **retiré** | les tags ont été supprimés de l'app ; consigne du 2026-10-10 |

Aucune révision sourcée n'était nécessaire : aucun fait du dépôt ni le chatbot ne touche à ces conclusions. Le chat ne passe pas par l'extension.

---

## 12. Ce qui n'a pas été vérifié

1. Le comportement à 1 000 dossiers est **dessiné et rendu**, pas mesuré : ni la taille réelle de `GET /api/folders`, ni sa latence sur `-dev`.
2. Les notes de la grille (§7) sont un jugement d'expert sur les parcours rejoués dans les prototypes, **pas un test avec des utilisateurs**.
3. Le CORS d'une API REST en mode `STREAM` sur une requête `fetch` cross-origin avec `Authorization` n'a pas été exercé. La documentation AWS citée décrit le streaming, pas le CORS de ce mode.
4. Le coût du streaming REST d'API Gateway n'est pas chiffré.
5. L'acceptation par le backend de l'audience d'un client OAuth web Google, et d'un *Services ID* Apple (§9.4).
6. Les chiffrages de §10 reprennent la méthode de la passe précédente, sans donnée de vélocité.
7. Rendu vérifié dans Chrome uniquement, à 1440 × 900 et 390 × 844, en clair, et en sombre pour l'écran Compte.
8. Les références UX secondaires : la page NN/g sur les fil d'Ariane et celle sur les facettes ont été lues directement ; le résumé sur les colonnes de Miller vient de Wikipédia.
9. Le montant du frais d'inscription au Chrome Web Store (inchangé depuis la passe précédente).

---

## 13. Sources

- AWS — streaming de réponse des API REST (`responseTransferMode`, types d'intégration, REST seulement, 15 min, inactivité) : <https://docs.aws.amazon.com/apigateway/latest/developerguide/response-transfer-mode.html> ; billet : <https://aws.amazon.com/blogs/compute/building-responsive-apis-with-amazon-api-gateway-response-streaming/>
- MDN — constructeur `EventSource`, option `withCredentials` seulement : <https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource>
- W3C WAI-ARIA Authoring Practices — Tree View : <https://www.w3.org/WAI/ARIA/apg/patterns/treeview/>
- Nielsen Norman Group — Breadcrumbs : <https://www.nngroup.com/articles/breadcrumbs/>
- Nielsen Norman Group — Filters vs. Facets : <https://www.nngroup.com/articles/filters-vs-facets/>
- Wikipédia — Miller columns : <https://en.wikipedia.org/wiki/Miller_columns>
- Visual Studio Code — User Interface (Quick Open, onglets, aperçu) : <https://code.visualstudio.com/docs/getstarted/userinterface>
- Android Developers — Canonical layouts (liste–détail, panneau d'appoint) : <https://developer.android.com/develop/adaptive-apps/guides/canonical-layouts>
- Sources reprises des passes précédentes (RFC 10017, Cloudflare Workers, RevenueCat, Stripe, stores, WXT) : `README.owner-rejected-2026-10-10.md` §14 et `README.owner-rejected-2026-10-05.md`
- Décisions appliquées : `docs/research/task-434-chatbot-integration-ui/README.md` et `docs/research/task-430-chatbot-architecture/README.md` (Owner Validation), `backlog/tasks/task-439 - …`, `docs/BRAND_IDENTITY.md`, `mobile-design-mockups/my_design_system/DESIGN.md`, `mobile/src/constants/theme.ts`

---

## 14. Livrables et périmètre

| Livrable | Chemin |
|---|---|
| Ce README (`owner_decision: pending`) | `docs/research/task-424-website-and-browser-extension/README.md` |
| README archivé de la passe rejetée | `README.owner-rejected-2026-10-10.md` (et celui du 2026-10-05, inchangé) |
| Sources des maquettes, script de build, captures | `docs/research/task-424-website-and-browser-extension/mockup-build/` |
| Direction A | `mobile-design-mockups/web_app/direction_a_arbre_lateral/` |
| Direction B | `mobile-design-mockups/web_app/direction_b_colonnes/` |
| Direction C | `mobile-design-mockups/web_app/direction_c_barre_de_saut/` (+ `screen-palette.png`) |
| Direction D | `mobile-design-mockups/web_app/direction_d_flux_a_facettes/` (+ `screen-manage-folders.png`) |
| Direction E | `mobile-design-mockups/web_app/direction_e_onglets_de_travail/` |

Chaque répertoire contient `code.html`, `screen.png` (1440), `screen-mobile.png` (390), `screen-library-many-folders.png`, `screen-media-chat.png` et `screen-folder-chat.png`. Les quatre répertoires de la passe précédente (`direction_a_classeur_trois_volets`, `direction_b_table_de_lecture`, `direction_c_tableau_de_bord`, `direction_d_plein_ecran`) sont supprimés ; ils restent dans l'historique git et sont décrits dans le README archivé.

Aucun code applicatif, aucune configuration et aucune infrastructure ne sont modifiés. Rien n'a été acheté ni publié.
