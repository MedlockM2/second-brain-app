---
id: TASK-443
title: Choisir et acquérir le domaine de Deepn et ses contacts publics
status: Done
assignee:
  - owner
created_date: '2026-10-10 15:13'
updated_date: '2026-11-09 12:49'
labels:
  - v1-launch
  - release
  - owner-only
dependencies: []
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - docs/BRAND_IDENTITY.md
priority: high
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — choisir et acheter le domaine, conserver la preuve de propriété hors dépôt et définir les contacts support/confidentialité.

## Contexte et périmètre

Le choix Deepn ne prouve aucun achat. Cette tâche couvre la propriété du domaine destiné à l’API et aux surfaces publiques, ainsi que le canal de contact réellement opérationnel. Le choix d’hébergement légal relève déjà de task-357 ; ne pas imposer un hébergeur ni créer un benchmark concurrent. Une résolution DNS ne constitue jamais une preuve de propriété. Le site et Stripe restent dans task-424/425.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.

Vérification de marque Google : elle commence dès l’achat, par la preuve de propriété du domaine dans Google Search Console. Les démarches complètes sont dans TASK-451, qui dépend de cette tâche. TASK-528 place Cognito sur `auth.<domaine>` et dépend aussi de cette tâche.

## Décision propriétaire — 2026-11-09 : `deepn.app`, enregistré sur le compte prod, `dev.deepn.app` délégué au compte dev

- **Domaine retenu : `deepn.app`.** Disponible sur Route 53 au 2026-11-09 ; 20 USD à l’achat et 20 USD par an au renouvellement. Le TLD `.app` impose HTTPS dans les navigateurs (HSTS préchargé) : toute surface publique doit être servie en HTTPS.
- **Enregistrement et zone apex sur le compte AWS prod** (profil `prod`), renouvellement automatique et protection de la confidentialité des contacts activés. La propriété du domaine vit là où vivra le produit. Enregistrer le domaine et sa zone ne réveille pas prod et ne décide pas de son ouverture (TASK-446, TASK-441).
- **Délégation de `dev.deepn.app` au compte dev** (profil `second-brain-app`) : une zone hébergée `dev.deepn.app` créée dans le compte dev, et un enregistrement `NS` `dev.deepn.app` dans la zone `deepn.app` du compte prod qui pointe vers ses quatre serveurs de noms. Dev gère ensuite seul ses enregistrements et ses certificats ACM ; aucune autre opération sur le compte prod n’est nécessaire pour dev.
- **Noms par environnement.** Chaque environnement reçoit son domaine de base et la zone de son propre compte, comme le prévoient déjà `web_public_domain` / `web_public_zone_id` dans `infrastructure/terraform/envs/*/web_hosting.tf` :

| | dev (bêta) | prod |
|---|---|---|
| Domaine de base / zone | `dev.deepn.app`, compte dev | `deepn.app`, compte prod |
| API | `api.dev.deepn.app` | `api.deepn.app` |
| Cognito | `auth.dev.deepn.app` | `auth.deepn.app` |
| Web app | `dev.deepn.app` | `deepn.app` |
| Site et pages légales | voir ci-dessous | `www.deepn.app` |

**Décision owner du 2026-11-09 — web app sur le domaine nu.** La web app est servie sur `deepn.app` (prod) et `dev.deepn.app` (dev), et non plus sur `app.<domaine>`. Cette décision remplace le point 9 de la validation de task-424 du 2026-10-11. `www.` garde les pages statiques (pages légales, `.well-known`), pour que l'URL de confidentialité donnée aux stores ne dépende ni de la web app ni de prod. `app.<domaine>` n'a plus d'enregistrement DNS.

