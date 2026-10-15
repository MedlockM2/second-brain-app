# TestFlight du 15 octobre 2026 — recherche et commandes d’ajout

La collecte App Store Connect du soir contient deux nouveaux signalements, tous deux sur le build 14, sans nouveau crash. Les trois captures ont été consultées. Les données brutes restent dans `.testflight-feedback/`, ignoré par Git.

## Recherche — TASK-523

Feedback `AITLJTpcSDvmNLLq5PP4LJE` : le compteur annonce 21 résultats pour « AI », mais la liste s’arrête après la première page. La flèche de retour au sommet manque également.

Le mobile demandait uniquement la page 1 de dix résultats et affichait déjà « fin des résultats ». Côté backend, le total était calculé en dédupliquant seulement les quarante premiers chunks Algolia, puis les pages étaient découpées dans cet échantillon. La flèche était implémentée uniquement dans la bibliothèque sans recherche.

Le backend utilise désormais `attributeForDistinct: media_item_id`, `distinct: 1` et la pagination native d’Algolia. La configuration déclarée de l’index est appliquée et son écriture attendue avant la première recherche du processus. Le regroupement suit la [méthode documentée par Algolia pour les documents découpés en sections](https://www.algolia.com/doc/guides/managing-results/refine-results/grouping/). Il conserve le meilleur chunk par média et le filtre de compte côté serveur.

`GET /api/search/transcripts` conserve `q`, `page` (base 1), `per_page` et ses filtres. Sa réponse porte `query`, `found`, `page`, `per_page`, `hits` et désormais `has_more`, issu du nombre de pages du moteur. `found` vient du comptage Algolia après regroupement, avec les limites de précision et de pagination du moteur ; il ne compte plus les seuls médias d’un échantillon de chunks.

La liste charge les pages suivantes au défilement, conserve les lignes après une erreur et propose une reprise. Un verrou empêche les demandes concurrentes d’une même page ; la révision de recherche et l’identité de session écartent les réponses obsolètes. Une suppression retire immédiatement la carte et revalide ensemble les pages déjà parcourues pour éviter qu’un décalage de positions saute un média. Les références supprimées connues restent exclues pendant cette revalidation. La même commande de retour au sommet sert les deux listes, reste au-dessus de la barre native, se masque avec le clavier et respecte Réduire les animations.

Vérification directe sur les services dev, sans serveur FastAPI local : lecture de la partition de bibliothèque pour sélectionner la fixture, puis appels Algolia réels. L’index `media_items_dev` n’avait pas d’attribut de regroupement. La configuration du correctif y a été appliquée ; aucun transcript ni média n’a été réécrit. Sur les données présentes au moment de la vérification, « AI » renvoie **22 résultats, en pages de 10, 10 et 2**, avec 22 identifiants distincts et `has_more: false` sur la troisième page. Le nombre diffère de la capture antérieure ; la vérification porte sur les données actuelles.

## Commandes de dossier — TASK-524

Feedback `ACJh1x2gl9sFgbvwCcYmlHU` : placer photo et ajout en bas, au centre, en superposition des sources, comme sur la capture NotebookLM jointe.

Les commandes étaient montées dans le flux entre l’en-tête et les onglets. Elles sont maintenant superposées au bas de la zone Sources, au-dessus du dock de chat lorsqu’il est présent. La safe area reste gérée par la page. Le dernier média peut défiler au-dessus des boutons grâce à un espace réservé correspondant à leur hauteur et à leurs marges. Un dossier vide conserve les commandes ; l’onglet IA ne les monte pas. Le composant partagé conserve la destination du dossier avant les pickers, l’authentification et l’envoi. L’Accueil utilise le même composant avec son décalage de barre native.

## Vérifications et distribution

Typecheck mobile/core/web, lint mobile/core et Ruff/mypy backend passent. Le lint mobile conserve uniquement le warning préexistant de `purchaseService.ts`. Exports Hermes iOS et Android vérifiés. Aucun test automatisé ajouté ou lancé. Aucun changement de dépendance native ; changements mobiles distribuables par OTA sur les deux plateformes.

Après le push et le déploiement API, vérifier sur appareil : recherche dépassant dix résultats, dernière page, retour au sommet après fermeture du clavier, changement rapide de requête, erreur réseau/reprise et suppression en milieu de parcours. Vérifier aussi les boutons sur dossier vide/rempli, le dernier média, les grandes polices, le passage Sources/IA, le chat et la destination d’import dans un sous-dossier. Les exports et la lecture Algolia ne prouvent pas le rendu ni les gestes natifs sur iPhone.
