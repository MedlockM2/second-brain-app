# Chargement d'un import dans l'onglet Lecture

Maquette en réponse au retour TestFlight `AM6k6fv3QCFz8rAOZnqS9KM` (build 27, 2026-11-13). Source : `_build/build.mjs`. Rendu : `code.html` (animations actives) → `screen.png` (figé).

## Le retour

« Globalement il faut simplifier et rendre plus premium l'ecran de chargement d'un media en cours d'import. Il y a trop de textes et de spinners dans tous les sens. De plus l'indication extraction de l'audio quand il n'y a pas d'audio a extraire est fausse (ici il s'agit d'un article par exemple) »

## Propositions

Cinq façons de montrer l'attente, avec un même fond : un seul état, une ligne qui dépend du type de média, aucun bouton.

- **A · Point qui respire** : le point du chat.
- **B · Texte qui scintille** : un reflet traverse la ligne.
- **C · Forme du texte** : des lignes grises parcourues par un reflet, sous la ligne d'état.
- **D · Type du média en anneau** : l'icône du type, entourée d'un arc ambre qui tourne.
- **E · Barre sous les onglets** : la barre de lecture devient une barre de progression.

## Décision de l'owner

**C**, le 2026-11-13. Implémenté dans `mobile/src/components/TextSkeleton.tsx` et `MediaProcessingState.tsx`. Le retrait d'« Actualiser » de l'état d'échec est validé dans la même décision : un job en échec n'en sort jamais côté backend.
