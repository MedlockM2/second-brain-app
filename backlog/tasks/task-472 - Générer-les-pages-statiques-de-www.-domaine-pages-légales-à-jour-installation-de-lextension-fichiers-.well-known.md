---
id: TASK-472
title: >-
  Générer les pages statiques de www.<domaine> : pages légales à jour,
  installation de l'extension, fichiers .well-known
status: Done
assignee:
  - '@codex'
created_date: '2026-10-11 15:54'
updated_date: '2026-11-05 09:11'
labels:
  - web
  - compliance
  - feature
  - agent
dependencies:
  - TASK-471
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - docs/compliance/privacy-policy.md
  - docs/compliance/terms-of-service.md
  - docs/BRAND_IDENTITY.md
  - scripts/build_legal_site.py
priority: medium
type: feature
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — compléter les fichiers et la génération du site public dans son worktree. L’approbation des textes et la publication restent dans TASK-444, les ressources dans TASK-471, les soumissions d’extension dans leurs tâches propriétaire.

Lire Owner Validation de TASK-424 et TASK-357, y compris l’amendement propriétaire du 2026-10-30, qui prime sur les descriptions historiques : une politique de confidentialité publique et ses sections de suppression, Terms vers l’EULA standard Apple pendant la bêta, sans créer une page /terms pour cette phase. Le générateur Python scripts/build_legal_site.py et la publication scripts/publish_legal_site.sh existent déjà ; les compléter plutôt qu’imposer un second générateur Node.

Livrer la page d’accueil descriptive de Deepn avec renvoi à la confidentialité (requise par le dossier de marque Google TASK-451), la page /extension avec liens et modalités d’installation Chrome/Edge/Firefox selon disponibilité, et la génération des fichiers .well-known uniquement requis par le raccordement Apple effectivement retenu. Le contenu propre au compte Apple reste fourni hors dépôt et sa nécessité est relue contre l’authentification Cognito courante, pas l’ancien callback supprimé.

Actualiser les textes à partir des données réellement traitées, de la marque et des fournisseurs courants, en conservant les amendements propriétaire. Les valeurs de domaine/contact/distribution non disponibles restent des paramètres documentés ; elles ne bloquent pas la préparation du code et ne deviennent pas des valeurs fictives présentées comme publiques. Aucun achat, publication ou réécriture juridique non approuvée demandé à l’agent.

Notes au propriétaire hors AC : relire et publier via TASK-444, renseigner les liens réellement ouverts après soumissions des extensions. Le domaine et la zone sont fournis par TASK-443 au moment de la mise en service ; rien n’impose de réveiller prod.

Aucun nouveau test automatisé, secret, email de connexion de compte cloud ni donnée de testeur dans les fichiers suivis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le générateur existant produit une page d’accueil descriptive liée à /privacy et une page /extension décrivant les navigateurs disponibles et leurs modes d’installation/appairage sans lien fictif présenté comme publié.
- [x] #2 La politique de confidentialité et ses ancres de suppression sont conservées et à jour ; la décision bêta Terms vers l’EULA Apple est respectée sans création de page /terms contradictoire.
- [x] #3 Les fichiers .well-known nécessaires à la configuration Apple réellement retenue sont produits depuis un apport hors dépôt, ou leur absence est justifiée par la documentation du raccordement ; aucun contenu privé de compte n’est commité.
- [x] #4 Les textes reflètent Deepn et les sous-traitants effectivement appelés ; les contacts/domaines encore à fournir sont documentés comme paramètres, sans identité de compte ni fausse adresse officielle.
- [x] #5 La commande de génération passe localement, sa configuration est documentée et les responsabilités de TASK-444/471 et des publications d’extension sont explicites.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Étendre le générateur Python existant avec accueil/index.html et /extension, une navigation commune et des paramètres publics optionnels de liens/contact ; laisser les stores absents sans lien fictif et conserver /privacy/ancres, sans /terms.
2. Mettre à jour uniquement les faits techniques de la politique (web/extension, sessions et capacité bêta), préserver les clauses/amendements propriétaire et consigner la revue des sous-traitants existants.
3. Documenter l’absence de fichier .well-known pour Sign in with Apple via Cognito, confirmée par Apple/AWS ; ne générer ni copier aucun contenu privé inutile.
4. Adapter la publication existante aux routes/types MIME générés et la racine www à index.html ; documenter les responsabilités propriétaire et vérifier génération, Ruff, syntaxe shell et Terraform validate sans publication ni test ajouté.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Génération locale réussie avec markdown 3.7 : index.html, privacy, extension et favicon, plus manifeste MIME. Inspection HTML : liens relatifs vers privacy, une occurrence de chaque ancre delete-account/delete-data, aucun fichier terms ni .well-known ; sans configuration, aucun lien store inventé. Les Terms proviennent de la constante Apple partagée. Le navigateur d’inspection n’était pas disponible : aucune recette visuelle/déployée n’est revendiquée.

Ruff du générateur et des scripts extension, syntaxe bash du publisher, terraform fmt et validate platform/dev/prod réussis. Le build web ci final et son manifeste passent aussi. Aucun apply, téléversement, invalidation ni test automatisé ajouté.

Les faits techniques de confidentialité couvrent web/extension, sessions et réservations de capacité. Destinataires existants revus dans le code ; garanties contractuelles, clauses, contact dédié et amendements propriétaire conservés. Les textes/dates restent à approuver dans TASK-444 avant publication. PUBLIC_SITE.md documente les valeurs publiques facultatives et les responsabilités.

Apple indique explicitement qu’aucun fichier serveur n’est requis pour enregistrer les domaines Sign in with Apple ; AWS et le raccordement courant utilisent Cognito et /oauth2/idpresponse. L’absence de fichier Apple est justifiée avec les sources officielles consultées le 2026-11-05 ; aucun contenu privé de compte n’est produit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Complète le générateur public existant avec l’accueil Deepn, la page d’extension selon les liens réellement disponibles et une navigation commune. Conserve confidentialité/ancres et l’EULA Apple sans page Terms contradictoire, précise les faits web/extension et adapte publication/MIME/racine www. Génération et vérifications statiques réussies ; approbation et publication restent propriétaire.
<!-- SECTION:FINAL_SUMMARY:END -->
