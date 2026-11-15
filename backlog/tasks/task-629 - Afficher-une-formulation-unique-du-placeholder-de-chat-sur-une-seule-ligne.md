---
id: TASK-629
title: 'Afficher une formulation unique du placeholder de chat, sur une seule ligne'
status: Done
assignee: []
created_date: '2026-11-15 12:56'
updated_date: '2026-11-15 13:18'
labels:
  - mobile
  - ui
dependencies: []
modified_files:
  - mobile/src/components/chat/ChatComposer.tsx
  - mobile/src/components/chat/ChatDock.tsx
  - web/src/styles.css
  - packages/core/src/i18n/ar.ts
  - packages/core/src/i18n/de.ts
  - packages/core/src/i18n/en.ts
  - packages/core/src/i18n/es.ts
  - packages/core/src/i18n/fr.ts
  - packages/core/src/i18n/hi.ts
  - packages/core/src/i18n/it.ts
  - packages/core/src/i18n/ja.ts
  - packages/core/src/i18n/nl.ts
  - packages/core/src/i18n/pt.ts
  - packages/core/src/i18n/zh.ts
priority: medium
ordinal: 228000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Retour bêta du 15 novembre 2026 sur le build 27 (iPhone 11, 414x896 pt, iOS 26.6.2, fr-FR) : « Depuis qu'on a ajouté le globe a gauche du composeur la phrase « poser une question sur cette… » est coupée. A resoudre intelligement, pas de retour a la ligne ca ferait moche »

Diagnostic déjà établi, à reprendre tel quel : le placeholder natif d'un TextInput multiligne revient toujours à la ligne, et le champ vide est limité à une ligne — « source… » était donc coupé net, sans ellipse. La phrase fait environ 270 pt ; depuis l'ajout du globe le champ n'en laisse plus qu'environ 238 sur un iPhone 11 et environ 184 sur un Android de 360 dp. Le composeur web a exactement le même globe et la même coupure.

Une première proposition (branche feedback/placeholder-composeur-tronque, refusée par le propriétaire le 15 novembre 2026) introduisait des phrases courtes propres au composeur tout en laissant au dock au repos sa phrase longue : le libellé changeait donc sous le doigt entre le dock fermé (« Poser une question sur cette source… ») et le composeur ouvert (« Interroger cette source… »). Critère du propriétaire : une seule formulation pour un même geste, dans les deux états. Les autres parties de cette proposition restaient valides : rendu du placeholder sur une seule ligne avec ellipse, et marge horizontale nulle sur Android pour aligner le texte saisi sur le placeholder.

Rien n'est déployé en magasin : supprimer les clés devenues inutiles au lieu de les garder en repli.

Note au propriétaire, hors critères d'acceptation : vérifier après l'OTA, sur iPhone, une conversation de média puis de dossier, y compris à la taille de texte maximale.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Une seule formulation de placeholder par portée (source, dossier) sert à la fois au dock au repos et au composeur ouvert, dans les 11 catalogues de packages/core/src/i18n ; aucune formulation alternative ni clé de repli ne subsiste pour cet usage.
- [x] #2 Le placeholder tient sur une seule ligne dans le composeur à côté du globe et du bouton d’envoi : jamais de retour à la ligne, ellipse en fin de ligne quand la largeur manque. Les largeurs retenues pour 360 dp et 414 pt à la taille de police par défaut sont écrites en commentaire à côté des clés.
- [x] #3 Le placeholder affiché par le composeur ne capte pas les touchers et reste invisible pour VoiceOver et TalkBack ; le champ conserve un libellé d’accessibilité qui énonce l’action complète.
- [x] #4 Le premier caractère saisi s’affiche à la même position horizontale que le placeholder sur iOS et sur Android, sans recours à Platform.OS dans le composeur.
- [x] #5 Le composeur web utilise la même formulation, sur une ligne avec ellipse ; lint et typecheck passent sur mobile, web et packages/core.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Une seule clé par portée, sans nouvelle clé. `chat.dock.askMedia` et `chat.dock.askFolder` servaient déjà au dock au repos et au composeur ouvert : c'est la branche refusée qui avait créé des clés propres au composeur. Leur texte est raccourci dans les 11 catalogues, et `ChatDock` passe désormais au modal la même variable `restingLabel` qu'au dock. Le dock et le composeur affichent donc la même phrase, par construction.

Formulations retenues (source / dossier) : fr « Interroger cette source… / Interroger ce dossier… », en « Ask about this source… / Ask about this folder… », de « Diese Quelle befragen… / Diesen Ordner befragen… », es « Pregunta a esta fuente… / Pregunta a esta carpeta… », it « Chiedi a questa fonte… / Chiedi a questa cartella… », nl « Deze bron bevragen… / Deze map bevragen… », pt « Pergunte a esta fonte… / Pergunte a esta pasta… », ar « اسأل هذا المصدر… / اسأل هذا المجلد… », hi « इस स्रोत से पूछें… / इस फ़ोल्डर से पूछें… », ja « このソースに質問… / このフォルダに質問… », zh inchangé (déjà court).

Largeurs à 16 pt, mesurées par la somme des avances de glyphes avec fontTools (SF Pro pour iOS, Roboto pour Android, Noto pour l'arabe et le devanagari ; sans crénage ni mise en forme contextuelle des glyphes, donc approximatives pour ar/hi) : la plus large est es « Pregunta a esta carpeta… » avec 180,4 en Roboto et 167,5 en SF. Toutes tiennent dans les 184 disponibles sur 360 dp et les 238 pt sur 414 pt. Avant : fr 266,4 en Roboto et 247,5 en SF. Ces largeurs sont écrites en commentaire à côté des clés, en détail dans en.ts et sur une ligne dans les dix autres catalogues.

Composeur mobile, repris tel quel de `6b38c3cd` : le placeholder est un `Text` d'une ligne (`numberOfLines={1}`, `ellipsizeMode="tail"`) posé sur la première ligne du champ, avec `pointerEvents="none"`, `accessibilityElementsHidden` et `importantForAccessibility="no-hide-descendants"`. Le `TextInput` n'a plus de `placeholder` natif et garde `accessibilityLabel={placeholder}`. `paddingHorizontal: 0` sur le champ retire la marge du thème Android : le premier caractère tombe là où commence le placeholder, sans `Platform.OS`.

Web : `useChatPane` lisait déjà les mêmes clés. `.composer textarea::placeholder` passe en `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`.

Contrôles : lint et typecheck à 0 sur packages/core, web et mobile. Un avertissement eslint `no-explicit-any` préexistant subsiste, hors des fichiers du chat.

À vérifier par le propriétaire après l'OTA (hors critères d'acceptation) : sur iPhone, une conversation de média puis une de dossier, y compris à la taille de texte maximale.
<!-- SECTION:NOTES:END -->
