---
id: TASK-629
title: 'Afficher une formulation unique du placeholder de chat, sur une seule ligne'
status: To Do
assignee: []
created_date: '2026-11-15 12:56'
labels:
  - mobile
  - ui
dependencies: []
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
- [ ] #1 Une seule formulation de placeholder par portée (source, dossier) sert à la fois au dock au repos et au composeur ouvert, dans les 11 catalogues de packages/core/src/i18n ; aucune formulation alternative ni clé de repli ne subsiste pour cet usage.
- [ ] #2 Le placeholder tient sur une seule ligne dans le composeur à côté du globe et du bouton d’envoi : jamais de retour à la ligne, ellipse en fin de ligne quand la largeur manque. Les largeurs retenues pour 360 dp et 414 pt à la taille de police par défaut sont écrites en commentaire à côté des clés.
- [ ] #3 Le placeholder affiché par le composeur ne capte pas les touchers et reste invisible pour VoiceOver et TalkBack ; le champ conserve un libellé d’accessibilité qui énonce l’action complète.
- [ ] #4 Le premier caractère saisi s’affiche à la même position horizontale que le placeholder sur iOS et sur Android, sans recours à Platform.OS dans le composeur.
- [ ] #5 Le composeur web utilise la même formulation, sur une ligne avec ellipse ; lint et typecheck passent sur mobile, web et packages/core.
<!-- AC:END -->
