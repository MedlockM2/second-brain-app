# Cartes mémo : pistes UX

`code.html` est la maquette autonome, générée par `_build/build.mjs`, et `screen.png` en est le rendu. Elle contient l'écran
actuel (`FlashcardsBody` dans `mobile/app/artifacts/[artifactId].tsx`) puis trois pistes, toutes dans les tokens du
thème clair Amber Clarity.

- **A. Paquet** : une carte à la fois. On la retourne d'un toucher, on passe à la suivante avec les flèches ou un glissement, et on peut mélanger le paquet. La barre de progression est celle du quiz.
- **B. Je savais / À revoir** (recommandée) : la piste A, avec un bouton « Voir la réponse » puis une auto-évaluation. La session se termine sur un bilan qui propose « Revoir les N cartes ». Cet état ne dure que le temps de l'écran.
- **C. Liste allégée** : la liste actuelle sans bruit. Elle offre « Tout afficher » et range la réponse dans l'encadré ambré. On y accède par un contrôle segmenté « Réviser / Liste ».

Régénérer : `node mobile-design-mockups/flashcards_ux/_build/build.mjs`. Rendu PNG :
`node --experimental-websocket mobile-design-mockups/flashcards_ux/_build/shoot.mjs [dossier-cadres]`.
