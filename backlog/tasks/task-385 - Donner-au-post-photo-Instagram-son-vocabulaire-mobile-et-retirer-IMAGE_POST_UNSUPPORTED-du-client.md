---
id: task-385
title: >-
  Donner au post photo Instagram son vocabulaire mobile et retirer
  IMAGE_POST_UNSUPPORTED du client
status: Done
assignee: []
created_date: '2026-09-09 15:57'
updated_date: '2026-09-16 15:10'
labels:
  - mobile
dependencies:
  - task-384
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Le constat

task-384 rend les posts photo Instagram ingérables et supprime `IMAGE_POST_UNSUPPORTED` du backend. Le client, lui, garde deux dettes symétriques.

**1. Un code d'erreur que rien n'émettra plus.** `IMAGE_POST_UNSUPPORTED` reste dans le type des codes (`mobile/src/types/media.ts:135`), dans la table `ERROR_CODE_MESSAGES` (`mobile/src/lib/getFriendlyErrorMessage.ts:69`) et dans la liste des 8 codes « demandables » de task-381 (`:111`), et sa phrase — « Cette publication est une photo : il n'y a rien à transcrire. » — vit dans les 11 catalogues de traduction sous `mediaError.imagePostUnsupported`. Après task-384 cette phrase est fausse : c'est précisément ce qu'on sait faire.

**2. Un type de média que le client ne connaît pas.** `image_post` n'existe nulle part côté mobile. L'union `MediaType` (`mobile/src/types/media.ts:13-22`) ne le liste pas, et les trois dérivations du type retombent donc toutes sur leur branche `default` :

- `getMediaTypeLabel` (`MediaListCard.tsx:343-362`) → pastille **« LINK »** ;
- `getMediaTypeIcon` (`src/lib/mediaTypeDisplay.ts`) → glyphe **chaînon** ;
- `getMediaTypeBgColor` (`MediaListCard.tsx:365-377`) → la teinte neutre.

Un carrousel Instagram s'afficherait donc comme un lien générique. À noter que le contournement n'est pas d'ignorer le sujet : `media_type` arrive **brut** dans le payload de liste — c'est pourquoi l'union porte déjà `"document"` et `"audio"`, absents de l'enum canonique, avec le commentaire qui l'explique en tête du fichier (`:9-12`).

## Ce qu'on veut

