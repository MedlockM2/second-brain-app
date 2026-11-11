# « Texte complet » lisible pour un article web

Maquette en réponse au retour TestFlight `ANPCT7VWg0qWWuHgKePMPXA` (build 27, 2026-11-11). Source : `_build/build.mjs`. Rendu : `code.html` → `screen.png`.

## Le retour

« Il y a certains articles dont le format du rendu est peu lisible car tout le texte fait la même taille et n'est pas espacé. Propose des améliorations de cela et teste sur cet article du Monde […]. Montre-moi les mockups résultants pour que je donne mon go. »

L'article : la chronique du *Monde* « Aux Etats-Unis, les démocrates ont deux ans pour redessiner une politique étrangère… ». Sur `-dev`, c'est le job `c6f932f0`. Il a été lu par le rendu navigateur (`web-render`) le 2026-11-11 à 12:54 UTC.

## Cause, établie sur le texte stocké

- **Sur 34 170 caractères stockés, l'article n'en fait qu'environ 2 500.** Ce sont le chapô et les quatre paragraphes gratuits. Le reste est la fin de lecture « réservée aux abonnés » puis la fenêtre de consentement Didomi : trafilatura a extrait cette fenêtre de la page rendue comme du texte d'article.
- **`extract_clean_text` produit du texte brut (`output_format="txt"`).** Les paragraphes n'y sont séparés que par un retour à la ligne simple, et les intertitres, citations et listes sont perdus.
- **Les puces de la liste des cookies (« - Forecast ») font prendre tout le texte pour du Markdown à `normalize_transcript_text`.** Le texte est alors renvoyé tel quel, sans découpage en paragraphes, et le lecteur affiche un seul bloc. Cela vaut pour tout article qui contient une liste.

## Proposition

Elle est décrite dans la page, section « Ce qui change » :

- **Backend :**
  - retirer les fenêtres modales et les bandeaux de consentement avant l'extraction, d'après leur forme ;
  - extraire en Markdown ;
  - retirer le bloc payant et marquer l'article incomplet quand la page le déclare.
- **Lecteur, mobile et web :** chapô et légende appliqués par une règle de forme partagée.

## Vérification sur deux autres articles (demandée par l'owner)

Le but était de vérifier que la proposition n'est pas taillée pour *Le Monde*. Deux articles d'autres sites ont été testés : une brève franceinfo (chapô et intertitre) et le billet « The Joel Test » de Joel on Software (blog anglais avec listes).

Les deux chaînes ont été appliquées telles quelles :
- **l'ancienne :** `extract_clean_text` du dépôt ;
- **la nouvelle :** un seul prototype.

Le rendu passe par le parseur du client, `parseChatMarkdown`. `_build/autres_articles.json` contient les fragments ainsi rendus.

- **Mur de texte :** l'ancienne chaîne produit 0 séparation de paragraphe sur les deux articles. Le problème n'est pas propre au *Monde*.
- **Bruit dans le texte :** chez franceinfo, la moitié du texte stocké est la liste des vidéos associées (5 835 → 2 593 caractères une fois retirée). La règle des listes de liens l'enlève. Sur l'article de Joel, elle ne touche que la navigation.
- **Défauts trouvés et corrigés pour tous les articles :**
  - la sortie Markdown de trafilatura laisse des astérisques visibles, d'où une conversion depuis sa sortie XML ;
  - le titre `h1` était répété en tête du texte.
- **Règle abandonnée :** la mise en légende des lignes courtes. Elle ne s'applique qu'au *Monde*.
- **Chapô :** n'est retenu que si le premier paragraphe est identique à la description déclarée par la page. C'est juste sur les deux articles : oui pour franceinfo, non pour Joel, dont la description n'est qu'un extrait tronqué. C'est non vérifié pour *Le Monde*, qui répond 402 à une requête simple.
- **Résidus restants chez franceinfo :** « Vous pouvez désormais privilégier… » et « Shorts ».

Ce répertoire contient des extraits d'articles de presse. Ne pas le committer tel quel dans un dépôt public.

## Décision de l'owner

En attente.
