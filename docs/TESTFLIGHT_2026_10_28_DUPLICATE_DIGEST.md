# Double notification Digest — 28 octobre 2026

Feedback `AO959Z8xpdHnqClkFQFQz5g`, soumis le 27 octobre à 21:45 (Paris),
version 1.0.0, build 17 (dernier build disponible), iPhone12_1, iOS 26.6.2.
Commentaire : « Bug : l’user a reçu deux fois la meme notification ».
La capture montre deux notifications quotidiennes identiques, chacune annonçant
un élément enregistré. Captures et données brutes restent gitignorées.

## Diagnostic

Lecture des logs CloudWatch dev du 27 octobre, entre 18:20 et 19:50 (Paris) :

- À 18:30:37–38, le scheduler enfile **une** notification quotidienne par compte,
  pour deux comptes distincts, période `2026-10-27`.
- À 18:30:41–42, le consommateur fait un envoi par compte : un appareil pour le
  premier, deux pour le second. Expo accepte les trois destinataires.
- À 18:45:45–46, les trois receipts ne signalent aucune erreur. Les ticks suivants
  enfilent zéro nouvelle notification : aucune relance du scheduler n'est visible.
- La lecture de `user_push_tokens-dev` le 28 octobre retrouve **le même jeton iOS
  sous ces deux comptes**. Les deux inscriptions précèdent les envois ; le second
  compte possède aussi un jeton Android distinct. Au total, quatre jetons sur
  seize sont inscrits sous plusieurs comptes dans les fixtures dev.

La cause établie est la propriété multiple du jeton : la clé `(user_id,
push_token)` autorisait plusieurs comptes pour le même téléphone. La seule
protection était un DELETE à la déconnexion, dépendant d'un jeton gardé en mémoire
et d'un réseau disponible. Les preuves ne permettent pas de départager une
ancienne déconnexion hors ligne, un redémarrage ou une autre interruption de ce
DELETE ; le serveur doit être correct dans tous ces cas.

Le jeton Expo reste stable au fil des mises à jour et, sur iOS, des réinstallations :
[documentation Expo](https://docs.expo.dev/push-notifications/faq/).
Le scheduler et ses marqueurs de publication ne sont pas modifiés par ce correctif.

## Correctif — TASK-560

La table existante conserve les inscriptions par compte et reçoit une partition
réservée `__push_token_owners__`, avec une ligne de propriétaire par jeton.
L'inscription et cette propriété sont écrites dans une transaction atomique ; le
dernier enregistrement validé devient le seul propriétaire. Les transactions
concurrentes ne peuvent pas créer deux propriétaires : elles ciblent la même clé.
Les actions sont sérialisées via le client DynamoDB, comme les réservations de
nom de dossier existantes. [Contrat DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html).

Le consommateur lit les inscriptions et la propriété en lecture cohérente et
n'envoie qu'aux jetons du propriétaire courant. Les jetons distincts d'un compte
restent tous destinataires. Les anciennes inscriptions sans propriétaire ne sont
plus destinataires : aucun repli vers le comportement précédent, aucune migration.
Elles seront réenregistrées par l'app au prochain lancement authentifié.

Désinscription, receipt `DeviceNotRegistered`, purge de péremption et effacement
du compte retirent conditionnellement sa propriété. Une opération tardive de A
ne peut donc pas désinscrire B. La purge vérifie aussi le `last_seen_at` lu par son
scan pour préserver une inscription renouvelée entre-temps. Les anciennes lignes
de compte devenues non destinataires sont éliminées à la désinscription, à
l'effacement du compte ou au balayage de péremption.

Backend partagé iOS/Android ; aucun changement mobile ou web, aucun nouveau
binaire, aucune OTA, aucune ressource ou permission AWS supplémentaire. Les
modifications Terraform sont des commentaires décrivant le modèle de données.

## Vérification

Opérations réelles via les fonctions du worktree sur `user_push_tokens-dev`, avec
des identifiants de fixture isolés et des valeurs de jeton non adressables :

- Deux appareils enregistrés pour A : deux destinataires.
- Transfert du téléphone à B : un destinataire restant pour A, un pour B.
- Désinscription tardive de A : B conserve son destinataire.
- Retour à A puis effacement des inscriptions de B : A conserve ses deux appareils.
- Suppression depuis un ancien `last_seen_at` : refusée après renouvellement.
- Inscription sans propriétaire : zéro destinataire.
- Effacement des inscriptions de A : zéro destinataire et aucune ligne de propriété.
- Balayage réel de péremption avec une fixture de 1990 et un seuil de 10 000 jours,
  après vérification qu'aucune inscription réelle n'entrait dans ce seuil : une
  inscription de fixture supprimée, sa propriété supprimée également.

Toutes les fixtures temporaires ont été supprimées en fin de vérification. Aucun
push envoyé, aucune donnée de compte réelle modifiée, aucun test automatisé ajouté.
`ruff check media_summarizer tests`, `mypy media_summarizer` (207 fichiers),
`scripts/check_purge_at_writers.py` et `git diff --check` passent.

## Distribution et limites

Après intégration, déployer **l'API et les workers ensemble**, puis relancer l'app
pour enregistrer le propriétaire du téléphone. Les anciens enregistrements sans
propriétaire ne reçoivent pas de push entre le déploiement et ce lancement. Sur
appareil, vérifier le prochain Digest après un changement de compte et l'absence
de notification de l'ancien compte. Cette validation native reste à faire.

Le correctif supprime les doubles destinations dues aux comptes. Il ne promet
pas une livraison exactement une fois : une notification déjà confiée à Expo ne
peut pas être rappelée pendant un changement de compte, et Expo documente une
livraison au moins une fois avec de rares doublons possibles. Le consommateur SQS
ne reçoit pas ici une nouvelle mécanique de déduplication : aucune reprise SQS
n'est impliquée dans les émissions observées de ce feedback.
