# Chrome Web Store — Deepn extension 1.0.0 (copier-coller)

Zip à téléverser : `extension/.output/delivery/distribution/d2b6ce38af49/deepn-extension-1.0.0-chrome.zip`
SHA-256 : `2398485bd46a0601eb8c27ecd2d20f8f02608bfa2743eba200fd3330067c1868`
(API `https://api.dev.deepn.app`, web `https://dev.deepn.app`). Le même zip sert pour Edge.

## Fiche

- **Nom** : Deepn
- **Résumé (132 car. max)** : Save the page you are reading, a link or a selection to Deepn, then read its summary and chat with it.
- **Catégorie** : Productivity
- **Langue par défaut** : English
- **Description détaillée (EN)** :

  Deepn keeps what you read and gives it back as something you can use.

  • One click (or Alt+S) saves the page you are on to your Deepn library and opens a side panel.
  • Right-click to save a text selection as a note, or a link without opening it.
  • In the panel: the key points, the full text, and a chat to ask questions about the page.
  • The Notebook tab turns a page into a summary, flashcards or a quiz in one click.
  • Works on pages behind a login or paywall: the extension reads the page you are looking at, only when you click.

  You need a Deepn account. The extension reads a page only when you act (icon, Alt+S or context menu) and never runs in the background on your tabs.

- **URL de confidentialité** : https://www.deepn.app/privacy
- **Site web** : https://www.deepn.app
- **Icône** : `extension/public/icon/128.png`

## Onglet Privacy

- **Objet unique** : Save a page, a link or a selection to the user's Deepn library, and show its summary and a chat in the side panel.
- **Justification des permissions**
  - `activeTab` : access the tab the user just acted on (icon, Alt+S, context menu), and only that tab.
  - `scripting` : on that click, read the page to save (cleaned HTML) or the selected text with its line breaks. Never before, never another tab.
  - `contextMenus` : offer "Save selection" and "Save link" on right-click.
  - `sidePanel` : show the preview, summary and chat of the saved page.
  - `storage` : keep the extension's own session, the chosen folder, and the page shown in the panel.
  - Hôte `https://api.dev.deepn.app/*` : send saves, read summary and chat, manage the session with Deepn. No other host.
- **Code distant** : No, all JavaScript is in the package.
- **Données collectées** : Authentication information (pairing code, session tokens); Personally identifiable information (email, only for the fallback pairing code); Web history (address of the saved page, on explicit action); Website content (cleaned page HTML and selected text, on explicit action).
- **Certifications** : données non vendues, non utilisées hors de la fonction unique, non utilisées pour de la solvabilité.

## Captures (1280×800 ou 640×400, au moins 1)

À faire : panneau ouvert sur une page (Lecture), onglet Cahier. Maquettes : `mobile-design-mockups/extension_panneau_lateral/`.

## Après publication

1. Noter l'ID attribué par le store dans `VITE_EXTENSION_IDS` de l'app web, redéployer le web.
2. Recette de l'extension distribuée : task-599.
