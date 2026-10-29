---
id: TASK-569
title: Réduire le poids des photos PNG choisies dans la galerie avant leur envoi
status: Done
assignee: []
created_date: '2026-10-29 15:20'
updated_date: '2026-10-29 15:27'
labels:
  - mobile
  - ingestion
dependencies: []
references:
  - mobile/src/lib/localImport.ts
  - mobile/src/services/presignedUpload.ts
  - node_modules/expo-image-picker/build/ImagePicker.types.d.ts
  - 'https://docs.expo.dev/versions/latest/sdk/imagepicker/'
priority: medium
type: enhancement
ordinal: 175000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Une capture d'écran choisie dans la galerie part à sa taille d'origine. Le 2026-10-29, un PNG de 2 796 034 octets (`IMG_4622.png`, compte dev `4cd1abcb…`) a mis jusqu'à ~21 s à monter sur réseau mobile, entre `POST /api/media/upload-url` (15:10:43.607) et `POST /api/media/upload` (15:11:05.007). Un PNG de 365 Ko importé juste avant (`IMG_4633.png`) est passé en moins d'une seconde. La lenteur a poussé l'owner à relancer l'import, ce qui a créé un doublon.

`pickPhotoFromLibrary` passe `quality: 0.8` à `expo-image-picker`, mais la documentation de la version installée (55.0.20) dit : « On iOS, if a .bmp or .png image is selected from the library, this option is ignored » (`ImagePicker.types.d.ts`, option `quality`). Les captures d'écran iOS sont des PNG, et c'est précisément le cas d'usage principal (des messages, une conversation, une page).

L'image sert ensuite à l'OCR (LlamaParse, worker `document_parsing`) et à la couverture. La réduction doit donc garder le texte lisible : on ne réduit pas la résolution, seulement l'encodage.

## Hors périmètre

- Le sélecteur de fichiers (`pickFileToImport`) : un fichier choisi comme document est envoyé tel quel.
- L'appareil photo, qui produit déjà du JPEG où `quality` s'applique.
- L'écran de rapport de bug, qui a son propre sélecteur.

## Note à l'owner (hors AC)

Vérification manuelle sur TestFlight : importer depuis la galerie une capture PNG lourde. Dans les logs `media-summarizer-api-dev`, `media.upload_url.issued` doit montrer une taille nettement réduite, et le résumé produit doit reprendre correctement le texte de la capture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Une image PNG choisie dans la galerie (iOS et Android) est envoyée dans un format compressé, sans perte de résolution, au lieu de ses octets d'origine
- [x] #2 Le nom, l'extension et le type MIME envoyés à `POST /api/media/upload-url` correspondent au format réellement envoyé, et ce format fait partie de ceux que le backend accepte pour un document
- [x] #3 Une image déjà compressée (JPEG, HEIC) n'est pas réencodée une deuxième fois
- [x] #4 Si la conversion échoue, l'image d'origine est envoyée telle quelle et l'import n'est pas bloqué
- [x] #5 Le titre d'une capture reste le même qu'aujourd'hui : un nom opaque ou issu de l'appareil donne toujours le libellé daté « Photo — <date> » (task-329, task-400)
- [x] #6 Le sélecteur de fichiers, l'appareil photo et l'écran de rapport de bug ne changent pas de comportement
- [x] #7 Une nouvelle dépendance éventuelle fait partie du SDK Expo installé et apparaît dans `mobile/package.json` à la version compatible
- [x] #8 `npm run lint` et `npx tsc --noEmit` passent sans erreur dans `mobile/`
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémenté dans mobile/src/lib/localImport.ts : pickPhotoFromLibrary passe l'asset choisi par compressPngAsset avant toResult. Un PNG (mimeType image/png ou extension .png) est réencodé en JPEG qualité 0,9 avec expo-image-manipulator (ImageManipulator.manipulate(uri).renderAsync() puis saveAsync), sans redimensionnement : largeur et hauteur d'origine. Qualité 0,9 plutôt que 0,8 (appareil photo) parce que ces images sont surtout des captures lues par l'OCR.

Nom, type MIME et extension suivent le format : IMG_4622.png devient IMG_4622.jpg, image/jpeg ; jpg fait partie de IMAGE_UPLOAD_EXTENSIONS et le backend lit toujours IMG_4622 comme un nom d'appareil (_DEVICE_NAME_RES), d'où « Photo — <date> ». Un nom opaque retombe sur photo-<epoch>.jpg via defaultPhotoName (extension lue sur l'URI du fichier converti). fileSize est laissé vide : stageUpload lit la taille du nouveau fichier.

JPEG et HEIC ne sont pas touchés. En cas d'échec de la conversion, l'asset d'origine part tel quel (console.warn). pickFileToImport, capturePhotoToImport et l'écran de rapport de bug sont inchangés.

Dépendance : expo-image-manipulator ~55.0.16, version fixée par expo/bundledNativeModules.json pour le SDK 55 installé, ajoutée à mobile/package.json et au package-lock.json racine. Pas de plugin de config nécessaire ; mobile/ios et mobile/android ne sont pas versionnés (CNG).

npx tsc --noEmit : 0 erreur ; npm run lint : 0 erreur (1 avertissement préexistant dans purchaseService.ts).

Note owner : nouveau module natif, donc nouveau build EAS (iOS et Android) avant de tester ; la politique runtimeVersion fingerprint empêche qu'une mise à jour OTA atteigne les builds actuels. Puis vérification TestFlight décrite dans la description (taille dans media.upload_url.issued, texte repris dans le résumé).
<!-- SECTION:NOTES:END -->
