# Onglet IA : six directions de rupture

`../ai_tab_refonte/` améliorait l’onglet sans en changer le principe : un catalogue de cinq formats à générer. Ce
dossier remet en cause ce principe. Il pose d’abord le but de l’onglet, puis propose six directions qui parient
chacune sur un besoin différent. `comparatif/` réunit le brainstorm, une matrice et la première vue de chaque
direction ; chaque `direction_*/` montre trois écrans et ses conséquences (ce qui disparaît, backend, risque,
effort).

## À quoi sert cet onglet ?

On enregistre une source parce qu’elle vaut d’être gardée. L’onglet répond à la question suivante : **« et
maintenant, j’en fais quoi ? »**. Aujourd’hui, il y répond par un catalogue de formats repris du Studio de
NotebookLM. L’utilisateur doit traduire son besoin en nom de document, lancer une génération, puis la retrouver
dans un historique.

Les besoins réels, du plus fréquent au plus ambitieux :

| Besoin | Réponse actuelle | Ce qui manque |
|---|---|---|
| **Trier** : est-ce que ça vaut 42 min ? | Résumé, derrière un bouton | qu’il soit déjà là |
| **Comprendre** | Résumé détaillé, notes | rester près de la source, voir d’où vient chaque point |
| **Retenir** | Cartes mémo et quiz, une seule fois | la répétition dans le temps |
| **Utiliser** : agir, citer, répondre | Actions dans les notes | pouvoir demander ce qu’aucun format ne prévoit |
| **Relier** : ce que mes sources disent ensemble | Fiche sur un dossier | accords, désaccords, liens avec le reste de la bibliothèque |

Deux faits du dépôt rendent la rupture possible. Une fiche sur un seul média est illimitée sur toutes les formules
et coûte quelques centimes (task-287, décision validée). Elle se génère en environ 5 s (les tests E2E de
`V1_LAUNCH_PLAN.md`). Le bouton « Générer » protège donc un coût qui n’existe presque pas. Sur un dossier, en
revanche, une génération consomme des minutes du forfait, et un geste explicite y reste justifié.

## Les six directions

| Direction | Parie sur | Ce qui disparaît | Backend nouveau | Effort |
|---|---|---|---|---|
| **1 — « Déjà prêt »** `direction_1_deja_pret/` | trier, comprendre | tout bouton de génération : une fiche unique est composée à l’import, et les formats deviennent ses sections | génération à l’import, fiche composite assemblée section par section | M–L |
| **2 — « Par intention »** `direction_2_par_intention/` | chaque besoin, nommé | les noms de formats : on choisit « Savoir si elle vaut 42 minutes », « Ne pas l’oublier »… et l’expérience s’ouvre en plein écran | scores de révision, type « comparer » pour un dossier | M |
| **3 — « Entraîneur »** `direction_3_entraineur/` | retenir | la fiche comme produit fini : l’onglet mesure ce qu’on a retenu, et la révision espacée revient chaque jour dans la Boîte de réception | état par carte et par utilisateur, espacement, rappel quotidien | L |
| **4 — « Calque »** `direction_4_calque/` | comprendre sans quitter la source | l’onglet IA d’un média : les points clés sont surlignés dans le texte, et « L’essentiel · 4 min » replie la transcription | passages ancrés dans la transcription (positions ou horodatages) | L |
| **5 — « Conversation »** `direction_5_conversation/` | utiliser | tuiles, historique, et le doublon onglet IA / chat : une seule conversation avec des suggestions, des réponses riches et un épinglage | réponses structurées comme des artefacts, épinglage (le chat existe : task-430, task-434) | M |
| **6 — « Carte des idées »** `direction_6_carte_des_idees/` | relier | le résumé comme produit principal : les idées d’un dossier, leurs accords et désaccords, et leurs liens avec le reste de la bibliothèque | idées normalisées par source, rapprochement entre sources | XL |

Les directions se combinent. Le dossier n’a pas de texte unique, donc 4 ne s’y applique pas et s’associe à 1, 5
ou 6. La révision de 3 peut naître des cartes de 1 ou de 2.

## Ce que je retiendrais

- **Court terme : 1 + 5.** On supprime le geste de génération sur un média, qui est gratuit, et le résumé est là
  à l’ouverture. On fusionne ensuite l’onglet avec le chat, qui existe déjà : il ne reste qu’une surface IA, et
  les formats y deviennent des suggestions. L’effort est le plus faible des combinaisons de rupture, car la brique
  la plus lourde, le chat, est faite.
- **Positionnement : 3 ou 6.** Ce sont les deux seules directions qui font de Deepn autre chose qu’un résumeur.
  3 répond à « ne pas oublier » et ramène l’utilisateur chaque jour ; 6 répond à « relier » et se distingue le plus
  nettement de NotebookLM. Chacune justifie un benchmark avant d’être découpée en tâches (choix d’un algorithme
  d’espacement ; extraction et rapprochement des idées).

## À vérifier avant de choisir

- **1** : le coût d’une génération systématique à l’import, y compris pour les sources jamais ouvertes. La
  parade proposée : composer l’essentiel à l’import, et le reste à la première ouverture.
- **3** : le rappel quotidien suppose des notifications de révision. La livraison push existe (task-368), mais
  aucun rappel de ce type.
- **4** : la fiabilité de l’ancrage. Un point clé surligné au mauvais endroit est pire qu’un résumé.
- **5** : le chat se facture par message, contrairement aux fiches. Il faut s’assurer que les suggestions de
  format ne fassent pas exploser ce poste.

## Conventions de rendu

Ce sont celles de `../ai_tab_refonte/` et de `folder_sources_tab_refonte/` : `code.html` autonome, police
système, glyphes extraits de `Ionicons.ttf`, tokens de `mobile/src/constants/theme.ts`, cadres de 414 x 896 en
`overflow: hidden`. Les données sont fictives. Les scores, notions, idées et liens entre sources montrés dans 2, 3
et 6 n’existent pas aujourd’hui : ce sont précisément les nouveautés que ces directions demandent.
