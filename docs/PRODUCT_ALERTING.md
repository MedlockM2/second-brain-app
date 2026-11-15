# Alerting produit de Deepn

Décision du propriétaire du 13 novembre 2026, TASK-628. L’alerte doit justifier
une action concrète sur des données, un parcours bloqué ou une coupure financière.
Un signal technique sans consommateur ne justifie pas un objet alarme.

L’audit initial a trouvé 524 notifications du 30 octobre au 13 novembre, dont
460 sur la latence API. Les corps réellement publiés sont récupérables via
`cloudwatch describe-alarm-history --history-item-type Action`, champ
`HistoryData.publishedMessage.email`. Ne pas publier d’adresse de destinataire,
de payload de secret ou de lien de désabonnement dans ce dépôt.

## Ce qui notifie

Les noms commencent par `media-summarizer-` et finissent par l’environnement.
Le module crée **11 points de notification**, soutenus par **19 conditions
silencieuses consommées par des composites**, soit 30 alarmes quand elles sont
activées. Dev héberge la bêta ; prod reste dormant. L’alarme de facture AWS
`billing-50usd-monthly`, hors module et en `us-east-1`, reste inchangée.

| Alerte | Sens et condition | Action |
|---|---|---|
| `api-indisponible` | Au moins 3 HTTP 5xx en 10 min, sans dénominateur minimal | Identifier le parcours, corriger ou revenir à la release précédente |
| `imports-bloques` | File abandonnée après le budget de reprises, DLQ persistante ou erreurs terminales répétées | Identifier la plateforme et les demandes ; réparer puis reprendre les messages récupérables |
| `artefacts-bloques` | Générations demandées en échec répété ou file bloquée | Corriger la cause et relancer les demandes concernées |
| `chat-bloques` | Génération, dispatch ou lecture du chat en échec répété, ou file bloquée | Rétablir la génération/diffusion des réponses |
| `recherche-bloques` | Indexation en échec répété ou file bloquée | Réparer puis réindexer les contenus concernés |
| `bibliotheque-a-preserver` | Une écriture durable importante échoue, ou une ligne disparaît sans suppression demandée | Préserver les données, identifier les médias et restaurer si nécessaire |
| `suppression-non-honoree` | Cascade en échec, purge dépassée de 48 h ou TTL sans cascade comptabilisée | Réparer la cascade et achever la suppression |
| `nouvelles-operations-bloquees` | Contrôle de capacité en défaut, réservations trop anciennes persistantes, refus du plafond dans deux fenêtres ou fournisseur refusé durablement | Réparer le contrôle ou le compte fournisseur, sans remettre les capacités à zéro |
| `capacite-financiere-80` | Exposition opérateur à 80 % du plafond mensuel | Examiner consommation et engagements, puis décider du plafond ; avertissement de planification, pas panne |
| `budget-audit-missing` | Deux fenêtres de 30 min sans audit complet | Réparer le contrôle de capacité/dépense |
| `user-media-reconciliation-stopped` | Absence de réconciliation de bibliothèque pendant 48 h | Réparer le contrôle des pertes et suppressions |

Le mail contient une description française : environnement, impact possible,
action, liens vers les logs et ce guide. La condition enfant dans une composite
identifie la phase en défaut. Le transport SNS existant est conservé, sans
nouveau service de notification ni traitement LLM.

## Parcours

Les conditions SQS utilisent les métriques natives, pas les erreurs/throttling
Lambda. Une condition existe pour un groupe de files et n’envoie aucun mail :

- capture des imports : X, YouTube, Instagram, TikTok, rendu web ;
- lecture des imports : résolution podcast, article, audio, document ;
- finalisation des imports : completion, traduction ;
- génération d’artefacts, chat et recherche : leur file propre.

Pour chaque file, le blocage est un message visible plus vieux que
`max(900 secondes, visibility_timeout_seconds × maxReceiveCount)` ou une DLQ
non vide. Il doit persister sur deux périodes de cinq minutes. Le seuil laisse
passer les reprises configurées : les files audio/document atteignent ainsi
3 h avant le seuil d’âge ; cela n’est **pas** un objectif de délai utilisateur.
Le contrôle DLQ s’applique dès l’épuisement des reprises, avec la même
confirmation de dix minutes. Chaque condition a au plus dix entrées métriques,
la limite de CloudWatch ; les trois phases d’import alimentent la même composite.

