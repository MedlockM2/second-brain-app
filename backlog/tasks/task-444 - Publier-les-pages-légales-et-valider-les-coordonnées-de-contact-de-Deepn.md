---
id: TASK-444
title: Publier les pages légales et valider les coordonnées de contact de Deepn
status: Done
assignee:
  - owner
created_date: '2026-10-10 15:13'
updated_date: '2026-11-17 23:22'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-357
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - docs/compliance/CHECKLIST.md
priority: high
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — approuver les textes, appliquer la décision d’hébergement et publier ; agent — préparer les fichiers selon la décision validée, sans publication autonome.

## Contexte et périmètre

Les textes existent dans docs/compliance/. task-357 porte déjà le benchmark d’hébergement, task-358 le câblage mobile : ne pas les doubler. Lire la Decision autoritative du README de task-357 et prendre en compte les décisions ultérieures de marque/site. La publication légale peut utiliser l’option sans domaine si c’est la décision retenue ; ne pas la bloquer artificiellement sur l’achat du domaine API. Corriger les coordonnées placeholders et faire approuver les textes par l’owner. Vérifier aussi que les déclarations décrivent les données réellement collectées à la sortie.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.

## Décision du 2026-10-30 : publication sans domaine pour la review pré-bêta

Lire l'amendement du 2026-10-30 sous **Owner Validation** du README de task-357. Les pages sont publiées **avant la bêta**, sans attendre task-443 : S3 + CloudFront dans Terraform, servies sur le domaine par défaut de CloudFront, sans alias ni certificat personnalisé. Une seule page : la politique de confidentialité (`docs/compliance/privacy-policy.md`), dont la section de suppression de compte hors de l'app, ancrée `#delete-account`, répond à l'exigence de Google. Pas de page de conditions d'utilisation : le lien Terms de l'app pointe vers l'EULA standard d'Apple. Adresse de contact provisoire : une boîte gratuite dédiée au projet, jamais une adresse personnelle. La bascule vers `www.<domaine>` est un gate de task-454, pas de cette tâche.
**Publié le 2026-10-30** (apply ciblé des 8 ressources de `www.tf` en prod, puis `scripts/publish_legal_site.sh prod`) : politique `https://d3fc24zfw6pew8.cloudfront.net/privacy`, suppression de compte `https://d3fc24zfw6pew8.cloudfront.net/privacy#delete-account`. Vérifié sans authentification : HTTP 200, `text/html`, HSTS, CSP et `nosniff` présents, HTTP redirigé en HTTPS, accès direct au bucket refusé (403). L'owner a relu et approuvé le texte le même jour.

**Déplacé sur dev le 2026-11-01** (owner : seul l'environnement dev sert jusqu'à la production, prod reste en sommeil) : `AWS_PROFILE=second-brain-app scripts/publish_legal_site.sh dev`, politique `https://d118p1z5xvufnz.cloudfront.net/privacy`, suppression de compte `…/privacy#delete-account`, suppression de données sans compte `…/privacy#delete-data`. App, web, docs, App Store Connect (fiche bêta, notes de review) et Play Console (règles de confidentialité, sécurité des données) pointent vers cette adresse. La page a été retirée du bucket `www` de prod le même jour (la distribution répond 403) ; les ressources Terraform `www` de prod existent toujours.

**Remise en prod le 2026-11-02** (owner) : `AWS_PROFILE=prod scripts/publish_legal_site.sh prod`, HTTP 200 vérifié. Les binaires iOS 21 et Android 28 embarquent encore l'adresse de prod et ouvrent ce lien au premier lancement, avant que l'OTA ne s'applique : le relecteur de la bêta l'aurait trouvé en 403. La page de prod reste en ligne tant qu'un binaire distribué a été compilé avant le commit `3109ecf5`. On ne la retire qu'une fois ces binaires remplacés.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L’approbation des textes et la décision d’hébergement sont consignées, avec la référence au README autoritatif.
- [x] #2 Les URLs publiques finales et le compte rendu de leur consultation sans authentification depuis un réseau externe sont documentés.
- [x] #3 Les contacts publics correspondent au canal approuvé ; aucune adresse de compte cloud ni aucun credential n’apparaît dans les fichiers suivis.
- [x] #4 La checklist compliance identifie les liens transmis à task-358 et les questionnaires à reporter dans les stores.
- [x] #5 L'URL de la section de suppression de compte (`…#delete-account`) est consignée pour la Play Console.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Publication sur `www.deepn.app` le 2026-11-18.** Adresse publique unique décidée dans TASK-443 : `https://www.deepn.app`, servie par la distribution `www` de dev tant que prod dort (`www.dev.deepn.app` n'est jamais communiquée). Certificat us-east-1 propre à cette distribution (`aws_acm_certificate.www_public`, `envs/dev/web_hosting.tf`), pour ne jamais remplacer celui que partage Cognito. La zone `deepn.app` est dans le compte prod : deux enregistrements y sont faits à la main, la validation du certificat et le CNAME `www.deepn.app` → `d118p1z5xvufnz.cloudfront.net`, consignés dans `docs/PRODUCTION_RELEASE_RUNBOOK.md` (« `www.deepn.app` on the dev `www` distribution »), avec leur retrait avant le premier apply de prod. Terraform Dev (run 44197686329) a ajouté l'alias.

**Textes.** Avant publication, la politique (§2.2, §3, §6) et la page `/extension` ont été alignées sur l'extension à panneau latéral (cb947ffe, 8f972793), qui envoie la page telle que le navigateur l'affiche, pages payantes et connectées comprises ; elles affirmaient le contraire. La politique publiée intègre aussi TASK-610, 612 et 619, restés hors ligne depuis le 2026-11-03. L'owner a demandé le 2026-11-18 de publier sans relecture préalable.

**Publié** avec `scripts/publish_legal_site.sh dev` (configuration publique : `web_app_url` = `https://dev.deepn.app`, liens stores vides tant que les fiches ne sont pas ouvertes) : `https://www.deepn.app/` (accueil exigé par la vérification de marque Google, TASK-451), `https://www.deepn.app/privacy`, `#delete-account`, `#delete-data`, `https://www.deepn.app/extension`. Vérifié sans authentification depuis un réseau extérieur à AWS : HTTP 200, `text/html; charset=utf-8` (`image/svg+xml` pour l'icône), date 2026-11-18, ancres présentes, lien canonique `https://www.deepn.app/privacy`. L'adresse CloudFront dev sert la même page. Contact publié : `deepn.support@gmail.com`, canal approuvé dans TASK-443.

**Copie prod** (`https://d3fc24zfw6pew8.cloudfront.net/privacy`, gardée pour les binaires antérieurs à `3109ecf5`) : remplacée par la même version (2026-11-18, canonique `www.deepn.app`). Sa racine `/` répond 403 : la distribution prod date d'avant `default_root_object`.

**Reste hors de cette tâche** : basculer `legal.ts`, App Store Connect et la Play Console sur `www.deepn.app` (gate TASK-454) ; vérification de marque Google (TASK-451) ; fiches des extensions (TASK-592, Firefox), puis republier `/extension` avec les liens des stores dans la configuration publique.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Pages publiques publiées sur `https://www.deepn.app` (accueil, `/privacy` avec `#delete-account` et `#delete-data`, `/extension`), servies par la distribution `www` de dev avec un certificat dédié et deux enregistrements manuels dans la zone prod documentés dans le runbook. Politique et page `/extension` alignées sur l'extension qui envoie la page affichée ; copie prod rafraîchie. Bascule des consoles et de l'app laissée au gate TASK-454.
<!-- SECTION:FINAL_SUMMARY:END -->
