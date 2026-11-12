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

Go le 2026-11-12, implémenté sur `main` le même jour :

- **Backend :** `media_summarizer/infrastructure/resolvers/article_markdown.py`, appelé par `extract_clean_text` (article statique et rendu navigateur).
- **Lecteurs :** `splitArticleText` (`packages/core/src/media/transcript.ts`), mobile et web.

Le rendu réel de la page du *Monde* dans Chromium a fait corriger le prototype sur quatre points avant l'implémentation :

- **Page vidée par la règle de consentement :** le `<html>` porte la classe `popin-gdpr-no-scroll`, donc la règle retirait toute la page. Un élément qui contient l'article n'est jamais retiré.
- **Chapô absent du texte extrait :** il est dans l'en-tête de la page, hors de ce que lit trafilatura, et la description déclarée le précède de « CHRONIQUE. ». Le chapô est maintenant le paragraphe de la page que la description reprend, avec au plus 3 mots devant. Il est remis en tête du texte s'il manque.
- **Encart « Lire aussi » et ligne « Il vous reste 65.98 % » :**
  - un paragraphe fait à 80 % ou plus de texte de lien est retiré ;
  - sur une page déclarée payante (`isAccessibleForFree: false`), le dernier paragraphe d'un bloc, s'il est entièrement en gras, est retiré.
- **Mise en forme de trafilatura :** activée, elle coupait des paragraphes et collait des mots (« testis » chez Joel). Elle est désactivée.

Ce que stocke la nouvelle extraction :

- **Chapô :** le premier paragraphe, entièrement en gras.
- **Article payant :** le texte se termine par la ligne `## [incomplete]`.

Les lecteurs reconnaissent ces deux formes. Un article déjà importé garde son ancien texte : il faut le repartager après le déploiement.