Les événements en échec sont regroupés par parcours : au moins deux en quinze
minutes. Pour les imports, `worker.failed` ne compte que lorsque les reprises
transitoires sont épuisées (`retryable=true`), plus les clôtures impossibles et
les erreurs techniques de transcription/traduction. Les refus permanents de
contenu (privé, supprimé, sans parole) ne sont pas un incident fournisseur.

Pour les artefacts, `artifact.failed` est émis après la transition terminale
persistée ; les erreurs internes/fournisseur et de préparation sont sélectionnées.
L’aperçu automatique `review_blurb` est exclu de ce compteur. Les files partagées
peuvent cependant contenir ces aperçus : un blocage SQS est un **indice à
qualifier**, pas une preuve qu’un nombre donné d’utilisateurs attend. Un compteur
de logs n’est pas un nombre de personnes, et les événements d’un import peuvent
représenter plusieurs étapes de sa demande. La description ne prétend donc pas
que deux événements correspondent à deux utilisateurs.

Le chat ajoute un contrôle de trois 5xx de lecture en dix minutes. Aucun contrôle
du premier octet ou du temps d’ouverture n’est introduit. Les notifications push
et le poll RSS ne déclenchent pas d’incident autonome ; la recherche a son propre
parcours, pour ne pas masquer un défaut d’indexation dans les imports réussis.

Ces conditions couvrent les événements existants et les files réellement
observables. Elles ne sont pas un audit exhaustif des demandes persistées : un
travail jamais envoyé dans une file et sans événement d’échec peut leur échapper.
Les utilisateurs peuvent toujours signaler un résultat manquant ; ne pas ajouter
une architecture de surveillance de chaque opération sans cas produit établi.

## API

Un 5xx isolé ne déclenche pas de mail. Trois échecs en dix minutes suffisent,
même s’ils concernent une seule personne. Les 4xx, le volume et la lenteur sont
des données de diagnostic ; ils ne prouvent pas une indisponibilité globale.
Lire les access logs et `api.request_error` dans le groupe de l’API. Le compteur
englobe ses routes : identifier la route touchée avant d’annoncer une panne
complète. Le seuil est un réglage opératoire pour la bêta, pas un SLO commercial.

## Bibliotheque

Un seul défaut d’écriture durable importante ou une purge non demandée suffit.
Les miroirs ne touchant que titre, miniature ou autres métadonnées sont exclus ;
un miroir de `processing_status` reste couvert, car il peut laisser un import
affiché en attente alors que le traitement est terminé. L’écriture et la purge
non demandée alimentent une seule alerte d’intégrité.

Lire `durable_media.write_failed` et `user_media.unexplained_purge` avec les
identités concernées dans les logs privés. Ne pas publier celles-ci. Préserver
le contenu, arrêter la cause, puis suivre les procédures de restauration de
[`durable-media.md`](../infrastructure/observability/runbooks/durable-media.md).
Une erreur de métadonnée ou une archive de job expiré n’est pas une perte de
bibliothèque. Les objets d’archive S3 ne sont pas supprimés par cette refonte.

## Suppression

La cascade doit retirer les objets sans référence conservée. Les lignes dont
`purge_at` est dépassé de plus de 48 h sont signalées par la réconciliation.
Le comptage natif TTL versus cascades terminées/purges inattendues reste une
condition de sécurité sans mail propre ; deux jours de déficit consécutifs
évitent une alerte sur une cascade passant minuit. Cette condition est un filet
technique, pas une preuve du contenu exact restant. Consulter les données et
les événements avant de rejouer une purge ; ne jamais supprimer des objets
encore référencés par une autre entrée de bibliothèque.

Un simple échec de soft delete ne possède plus son alarme : l’API doit annoncer
l’échec, l’utilisateur peut réessayer, et les 5xx répétés restent couverts.

## Capacite

