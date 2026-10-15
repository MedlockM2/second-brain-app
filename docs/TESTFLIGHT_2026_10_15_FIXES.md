# Correctifs TestFlight du 15 octobre 2026 — TASK-517 à TASK-522

Cette livraison couvre les dix retours encore ouverts des deux passes de triage du soir. Les captures et collectes restent dans le répertoire ignoré `.testflight-feedback/`. Les retours déjà intégrés, déclinés ou remplacés ne sont pas rouverts.

## Changements

| Tâche | Comportement livré |
| --- | --- |
| TASK-517 | Le tap Nouveau dossier montre immédiatement une tuile locale et son éditeur. Le nom standard vient des noms déjà connus ; la création part en arrière-plan sans relecture des compteurs de tous les dossiers. Une identité UUID de création accompagne la requête et les reprises ; le serveur dérive un identifiant par compte et retrouve une création déjà réussie. Le brouillon reste local jusqu’à la réponse, puis est rattaché au vrai dossier sans changer la clé du champ pendant la saisie. Un refus de doublon exige toujours OK, sans second message rouge. La visibilité du champ et de son erreur est recalculée après les changements de clavier/layout, sans double soustraction sur une fenêtre déjà redimensionnée. Après validation, le défilement suit l’identifiant du dossier sous son nom final, une fois le clavier fermé ; aucun déplacement si la tuile est déjà visible. |
| TASK-518 | Ajouts récents, Reprendre et le compteur de revue utilisent les snapshots du cache de compte. Les revalidations restent indépendantes. Les mutations de médias/dossiers et les engagements/générations invalident les ressources concernées ; changement de compte et déconnexion les purgent. Côté serveur, les lectures de Revue et Reprendre partagent une connexion DynamoDB dans leur propre périmètre, sans cache serveur de données utilisateur. |
| TASK-519 | La page média reste montée dès son premier snapshot, pendant l’extraction puis la lecture, avec titre/couverture disponibles et chargements locaux. Une question peut être envoyée localement et porte l’état explicite « En attente de l’extraction — question conservée dans cette session ». Le contrôleur partagé conserve son identifiant d’envoi, observe la source et ouvre la conversation seulement lorsqu’elle est prête. Une seule question en attente par fil, annulable. La navigation ne perd pas l’attente ; le passage en arrière-plan suspend les lectures et le retour les reprend. Échec d’extraction ou disparition de la source fait échouer l’attente sans génération. Nouveau fil, annulation et changement de compte rendent les lectures anciennes inopérantes. L’attente n’est pas persistée après fermeture de l’app. |
| TASK-520 | Les actions photo et ajout de l’Accueil sont un composant commun également monté dans un dossier, vide ou rempli. La destination est transmise dans l’intake avant l’envoi automatique et survit à la reprise après authentification. La confirmation peut ensuite changer cette destination. Les pickers, permissions, quotas et validations existants restent communs. |
| TASK-521 | Revue et Approfondir partagent désormais une pile interne sous la même présentation plein écran et un provider de safe area local. La revue reste montée avec sa file et sa carte au retour. Les liens de citation ouverts depuis ce parcours restent dans cette pile. L’ancienne route de revue est supprimée ; Accueil ouvre `/review`. Le lecteur habituel et le Digest gardent leurs propres présentations. |
| TASK-522 | Les lectures quotidiennes et hebdomadaires du Digest retirent les références supprimées ou disparues par une lecture groupée cohérente de `user_media`. La capture stockée, son ordre et le chemin d’envoi restent intacts ; seule sa projection visible est filtrée. Une lecture incomplète/throttlée échoue plutôt que déclarer des médias supprimés. Les couvertures des trois faces de chaque pile sont résolues depuis les détails partagés, au plus six identifiants, sans dépendre des cent derniers médias de la bibliothèque. |

## Contrat de création de dossier

`POST /api/folders` accepte `creation_id`, UUID optionnel. Pour une création inline, le client conserve le même UUID lors d’une réponse réseau incertaine. Le serveur dérive l’identifiant du dossier depuis le compte authentifié et cet UUID, puis renvoie le dossier existant lors d’une reprise, y compris si son nom a changé. La réservation atomique du nom et la création conditionnelle restent dans la même transaction. Les consommateurs qui ne nécessitent pas de reprise peuvent créer sans ce champ. Aucun endpoint supplémentaire, aucune migration de données.

Le brouillon optimiste n’est pas inséré dans le cache partagé des dossiers : les sélecteurs et autres écrans ne peuvent pas prendre une destination qui n’existe pas encore sur le serveur. En cas d’échec, le brouillon reste dans la grille ; une nouvelle validation reprend la même création.

## Mesures et contrôles réels

Lectures AWS dev depuis le poste, sans FastAPI local et sans écriture. Dix paires de lectures, ordre alterné, sur la même fixture et le même processus ; comparaison du chemin ouvrant ses connexions séparément au chemin partageant la connexion. Médianes :

| Lecture | Connexions séparées | Connexion partagée |
| --- | --- | --- |
| Revue, résolution du dossier + comptage | 185,8 ms | 107,4 ms |
| Reprendre, lectures + hydratation + signatures | 258,8 ms | 248,5 ms |

Les séries montrent une variabilité importante pour Reprendre. Ces chiffres n’incluent ni authentification/API Gateway ni démarrage Lambda ni rendu mobile ; ils ne prouvent donc pas que le premier lancement ressenti est aussi rapide qu’Ajouts récents. Le gain mesuré est net sur le chemin de Revue et faible sur Reprendre. Le cache améliore les retours dans une session, pas un lancement sans données conservées.

Une comparaison des pages de couvertures de quatre et vingt-cinq lignes a produit les mêmes compteurs/URLs brutes dans le même ordre, mais le même nombre de requêtes sur les dossiers examinés. Le réglage de quatre est conservé ; aucune optimisation de pagination non démontrée n’est livrée. L’instrumentation temporaire n’est pas intégrée au code.

Le filtrage Digest a été exécuté contre les références réelles des périodes signalées : deux références quotidiennes donnent une référence visible ; onze hebdomadaires en donnent neuf lors de la vérification finale. Les suppressions supplémentaires survenues depuis le triage sont ainsi prises en compte sans réécrire la capture. Aucun contenu ni identifiant de compte n’est consigné ici.

Contrôles locaux : typecheck mobile/core/web, lint mobile/core et Ruff/mypy backend ; seul avertissement préexistant de `purchaseService.ts`. Exports Hermes iOS et Android vérifiés. Aucun test automatisé ajouté ou lancé.

## Validation après déploiement et distribution

Attendre le déploiement API qui connaît `creation_id` avant de valider les reprises de création avec le bundle mobile. Aucun changement de dépendance native : le mobile est distribuable par OTA sur iOS et Android.

Vérifier sur appareil : grille longue/petite, recherche déjà focalisée, clavier matériel et changement de frame, grandes polices, création pendant réseau lent/perdu puis reprise, doublon avec OK, validation clavier et tap extérieur, nouveau tri, retours de navigation. Vérifier également extraction → question → réponse unique, annulation/échec/disparition de source, navigation et arrière-plan pendant l’attente, imports vers un sous-dossier après reconnexion, retour Approfondir sur la même carte, et Digest au premier affichage après une suppression dans une autre session.

Les contrôles statiques et exports ne constituent pas une reproduction native des incidents clavier et safe area. Leur résolution visuelle doit être confirmée après distribution.