**Pages légales :** une seule adresse publique, `https://www.deepn.app/privacy` (et `#delete-account`). Selon l'amendement du 2026-10-30 du README de task-357, elle est servie par la distribution `www` de **dev**, qui publie déjà la page, tant que prod dort. On ajoute donc l'alias `www.deepn.app` sur cette distribution : enregistrement dans la zone prod, certificat ACM us-east-1 du compte dev validé par un CNAME dans la zone prod. Cette bascule reste la gate de TASK-454. `www.dev.deepn.app` n'est jamais communiqué publiquement.

Les contacts du titulaire et la preuve d’achat restent hors dépôt. Les identifiants de zone ne sont pas des secrets (`AGENTS.md`, « Resource identifiers that Terraform needs ») : ils figurent dans `envs/*/web_hosting.tf`, que la CI dev applique sans variable externe. La commande d’achat est une opération propriétaire : aucun agent n’enregistre le domaine.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le domaine effectivement acquis et la répartition API/site/légal/support sont consignés ; la preuve d’achat reste hors dépôt.
- [x] #2 Le canal support et le canal confidentialité sont définis et leur fonctionnement est consigné sans publier d’identité de connexion de compte.
- [x] #3 Les entrées des consoles et documents à remplacer sont recensées ; aucun domaine tiers n’est présenté comme appartenant au projet.
- [x] #4 `deepn.app` est enregistré sur le compte prod avec sa zone apex ; la zone `dev.deepn.app` existe sur le compte dev et sa délégation `NS` depuis la zone prod est consignée, avec `dig NS dev.deepn.app` qui renvoie les serveurs de la zone dev.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**2026-11-09 — achat et délégation (owner, script hors dépôt).**
- `deepn.app` enregistré sur Route 53, compte prod : statut `ACTIVE`, expiration 2027-11-09, renouvellement automatique et masquage des contacts activés. Email du titulaire vérifié (ICANN) le jour même. Titulaire de type personne ; un transfert vers une société éventuelle est gratuit sur Route 53.
- Zone apex `deepn.app` créée par Route 53 sur le compte prod. Zone `dev.deepn.app` créée sur le compte dev. Enregistrement `NS dev.deepn.app` (TTL 172800) ajouté dans la zone prod.
- Vérification : un serveur de la zone `deepn.app` interrogé sans récursion renvoie pour `dev.deepn.app` les quatre serveurs de la zone dev, et `dig SOA dev.deepn.app` répond depuis la zone dev.
- Identifiants des deux zones : valeurs par défaut de `public_zone_id` dans `infrastructure/terraform/envs/dev/web_hosting.tf` et `envs/prod/web_hosting.tf` (TASK-445).

**#1 — Répartition.** Domaine acquis : `deepn.app`. API, Cognito et web app : tableau de la description, un domaine de base par environnement. Site et pages légales : `www.deepn.app`, servi par la distribution `www` de dev jusqu'au réveil de prod (description, TASK-454). Support : canal email ci-dessous ; feedback bêta sur Canny (`docs/community/feedback-channels.md`), dont un éventuel `feedback.deepn.app` (CNAME, offre payante) n'est pas décidé. Preuve d'achat : compte prod Route 53 et email de confirmation AWS, hors dépôt.

**#2 — Canaux support et confidentialité (owner, 2026-11-09).** Une seule boîte, `deepn.support@gmail.com`, dédiée au projet et non personnelle. Elle sert au support, aux demandes RGPD, à la suppression de compte hors de l'app et aux retours des testeurs. Elle est déjà déclarée dans la politique de confidentialité, `mobile/src/constants/legal.ts`, les déclarations Apple et Google Play et les fiches stores. Elle est consultée par l'owner, sans identifiant de connexion consigné. C'est l'adresse **provisoire** prévue par l'amendement du 2026-10-30 de task-357 ; la décision validée exige une adresse sur le domaine avant la production, remplacement déjà suivi par TASK-454 (AC #4). Aucune adresse `@deepn.app` n'est créée pour la bêta.

**#3 — Recensement des entrées à remplacer, par tâche responsable.**