**Le vocabulaire d'un type de source de plus**, exactement comme `document` l'a reçu : une entrée dans l'union, un libellé de pastille, un glyphe, et rien d'autre. Le libellé doit dire ce que la source *est* pour le lecteur (une publication faite d'images), pas comment elle a été traitée — l'utilisateur ne sait pas qu'un OCR est passé dessus et n'a pas à l'apprendre. Le glyphe se choisit dans le jeu Ionicons déjà utilisé par le fichier ; la famille « images » y existe.

**Et la suppression complète du code mort**, dans le même passage : un code d'erreur que le backend n'émet plus, une phrase de catalogue que rien ne lit, et une entrée dans la liste des codes demandables qui ferait apparaître le bloc « Cette source n'est pas encore prise en charge » pour une source désormais prise en charge.

## Ce que l'implémenteur n'a pas à chercher

- **Le détail sert un type canonique, la liste sert le type brut.** task-384 mappe `image_post` dans `_LEGACY_MEDIA_TYPE_MAP`, donc `GET /api/media/:id` répond déjà un membre canonique. C'est le **payload de liste** qui porte `image_post` tel quel, et donc la bibliothèque et les tuiles de l'accueil qui ont besoin de l'entrée d'union. Même mécanique que `document` aujourd'hui.
- **Un seul fichier pour le glyphe** : `src/lib/mediaTypeDisplay.ts`, partagé par `MediaListCard`, `HomeTile` et `CompletedDetailView`. Son en-tête dit pourquoi les trois copies privées ont été fusionnées — ne pas les recréer.
- **Le marqueur d'échec de task-381 n'est pas concerné** : il se déclenche sur le statut de l'item, pas sur le type de média.
- **Aucun appel réseau, aucun contrat à négocier.** Le backend est fait par task-384 ; il n'y a ici que du rendu et du vocabulaire.

## Pourquoi c'est une tâche à part

Deux raisons, aucune n'étant une transition ni une compatibilité (`AGENTS.md`, « Nothing is deployed yet ») :

- **La règle de dispatch.** Une tâche portant le label `mobile` va à `task-mobile`, seul agent autorisé à modifier `mobile/` et seul à connaître le design system « Amber Clarity ». task-384 est un chantier de worker, de parsing et de quota : la router vers l'agent mobile pour onze lignes de catalogue serait le mauvais échange.
- **L'ordre.** Le libellé n'a de sens qu'une fois qu'un post photo peut réellement se terminer, et la suppression du code d'erreur n'a de sens qu'une fois que le backend a cessé de l'émettre. Entre les deux merges, le client garde une table d'erreur inutilisée : du code mort pendant quelques heures, pas un double format à maintenir.

## Hors périmètre

- **Toute logique de rendu propre aux images** : pas de galerie, pas de visionneuse, pas de carrousel dans l'écran de détail. Le média se lit par son transcript et ses artefacts, comme les autres.
- **Le mode de rendu du transcript**, qui reste celui de l'onglet lecteur existant.
- **Les carrousels photo TikTok**, refusés en amont par le classifieur backend.

## Notes à l'owner (pas des ACs)

1. **La vérification visuelle vous revient**, une fois task-384 déployée : partager un carrousel Instagram, puis regarder la ligne dans la bibliothèque, la tuile de « Ajouts récents » et l'en-tête de l'écran de détail. L'implémenteur ne peut vérifier que la cohérence du code et le passage de `tsc`.
2. **Le libellé de pastille est à valider par vous** — c'est le seul mot que cette tâche ajoute à l'interface. Il sera proposé dans les 11 langues ; si celui retenu ne vous convient pas, il se change en un endroit par langue.
3. **Les deux plateformes se regardent** : rien ici n'est gardé par plateforme, donc une différence entre iOS et Android serait un bug.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `"image_post"` est ajouté à l'union `MediaType` de `mobile/src/types/media.ts:13-22`, groupé avec les valeurs de payload de liste (`"document"`, `"audio"`) et couvert par le commentaire d'en-tête du fichier qui explique pourquoi ces valeurs-là y figurent.
- [x] #2 `getMediaTypeLabel` (`MediaListCard.tsx:343-362`) rend un libellé dédié pour `image_post` au lieu de retomber sur `mediaType.link`. La clé suit le nommage `mediaType.*` existant et le libellé nomme ce que la source est pour le lecteur, jamais le traitement qu'elle a subi (aucune mention d'OCR, de parsing ou de transcription).
- [x] #3 La clé de libellé est présente dans les 11 catalogues (`ar, de, en, es, fr, hi, it, ja, nl, pt, zh`), en majuscules comme ses voisines, et dans aucun autre fichier : `catalogs.ts` et `pseudo.ts` restent dérivés.
- [x] #4 `getMediaTypeIcon` (`src/lib/mediaTypeDisplay.ts`) rend un glyphe Ionicons dédié pour `image_post`. Aucune copie privée du switch n'est recréée dans `MediaListCard`, `HomeTile` ou `CompletedDetailView` : les trois continuent d'importer ce seul mapping.
- [x] #5 `getMediaTypeBgColor` (`MediaListCard.tsx:365-377`) traite `image_post` explicitement, avec une teinte prise dans `Colors` et non une valeur littérale.
- [x] #6 `IMAGE_POST_UNSUPPORTED` disparaît de l'union des codes (`types/media.ts:135`), de `ERROR_CODE_MESSAGES` (`getFriendlyErrorMessage.ts:69`) et de la liste des codes demandables (`:111`).
- [x] #7 La clé `mediaError.imagePostUnsupported` est supprimée des 11 catalogues. `grep -rn "imagePostUnsupported\|IMAGE_POST_UNSUPPORTED" mobile/` ne renvoie plus rien.
- [x] #8 La section 8 de `mobile/MANUAL_TEST_CHECKLIST.md` (`:218-226`) n'utilise plus le post photo Instagram pour produire un échec sur un code demandable, et nomme le même code de rechange que celui retenu par task-384 dans `docs/testing/manual-e2e-validation-matrix.md`. Les deux docs ne se contredisent pas.
- [x] #9 `npx tsc --noEmit` passe dans `mobile/`, et le lint du projet mobile ne signale aucun écart sur les fichiers touchés.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Le libellé et le glyphe

- **Pastille : `PHOTOS`** (`mediaType.imagePost`). Elle nomme ce que la source *est* — un jeu d'images — et rien du traitement : aucune mention d'OCR, de parsing ni de transcription. Onze langues : `PHOTOS` (en, fr), `FOTOS` (de, es, pt), `FOTO` (it), `FOTO'S` (nl), `写真` (ja), `图片` (zh), `صور` (ar), `फ़ोटो` (hi). Six caractères au plus en alphabet latin, soit la longueur de `PODCAST` / `ARTICLE` : la pastille ne change pas de gabarit. Le libellé est le seul mot ajouté à l'interface, et il se change en une ligne par catalogue si l'owner en préfère un autre (note owner #2).
- **Glyphe : `images-outline`** (Ionicons), la famille « images » empilées plutôt que `image-outline` au singulier — un carrousel est le cas courant. Une seule entrée, dans `src/lib/mediaTypeDisplay.ts` ; `MediaListCard`, `HomeTile`, `CompletedDetailView`, `unsorted-review` et `folders/[id]` continuent tous d'importer cette fonction, aucune copie privée n'a été recréée.
- **Teinte de pastille : `Colors.surfaceContainerHigh`**, la même que `article`, traitée par un `case` explicite et non par la branche `default`. Les deux teintes saturées de la palette sont réservées aux médias qui *se jouent* (ambre pour un podcast, `errorContainer` pour une vidéo) ; un post photo se lit, et ce qui le distingue est son mot et son glyphe, pas une troisième couleur en concurrence. La raison est écrite en commentaire au-dessus du `case` pour qu'on ne la relise pas comme un oubli.

### Écart assumé sur l'AC #1 (placement dans l'union)

L'AC demandait de grouper `"image_post"` « avec les valeurs de payload de liste (`document`, `audio`) ». Ce placement aurait été faux : `image_post` **est** un membre canonique depuis task-384 (`MediaType.IMAGE_POST` dans `api/models/media_contracts.py:35`), donc le détail le renvoie tel quel — le mapping `_LEGACY_MEDIA_TYPE_MAP` le fait pointer sur `CanonicalMediaType.IMAGE_POST`, pas sur un autre membre. Le commentaire d'en-tête qui couvre `document` / `audio` dit précisément l'inverse : « They are not part of the canonical MediaType enum, so they only ever show up in a list payload — the detail endpoint normalizes them to `article` / `audio_file`. » Hériter de cette phrase aurait installé une contre-vérité dans le fichier de types.

`"image_post"` est donc placé après `"short_video"`, à sa position canonique (celle de l'enum backend), et le commentaire d'en-tête a été réécrit pour couvrir les trois membres non évidents en distinguant les deux cas : `image_post` canonique d'un côté, `document` / `audio` propres au payload de liste de l'autre. L'exigence de fond de l'AC — une entrée dans l'union, documentée par le commentaire d'en-tête — est remplie.

### Nettoyage du code mort

- `IMAGE_POST_UNSUPPORTED` retiré de `MediaFailureCode`, de `ERROR_CODE_MESSAGES` et de `SOURCE_SUPPORT_REQUESTABLE_CODES` ; `mediaError.imagePostUnsupported` retiré des 11 catalogues. `grep -rn "imagePostUnsupported\|IMAGE_POST_UNSUPPORTED" mobile/` ne renvoie plus rien (seuls les fichiers de backlog task-381 / 384 / 385 le citent encore, comme trace historique).
- Les compteurs qui dépendaient de ce code ont suivi, sans quoi ils devenaient faux : le bloc de demande de source concerne désormais **7** des **22** membres de `MediaFailureCode` (15 laissés dehors), corrigé dans `getFriendlyErrorMessage.ts`, `SourceSupportRequestCard.tsx`, `app/media/[id].tsx` et le commentaire de `en.ts`. Au passage, le commentaire disait « twenty-four / sixteen » alors que l'union en comptait 23 : l'écart est résorbé, les trois nombres tombent juste (7 + 15 = 22, et 22 = le nombre de membres de `failure_codes.py` après task-384).
- `docs/CANONICAL_MEDIA_API_OPENAPI.yaml:697` gardait `IMAGE_POST_UNSUPPORTED` dans l'enum `error_code` — reliquat de task-384, qui avait nettoyé `CANONICAL_MEDIA_API_CONTRACT.md:234` mais pas le YAML. Une ligne supprimée : c'est le contrat dont l'union mobile est le miroir, et le laisser mentir aurait conduit le prochain passage mobile à réintroduire le code.

### Checklist de test manuel

`mobile/MANUAL_TEST_CHECKLIST.md` §8 utilisait le post photo Instagram pour provoquer un échec sur un code demandable — impossible depuis task-384, qui le fait réussir. La section reprend maintenant la source exacte retenue par `MD-25` de `docs/testing/manual-e2e-validation-matrix.md` : un **lien direct vers un fichier image** (`…/foo.jpg`), que le worker article refuse en `NOT_AN_ARTICLE_PAGE` après avoir lu son `image/jpeg`. Les deux checkboxes qui nommaient « the Instagram photo » / « the failed Instagram item » nomment l'item image-file, et le texte renvoie explicitement à `MD-25` pour que les deux documents restent liés.

### Vérifications

- `tsc --noEmit` dans `mobile/` : exit 0. Le typage prouve aussi deux choses au passage — `images-outline` est bien une clé de `Ionicons.glyphMap`, et les 11 catalogues sont complets (`Catalog = Record<TranslationKey, string>`, donc une clé manquante serait une erreur).
- `eslint` sur les 17 fichiers touchés : exit 0.
- `node_modules` n'existe pas dans le worktree : un lien symbolique temporaire vers celui du checkout principal a servi aux deux commandes, puis a été retiré. Rien d'autre n'est resté dans l'arbre de travail.

### Hors de portée de l'implémenteur

La vérification visuelle (note owner #1) reste à l'owner, une fois task-384 déployée : partager un carrousel Instagram, puis regarder la ligne de bibliothèque, la tuile « Ajouts récents » et l'en-tête du détail. Rien ici n'est gardé par plateforme, donc un écart iOS / Android serait un bug.
<!-- SECTION:NOTES:END -->