Le contrôle ne change aucun prix, plafond, solde ou réservation.

- `control` exclut l’échec d’écriture d’une simple observation analytique, mais
  conserve les erreurs pouvant bloquer ou fausser la capacité, les écritures de
  règlement incohérentes, la configuration financière illisible et l’échec
  d’entretien d’un circuit.
- `stale` lit `stale_reservations` sur **chaque audit réussi**, zéro compris ;
  deux audits/fenêtres de trente minutes positifs sont nécessaires. Les métriques
  sont des instantanés `Maximum`, pas le nombre de logs d’avertissement.
- `refused` exige des refus du plafond global dans deux fenêtres de quinze
  minutes. Les refus brefs dus aux engagements en cours ne déclenchent donc pas
  seuls l’incident.
- Le refus fournisseur nécessitant une action ne retient que crédit/authentification
  ou un circuit `action_required`. Les 429 de débit, incidents transitoires et
  pauses manuelles sont exclus. Le signal reste actif jusqu’à un audit observant
  tous les circuits fermés ; une pause manuelle préexistante peut retarder sa
  clôture, sans provoquer de nouvelle alerte.

Lire la condition enfant, puis les événements et le statut :

```sh
.venv/bin/python scripts/operator_control.py --profile second-brain-app --table beta_budget-dev status
```

Réparer la configuration/les droits/la clé ou décider du budget selon la cause.
Utiliser les commandes de reprise existantes, pas une écriture directe des
compteurs. Une pause décidée par le propriétaire n’est pas un incident à lui
renvoyer. Voir [OPERATOR_SPEND_CONTROL.md](OPERATOR_SPEND_CONTROL.md).

## Depense

Le franchissement de 50 %, le coût moyen par compte, les écarts minimes entre
réservation et coût réel, l’estimation prudente après un appel échoué et les
engagements temporaires dans les réserves de perte n’ont plus d’alarme autonome.
Ils restent consultables dans les logs et le rapport de coûts existant ; les
filtres métriques sans lecteur sont retirés. Le plafond mensuel à 80 % est un
avertissement unique avec décision, pas une consigne de relever automatiquement
le plafond. Les réserves de perte et tous les garde-fous continuent de refuser
les autorisations dépassant leurs limites.

## Controles

Les seuls mails `OK` conservés concernent les deux heartbeats : un audit complet
ou une réconciliation complète réellement observé constitue une récupération.
Pour les compteurs d’événements et les files, ni une absence de données ni une
file vide ne prouve que le résultat attendu a été livré. Il n’y a donc pas de
mail de « réparation » automatique. Une composite regroupe les conditions actives
simultanées ; elle n’est pas un outil de gestion d’incidents avec acquittement,
ni une déduplication par opération sur une heure glissante.

Ne pas forcer des transitions pour vérifier la réception sans prévenir le
destinataire. Les validations de configuration sont `terraform fmt`, `validate`,
le plan enregistré et la validation des patterns par CloudWatch Logs. Aucun test
automatisé applicatif n’est ajouté ni exécuté par cette refonte.

## Retraits et lancement commercial

Sont supprimées les alarmes de p95 API et ouverture du chat, erreurs/throttling
par worker, signalement de bug, utilisation du parser de secours, archives des
anciens jobs, 50 % de dépense, coût moyen par compte et écarts de réservation.
Les fichiers d’archive, fonctions, files, protections de données et fixtures ne
sont pas retirés. Les métriques natives restent disponibles ; les métriques
personnalisées du tableau de bord optionnel gardent leur lecteur.

Le signalement utilisateur passe par le triage existant, pas ALARM/OK. La
RevenueCat Test Store et les fixtures Maestro sont préservées. La bêta ne
propose pas d’achat payant : les deux anciennes alarmes de paiement sont retirées.
**Avant toute ouverture d’un parcours d’achat réel**, réintroduire des contrôles
sur l’octroi des droits et l’application des renouvellements/annulations, puis
faire confirmer leur réception par le propriétaire. Le fait que le module n’en
déclare plus est une condition de lancement à traiter, pas une validation du
parcours commercial. Prod n’est pas activé par cette tâche.