*Consoles et services externes*
- Route 53 : zones `deepn.app` (prod) et `dev.deepn.app` (dev), délégation faite. Certificats ACM et enregistrements `api.`/`auth.`/`app.` : Terraform, TASK-445/TASK-528, appliqué par TASK-591.
- Google Cloud : URI de retour du client OAuth web vers `https://auth.dev.deepn.app/oauth2/idpresponse` (TASK-528, note owner) ; domaines autorisés, branding et preuve de propriété dans Search Console (TASK-451).
- Apple Developer : URL de retour et domaine du Services ID Sign in with Apple (web et Android) vers `auth.dev.deepn.app` (TASK-528, note owner).
- Cognito : URL de callback et de déconnexion web vers `dev.deepn.app` (Terraform, TASK-528/TASK-591).
- EAS : profils et variables d'environnement de l'API (TASK-445).
- GitHub Actions : URL de la web app dans `deploy-web.yml` et URL de l'API dans `mobile-e2e-maestro.yml` (TASK-445/TASK-591).
- App Store Connect : Privacy Policy URL, Support URL, adresse de contact et formulaire commerçant DSA ; Play Console : politique de confidentialité, URL de suppression de compte, contact (gate TASK-454).
- Chrome Web Store, Edge Add-ons et AMO : URL de confidentialité et de page d'accueil des fiches (TASK-592/TASK-593).
- Canny : domaine personnalisé facultatif, non décidé (hors bêta).

*Documents et fichiers suivis*
- API dev technique `jji077bi8e.execute-api…` et streaming chat `evh853pvbl.execute-api…` : `mobile/eas.json`, `mobile/.maestro/config.yaml`, `.github/workflows/mobile-e2e-maestro.yml`, `tests/e2e/conftest.py`, `tests/e2e/README.md`, `scripts/create_review_account.py`, `web/.env.beta`, `mobile/MOBILE_CI_CD.md`, `docs/V1_LAUNCH_PLAN.md` (TASK-445).
- Web app dev `d3n3qjz3si2rme.cloudfront.net` : `infrastructure/terraform/envs/dev/web_hosting.tf` (`web_app_origin`), `web/.env.beta`, `web/README.md`, `.github/workflows/deploy-web.yml` (TASK-591 ; `docs/validation/task-605-web-cloudfront/README.md` reste un compte rendu daté).
- Domaine Cognito préfixe : `docs/AUTHENTICATION_SETUP.md` (TASK-528).
- Pages légales `d118p1z5xvufnz.cloudfront.net/privacy` : `packages/core/src/constants/legal.ts`, `docs/compliance/CHECKLIST.md`, `apple-app-privacy.md`, `google-play-data-safety.md`, `docs/store-listing/app-store-connect.md`, `google-play-store.md`, `pre-beta-review.md` (gate TASK-454). `pre-beta-review.md` cite aussi une ancienne distribution `d3fc24zfw6pew8.cloudfront.net`.

*Domaines tiers présentés comme ceux du projet* — le projet ne possède ni `mediasummarizer.com` ni `secondbrainlabs.com` :
- `mobile/eas.json`, profil `production` : `https://api.mediasummarizer.com` → `https://api.deepn.app` (TASK-445, AC #2).
- `docs/compliance/terms-of-service.md` : `legal@mediasummarizer.com`. Page non publiée (aucune page de conditions pour la bêta selon task-357) ; à corriger avant toute publication des conditions.
- `docs/V1_LAUNCH_PLAN.md` et `mobile/MOBILE_CI_CD.md` : mentions de `mediasummarizer.com` et `secondbrainlabs.com` comme domaines envisagés, à remplacer par `deepn.app` (TASK-445, AC #3). `mobile/app.config.ts` et `mobile/src/constants/config.ts` disent déjà que ce domaine n'appartient pas au projet.
- `com.mediasummarizer.app` (identifiant de paquet) n'est pas un domaine : il n'est pas concerné.
<!-- SECTION:NOTES:END -->
