# Edge Add-ons — Deepn extension 1.0.0

Soumis le 2026-11-19, statut **In review** (Microsoft annonce jusqu'à 7 jours ouvrés).
Pas encore disponible : le lien public ne répond qu'après la publication.

| Élément | Valeur |
|---|---|
| Paquet | `deepn-extension-1.0.0-chrome.zip`, le même que Chrome (SHA-256 `2398485b…1c1868`, API `https://api.dev.deepn.app`) |
| Compte Partner Center | type **Individual**, pays France ; éditeur affiché `Second Brain Labs` |
| Visibilité | **Hidden** (équivalent du « non répertorié » Chrome), 241 marchés |
| Catégorie | Productivity ; site `https://www.deepn.app` ; support `deepn.support@gmail.com` |
| Confidentialité | mêmes déclarations que `chrome-web-store.md` ; politique `https://www.deepn.app/privacy` |
| Fiches | 11 langues, descriptions de `chrome-web-store-descriptions.md`, logo 300×300 tiré de `web/public/favicon.svg`, 2 captures de la fiche Chrome |
| Product ID | `cf86fb2d-eef7-4b39-bedd-17ddd853af51` |
| Store ID | `0RDCKG5KNMWP` |
| CRX ID | `obdhelcijkcpcdhmejdkgfkilmcafpkf` |
| Lien à envoyer (après publication) | `https://microsoftedge.microsoft.com/addons/detail/obdhelcijkcpcdhmejdkgfkilmcafpkf` |

Compte de démo des testeurs : clé `edge` du secret dev `deepn-review-accounts`
(`scripts/create_review_account.py edge …`). Les notes de certification guident l'appairage
par code (Mon compte › Browser extension › « Show a code »), qui marche même si l'app web
ne connaît pas encore l'ID Edge.

L'appairage en un clic sur Edge exige l'ID ci-dessus dans `VITE_EXTENSION_IDS`
(`web/.env.beta`), déployé avec le web au prochain push sur `main`.
