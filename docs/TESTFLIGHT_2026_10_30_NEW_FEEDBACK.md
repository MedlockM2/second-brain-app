# Nouveaux retours TestFlight du 29 octobre — corrections du 30 octobre 2026

Collecte App Store Connect : 72 retours sur 30 jours, 11 requêtes ; trois identifiants
absents du registre et des branches en attente. Aucun nouveau crash. Les trois
captures viennent d’un iPhone 11 sous iOS 26.6.2, build 18 ; le build courant est
19. Les retours déjà tranchés et le retour explicitement en standby restent exclus.

## Diagnostic et changements

| Tâche / retour | Cause et correction |
| --- | --- |
| TASK-575 / `ALHsTSDwD6sjpkheHJIHHlA` | La lecture utilisait la dernière fenêtre fermée du scheduler : les ajouts de la journée/semaine courante n’y entraient pas. Elle porte désormais sur la journée locale et la semaine ISO courantes. La composition est conservée cinq minutes dans DynamoDB, vide incluse, dans deux emplacements par fuseau remplacés au fil des périodes. Les notifications et leurs claims gardent leurs fenêtres fermées. Les préférences d’envoi ne masquent plus la lecture. Le détail et les limites sont dans `MOBILE_RESOURCE_CACHE.md`. |
| TASK-576 / `AJVy9sNlM_JW7nqvazUuBiI` | Le Compte passait les valeurs brutes au formateur, autorisant trois décimales. Un formateur partagé affiche consommation, disponible, réservations et avertissements arrondis à l’unité : 7,955 → 8 %, 92,045 → 92 %. Les montants, seuils et jauges ne sont pas arrondis ; les estimations conservent leur précision pour ne pas faire croire qu’un traitement est gratuit. |
| TASK-577 / `AIsMzMKckUduufn3CFikm2g` | Le même texte était affiché pour absence de requête, délai de prévision, réponse indisponible ou échec réseau. Le premier chat n’a pas encore de conversation : le client passe une requête nulle, donc aucun calcul de prévision ne part. Cela explique le message sans impliquer un échec de réservation ; la capture seule ne permet pas d’établir l’état réseau historique. Ces états rendent maintenant `null` sur mobile et web, sans paragraphe vide. Les prévisions disponibles et refus explicites restent visibles. Les onze chaînes devenues inutilisées ont été supprimées et le contrat aligné. |

Les trois changements s’appliquent à iOS, Android et web. Aucun changement natif,
aucune nouvelle dépendance, aucun changement des contrôles d’admission budgétaire.

## Vérifications effectuées

- `npm ci` depuis la racine du worktree, types et lint des trois workspaces réussis.
  Seul warning de lint : `purchaseService.ts:136`, `any` préexistant.
- Ruff et mypy backend réussis (213 fichiers). Build web réussi ; avertissement
  préexistant de bundle supérieur à 1 000 kB.
- Exports Expo iOS et Android réussis. Avertissements de configuration API de
  contrôle et de configuration Sentry manquante dans l’environnement local.
- Lecture du service modifié contre les vrais `user_media-dev` et `user_digests-dev`,
  avec fixtures temporaires sans compte réel : cache vide réutilisé, puis expiration
  forcée dans sa ligne DynamoDB, deux médias du jour et trois de la semaine en ordre
  chronologique, cache rempli réutilisé, média supprimé exclu par la lecture de
  visibilité. Une clé de période périmée provoque une nouvelle composition ; le
  fuseau Pacific/Kiritimati donne le 31 octobre au lieu du 30 en Europe/Paris.
  Les caches n’ont pas de marqueur de publication. Quatre médias et trois lignes
  de cache de fixture supprimés en fin de vérification. Aucun push, artefact ou
  appel fournisseur déclenché.
- Revue manuelle Safari des vrais formateurs partagés, du composant web de prévision
  et de la page Digest, alimentés en mémoire : arrondis 8 % / 92 %, libellés de
  périodes et états vides français/anglais, absence de message d’indisponibilité,
  petite estimation `<0,001%` visible et refus explicite conservé. Le brouillon
  demeure affiché. Cette revue isolée ne prouve ni le backend déployé ni le rendu natif.
- Aucun test automatisé ajouté, aucune route FastAPI exécutée localement.

## Après fusion

Déployer l’API pour les périodes courantes, distribuer l’OTA et le web pour la
présentation ; aucun nouveau binaire requis par ces changements. Sur appareil,
contrôler le Digest hors notification, un ajout puis une réouverture après cinq
minutes, le passage à minuit/lundi dans le fuseau du profil, et les suppressions.
Ouvrir également une notification pour constater qu’elle mène à la période
courante, puis vérifier le Compte et les prévisions/refus dans chat, import et IA.
Aucun push Git, déploiement ou distribution n’est inclus dans cette session.
