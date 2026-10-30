# Copier une réponse du chat — TASK-571

Feedback TestFlight `ANHAPwX0MNtWPZwLf6STajE`, reçu le 29 octobre 2026 sur
le build 18 : proposer un petit bouton de copie sous chaque réponse du chat.
La capture montre une conversation de dossier. Elle reste dans le répertoire
ignoré `.testflight-feedback/`.

Le chat média et le chat dossier disposent maintenant de la même action sur
mobile et web : une icône de copie en bas de chaque réponse terminée non vide,
y compris une réponse interrompue. Le texte intégral de la réponse est copié
en Markdown, avec ses citations `[S1]`, `[S2]`, etc. Une réponse encore en cours
de génération ne propose pas cette action. Les boutons de citation et de
reprise restent disponibles.

À la demande de l’owner, seule l’icône confirme la réussite : elle devient une
coche ✓ pendant deux secondes, puis redevient l’icône de copie. Aucun texte de
succès n’apparaît à l’écran ; « Copié » reste annoncé aux lecteurs d’écran.
Un échec affiche un message pendant cinq secondes ; le bouton permet de
réessayer. Les libellés et annonces accessibles sont traduits dans les onze langues.

Le mobile utilise `expo-clipboard` dans la version compatible avec Expo SDK 55
(`~55.0.13`, issue de `expo/bundledNativeModules.json`). Le web appelle
`navigator.clipboard.writeText` directement depuis le clic. Aucun chemin ne lit
le presse-papiers. Référence : [API Expo Clipboard pour SDK 55](https://docs.expo.dev/versions/v55.0.0/sdk/clipboard/).

## Vérifications locales

- Typecheck et lint mobile, core et web : réussis. Un avertissement `any`
  préexistant demeure dans `purchaseService.ts`, sans modification de ce fichier.
- Build web : réussi ; avertissement de taille du bundle Vite.
- Autolinking iOS et Android : `expo-clipboard` est résolu sur les deux plateformes.
- Exports Metro/Hermes iOS et Android : réussis dans un répertoire ignoré ;
  avertissements habituels de configuration locale API/Sentry.
- Aucun test automatisé ajouté ou exécuté.

## Distribution et vérification sur appareil

**Un nouveau build natif iOS et Android est nécessaire** : `expo-clipboard`
ajoute un module natif. Une OTA seule ne suffit pas aux anciens binaires.
La politique `runtimeVersion: fingerprint` et le workflow
`mobile-ota-or-build.yml` choisissent le runtime correspondant après intégration.
Aucun build ni déploiement n’a été lancé pendant cette correction.

Après distribution, vérifier sur iOS et Android la copie puis le collage dans
une autre application, depuis les chats média et dossier : réponse terminée,
réponse interrompue, absence du bouton pendant la génération, confirmation
accessible et conservation des actions de citation. Sur le web servi en HTTPS,
vérifier aussi la copie, le retour au bouton initial et un refus d’accès au
presse-papiers suivi d’une nouvelle tentative.

Ces interactions n’ont pas été exercées sur appareil pendant cette session ;
aucun simulateur iOS n’est disponible via `xcrun simctl` sur ce poste.
