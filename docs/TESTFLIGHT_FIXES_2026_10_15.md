# Correctifs TestFlight du 15 octobre 2026

Feu vert owner sur cinq retours du build 14. Le dialogue Nouveau dossier est traité séparément par a8032a0a ; aucun changement sur Reprendre l’apprentissage. Le numéro de build ne permet pas d’identifier l’OTA installée au moment d’un retour.

| Tâche | Feedback-Id | Correction |
| --- | --- | --- |
| TASK-509 | AJ52jltUDbYSv3vl48r-E7Y | Composeur du chat placé depuis la frame finale du clavier, sans KeyboardAvoidingView ni LayoutAnimation. Le premier rendu du composeur attend son layout final ; le corps source reste visible. |
| TASK-510 | AO1OWsXSeddiTWtjNEDFFLw | File des non-classés initialisée depuis la page asc/100 conservée, y compris vide ; actualisation du cache pour la séance suivante sans réordonner la séance courante. |
| TASK-511 | AESheO4N1rUCogJdX1g6rjM | Flèche superposée au-dessus de la barre d’onglets après une hauteur d’écran de défilement, retour au sommet de la même liste sans perdre ses pages. |
| TASK-512 | APkn55PhKyb2jltDjMEwx_U | Bande de métadonnées supprimée, titre souligné ouvrant l’original avec icône externe et rôle lien ; bandeau de titre plus transparent et flou limité à cette zone. |
| TASK-513 | AI6-EaM_M6h7liw_P5ktu7k | Structure Markdown préservée avant normalisation de prose, parseur partagé avec tables et br, rendu mobile commun au lecteur et au chat. |

## Diagnostic du tableau

Lecture seule du registre de contenu et des objets S3 dev du média signalé. L’original comporte 1 887 caractères, 13 lignes et 8 lignes de tableau ; la traduction française 2 117 caractères, 12 lignes et 8 lignes de tableau. Les deux objets ont un tableau intact. La voie de lecture non classée `.md` passait par le normaliseur de prose, qui joignait les lignes et découpait les blocs longs ; puis TranscriptReader affichait du Text brut. La correction préserve les blocs structurés dans le normaliseur utilisé à l’écriture et à la lecture. Aucune réécriture d’objet S3, régénération de traduction, modification de fournisseur ou de prompt n’est nécessaire.

Le parseur existant reconnaît désormais les en-têtes/séparateurs GFM, alignements, cellules vides et pipes échappés. Les cellules utilisent le rendu de gras/italique/code et convertissent explicitement br en saut de ligne. Les autres balises restent du texte ; aucun HTML n’est exécuté. Les transcriptions ordinaires gardent leur rendu de paragraphes et de locuteurs. Le même TranscriptReader est utilisé dans le bloc source du chat et dans le lecteur du Digest.

## Clavier et plateformes

Le chat mesure le viewport du modal et le bord supérieur final du clavier. iOS fournit les événements willShow/willChangeFrame ; Android redimensionne sa fenêtre puis fournit ses métriques. Le calcul clippe à screenY plutôt que de soustraire une seconde hauteur d’un viewport Android déjà réduit. Le premier composeur est invisible jusqu’au layout attendu ; le focus reste demandé à la présentation native. Un clavier matériel sans événement IME possède une reprise bornée à une seconde pour ne pas laisser le champ invisible. Cette reprise ne cadence pas le chemin normal. Historique et retour de citation conservent l’absence d’autofocus. La présentation/animation du clavier système elle-même reste contrôlée par l’OS.

Le retour en haut réutilise TAB_BAR_CLEARANCE, dispose d’une cible de 48 points et de onze traductions, se masque lorsque le clavier est présent et respecte Réduire les animations.

## Bandeau et contraste

Le nouveau token mediaTitleVeil concerne uniquement MediaDetailHero : alpha 0,64 au lieu de 0,72. Le token partagé coverTitleVeil du Digest reste inchangé. En considérant les extrêmes d’une photo derrière le voile, le contraste de textMain est d’au moins 5,14:1 en clair et 4,61:1 en sombre. Les petits textes du bandeau utilisent aussi textMain. Ces calculs ne remplacent pas l’inspection visuelle sur des photos réelles.

Le bandeau utilise expo-blur déjà installé : BlurTargetView limité à la couverture, BlurView limité au titre. Sur Android 12+ la méthode SDK31Plus produit le flou ; les versions plus anciennes conservent une surface teintée transparente avec le même voile de contraste, sans le coût RenderScript. Réduire la transparence donne une surface opaque. Les autres surfaces Liquid Glass restent inchangées. Une sélection du navigateur peut ouvrir origin_url ; sinon le titre utilise une original_url HTTP(S) valide. Sans destination, aucun faux lien n’est affiché.

Références : [Expo BlurView SDK55](https://docs.expo.dev/versions/v55.0.0/sdk/blur-view/), [React Native Keyboard](https://reactnative.dev/docs/keyboard.html), [tables GFM](https://github.github.io/gfm/#tables-extension-), [identification des liens W3C](https://www.w3.org/WAI/WCAG21/Techniques/general/G183).

## Contrôles et validation native

Aucun test automatisé ajouté ni exécuté. Contrôles de livraison : typecheck/lint mobile et core, typecheck web, ruff/mypy backend, exports Hermes iOS/Android et revue du diff. Le lint mobile conserve uniquement le warning any préexistant de purchaseService. Les exports compilent les bundles ; ils ne prouvent pas le comportement natif.

Après intégration, déploiement backend et distribution interne, valider sur appareil :

- Chat média et dossier avec clavier fermé/déjà ouvert/matériel, historique et retour citation, rotation, fermeture pendant l’ouverture ; absence de trajectoire du composeur, brouillon et position préservés.
- Revue des non-classés : première ouverture, réouverture, cache vide, actualisation hors réseau, tri pendant une requête et reprise après suppression/déplacement refusé.
- Bibliothèque longue : retour en haut, pagination conservée, clavier de recherche et Réduire les animations, cible hors barre d’onglets.
- Titres longs, couverture claire/sombre, thèmes clair/sombre et Réduire la transparence ; lien depuis titre principal et rétracté, absence de lien sur fichiers sans origine.
- Tableau signalé dans l’original et la traduction, défilement horizontal des cellules, sélection du texte, navigation dans le Digest, transcriptions ordinaires avec locuteurs.

Implémentation livrée sur branche isolée, puis intégrée sur main le 15 octobre 2026 à la demande de l’owner. Le push lance les workflows existants ; leur réussite et la validation appareil doivent être rapportées séparément.
