// Builds the authentication mockups: comparatif/ and one directory per direction.
// Usage (from the repository root): node mobile-design-mockups/auth_directions/_build/build.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EMAIL, COVERS, ic, gLogo, phone, desk, brand, apple, google, mailBtn, primary, btn, divider, legal,
  field, checks, otp, note, chipMail, back, keyboard, cover, page, textTable,
} from "./kit.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..");
const write = (dir, html) => { mkdirSync(join(OUT, dir), { recursive: true }); writeFileSync(join(OUT, dir, "code.html"), html); };

const forgot = `<a class="lnk plain" style="font-size:14px">Oublié ?</a>`;
const qtCode = [`<small>Depuis Mail</small><b>482 913</b>`];
const qtMail = [`<b>${EMAIL}</b>`];
const qtPass = [`${ic("key-outline", 15)} <b>Mot de passe</b><small>Deepn · ${EMAIL}</small>`];
const RULES_NOW = [["12 caractères", true], ["Une majuscule", true], ["Une minuscule", true], ["Un chiffre", false]];
const resend = (t = "0:42") => `<p class="small" style="margin:0">Pas reçu ? Vérifiez les courriers indésirables, ou <span style="color:var(--text-muted)">renvoyez le code dans ${t}</span>.</p>`;

// =====================================================================================
// A — Épurée : le parcours d'aujourd'hui, resserré
// =====================================================================================
const A = {};
A.login = (dark = false) => `<div class="scr"><div style="height:26px"></div>${brand()}<div style="height:54px"></div>
  <h1 class="h1">Se connecter</h1><p class="sub">Retrouvez votre bibliothèque et vos fiches.</p>
  <div class="stack g12" style="margin-top:28px">${apple()}${google()}</div>
  <div style="margin:22px 0 18px">${divider("ou avec votre e-mail")}</div>
  <div class="stack g16">${field({ label: "Adresse e-mail", value: EMAIL })}${field({ label: "Mot de passe", value: "a".repeat(14), pw: true, right: forgot })}
  <div style="margin-top:6px">${primary("Se connecter")}</div></div>
  <div class="sp"></div><p class="foot">Pas encore de compte ? <a class="lnk">Créer un compte</a></p></div>`;
A.register = `<div class="scr"><div style="height:26px"></div>${brand()}<div style="height:40px"></div>
  <h1 class="h1">Créer votre compte</h1><p class="sub">Enregistrez ce qui compte. Deepn vous aide à l’approfondir.</p>
  <div class="stack g12" style="margin-top:24px">${apple()}${google()}</div>
  <div style="margin:20px 0 16px">${divider("ou avec votre e-mail")}</div>
  <div class="stack g16">${field({ label: "Adresse e-mail", value: EMAIL })}
  <div class="stack g12">${field({ label: "Mot de passe", value: "Lecture2a".padEnd(13, "x"), pw: true, focus: true })}${checks(RULES_NOW)}</div>
  ${primary("Créer mon compte", { off: true })}</div>
  <div class="sp"></div><div class="stack g12">${legal("En créant un compte")}<p class="foot">Déjà un compte ? <a class="lnk">Se connecter</a></p></div></div>`;
A.loginError = `<div class="scr"><div style="height:26px"></div>${brand()}<div style="height:54px"></div>
  <h1 class="h1">Se connecter</h1><p class="sub">Retrouvez votre bibliothèque et vos fiches.</p>
  <div class="stack g12" style="margin-top:28px">${apple()}${google()}</div>
  <div style="margin:22px 0 18px">${divider("ou avec votre e-mail")}</div>
  <div class="stack g16">${field({ label: "Adresse e-mail", value: EMAIL })}
  ${field({ label: "Mot de passe", value: "a".repeat(11), pw: true, err: `Mot de passe incorrect. Réessayez, ou <a class="lnk">réinitialisez-le</a>.`, right: forgot })}
  <div style="margin-top:6px">${primary("Se connecter")}</div></div>
  <div class="sp"></div><p class="foot">Pas encore de compte ? <a class="lnk">Créer un compte</a></p></div>`;
A.exists = `<div class="scr"><div style="height:26px"></div>${brand()}<div style="height:40px"></div>
  <h1 class="h1">Créer votre compte</h1><p class="sub">Enregistrez ce qui compte. Deepn vous aide à l’approfondir.</p>
  <div class="stack g12" style="margin-top:24px">${apple()}${google()}</div>
  <div style="margin:20px 0 16px">${divider("ou avec votre e-mail")}</div>
  <div class="stack g12">${field({ label: "Adresse e-mail", value: EMAIL })}
  ${note("info", "person-circle-outline", "Vous avez déjà un compte", `Cette adresse est déjà inscrite sur Deepn.`,
    `<span class="btn primary sm">Se connecter</span><span class="btn tonal sm">Mot de passe oublié</span>`)}</div>
  <div class="sp"></div><p class="foot">Déjà un compte ? <a class="lnk">Se connecter</a></p></div>`;
A.code = `<div class="scr">${back()}<div style="height:10px"></div>
  <div class="halo" style="width:56px;height:56px">${ic("mail-open-outline", 26)}</div><div style="height:18px"></div>
  <h1 class="h1" style="font-size:28px">Vérifiez votre boîte mail</h1>
  <p class="sub">Code à 6 chiffres envoyé à<br><b style="color:var(--text-main)">${EMAIL}</b> · <a class="lnk">Modifier</a></p>
  <div style="height:24px"></div>${otp("4829")}<div style="height:18px"></div>${resend()}</div>
  ${keyboard({ mode: "num", qt: qtCode })}`;
A.reset = `<div class="scr">${back()}<div style="height:12px"></div>
  <h1 class="h1" style="font-size:28px">Nouveau mot de passe</h1>
  <p class="sub">Saisissez le code envoyé à <b style="color:var(--text-main)">${EMAIL}</b>, puis choisissez un nouveau mot de passe.</p>
  <div style="height:24px"></div><div class="stack g20"><div class="fld"><div class="lbl">Code reçu</div>${otp("482913", { split: true })}</div>
  <div class="stack g12">${field({ label: "Nouveau mot de passe", value: "Lecture2aaaaaa", pw: true, show: true })}${checks(RULES_NOW.map(([t]) => [t, true]))}</div>
  ${primary("Enregistrer et me connecter")}<p class="small ctr" style="margin:0">Pas reçu ? <a class="lnk">Renvoyer le code</a></p></div></div>`;

// Web A — the centred card of today, tightened.
const wA = (inner, below = "") => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:24px">
  <div style="width:420px;background:var(--surface);border-radius:20px;box-shadow:var(--shadow-soft), 0 0 0 1px rgba(43,45,66,.04);padding:32px 36px 30px">${inner}</div>${below}</div>`;
A.webLogin = wA(`${brand()}<div style="height:28px"></div><h1 class="h1" style="font-size:28px">Se connecter</h1><p class="sub" style="font-size:15px">Retrouvez votre bibliothèque et vos fiches.</p>
  <div class="stack g12" style="margin-top:24px">${apple()}${google()}</div><div style="margin:18px 0 14px">${divider("ou avec votre e-mail")}</div>
  <div class="stack g16">${field({ label: "Adresse e-mail", value: EMAIL })}${field({ label: "Mot de passe", value: "a".repeat(14), pw: true, right: forgot, focus: true })}${primary("Se connecter")}</div>`,
  `<p class="foot">Pas encore de compte ? <a class="lnk">Créer un compte</a></p>`);
A.webRegister = wA(`${brand()}<div style="height:24px"></div><h1 class="h1" style="font-size:28px">Créer votre compte</h1><p class="sub" style="font-size:15px">Enregistrez ce qui compte. Deepn vous aide à l’approfondir.</p>
  <div class="stack g12" style="margin-top:20px">${apple()}${google()}</div><div style="margin:16px 0 12px">${divider("ou avec votre e-mail")}</div>
  <div class="stack g12">${field({ label: "Adresse e-mail", value: EMAIL })}${note("info", "person-circle-outline", "Vous avez déjà un compte", "Cette adresse est déjà inscrite sur Deepn.", `<span class="btn primary sm">Se connecter</span><span class="btn tonal sm">Mot de passe oublié</span>`)}</div>`,
  `<p class="foot">Déjà un compte ? <a class="lnk">Se connecter</a></p>`);
A.webCode = wA(`<div class="halo" style="width:56px;height:56px">${ic("mail-open-outline", 26)}</div><div style="height:18px"></div>
  <h1 class="h1" style="font-size:28px">Vérifiez votre boîte mail</h1><p class="sub" style="font-size:15px">Code à 6 chiffres envoyé à <b style="color:var(--text-main)">${EMAIL}</b> · <a class="lnk">Modifier</a></p>
  <div style="height:24px"></div>${otp("4829")}<div style="height:16px"></div>${resend()}<div style="height:20px"></div>${primary("Valider", { off: true })}`,
  `<p class="foot"><a class="lnk">Retour à la connexion</a></p>`);

// =====================================================================================
// B — Une seule porte : e-mail d'abord, Deepn choisit la suite
// =====================================================================================
const B = {};
B.welcome = `<div class="scr" style="padding-top:0"><div class="sp" style="max-height:150px"></div>
  <div class="stack ctr" style="align-items:center">${brand("xl")}<div style="height:22px"></div><div class="h1" style="font-size:36px">Deepn</div>
  <p class="sub" style="font-size:17px;max-width:280px">Gardez ce qui compte.<br>Allez au fond.</p></div>
  <div class="sp"></div><div class="stack g12">${apple()}${google()}${mailBtn()}</div><div style="height:18px"></div>${legal()}</div>`;
B.email = `<div class="scr">${back()}<div style="height:10px"></div>
  <h1 class="h2" style="font-size:28px">Quelle est votre adresse e‑mail ?</h1><p class="sub">Si vous avez déjà un compte Deepn, nous le retrouverons.</p>
  <div style="height:22px"></div>${field({ value: "camille.martin@gm", caret: true, focus: true })}<div style="height:16px"></div>${primary("Continuer")}</div>
  ${keyboard({ qt: qtMail })}`;
B.known = `<div class="scr">${back()}<div style="height:10px"></div>
  <h1 class="h1">Bon retour</h1><div style="height:18px"></div>${chipMail()}<div style="height:16px"></div>
  ${field({ label: "Mot de passe", value: "", ph: "", caret: true, pw: true, focus: true, right: forgot })}<div style="height:16px"></div>${primary("Se connecter")}</div>
  ${keyboard({ mode: "text", qt: qtPass, ret: "OK" })}`;
B.create = `<div class="scr">${back()}<div style="height:10px"></div>
  <h1 class="h1">Créez votre compte</h1><p class="sub">Aucun compte Deepn n’utilise encore cette adresse.</p><div style="height:18px"></div>${chipMail()}<div style="height:18px"></div>
  <div class="stack g12">${field({ label: "Choisissez un mot de passe", value: "lumières du soi", pw: true, show: true, focus: true })}
  <div class="meter"><i style="width:${(15 / 15) * 100}%"></i></div>${checks([["15 caractères au moins", true]], true)}
  <p class="small" style="margin:0">Astuce : quelques mots qui n’ont rien à voir font un excellent mot de passe.</p></div>
  <div style="height:22px"></div>${primary("Créer mon compte")}<div class="sp"></div>${legal("En créant un compte")}</div>`;
B.googleOnly = `<div class="scr">${back()}<div style="height:18px"></div>
  <div class="halo" style="background:var(--surface);box-shadow:inset 0 0 0 1px var(--outline-variant)">${gLogo(30)}</div><div style="height:20px"></div>
  <h1 class="h1" style="font-size:28px">Cette adresse utilise Google</h1><p class="sub">Vous avez créé votre compte Deepn avec Google. Continuez avec lui pour retrouver votre bibliothèque.</p>
  <div style="height:20px"></div>${chipMail()}<div style="height:20px"></div>${google()}<div style="height:8px"></div>${btn("Utiliser une autre adresse", "ghost")}</div>`;
B.link = `<div class="scr">${back()}<div style="height:18px"></div>
  <div class="halo">${ic("logo-apple", 30)}</div><div style="height:20px"></div>
  <h1 class="h1" style="font-size:28px">Vous avez déjà un compte</h1>
  <p class="sub">L’adresse de votre identifiant Apple a déjà un compte Deepn, protégé par un mot de passe.</p><div style="height:18px"></div>${chipMail()}
  <div style="height:16px"></div>${note("amber", "", "", `Saisissez ce mot de passe une seule fois : Apple sera ajouté à votre compte, et la prochaine connexion se fera d’un geste.`)}
  <div style="height:16px"></div>${field({ label: "Mot de passe", value: "a".repeat(14), pw: true, right: forgot })}<div style="height:16px"></div>${primary("Se connecter et ajouter Apple")}</div>`;

const wB = (inner, step = "") => `<div style="height:72px;display:flex;align-items:center;padding:0 40px;justify-content:space-between">${brand()}<span class="small">${step}</span></div>
  <div style="flex:1;display:flex;justify-content:center;padding-top:56px"><div style="width:380px">${inner}</div></div>
  <div class="small ctr" style="padding:0 0 18px">Conditions d’utilisation · Confidentialité · Aide</div>`;
B.webStart = wB(`<h1 class="h1" style="font-size:30px">Bienvenue sur Deepn</h1><p class="sub" style="font-size:15px">Connectez-vous ou créez votre compte : c’est le même chemin.</p>
  <div class="stack g12" style="margin-top:28px">${apple()}${google()}</div><div style="margin:20px 0 16px">${divider("ou")}</div>
  <div class="stack g12">${field({ label: "Adresse e-mail", value: "camille.martin@gm", caret: true, focus: true })}${primary("Continuer", { icon: "arrow-forward" })}</div>
  <div style="height:20px"></div>${legal()}`);
B.webKnown = wB(`<h1 class="h1" style="font-size:30px">Bon retour</h1><div style="height:20px"></div>${chipMail()}<div style="height:16px"></div>
  ${field({ label: "Mot de passe", value: "a".repeat(12), pw: true, focus: true, right: forgot })}<div style="height:16px"></div>${primary("Se connecter")}`);
B.webGoogle = wB(`<div class="halo" style="background:var(--surface);box-shadow:inset 0 0 0 1px var(--outline-variant)">${gLogo(30)}</div><div style="height:20px"></div>
  <h1 class="h1" style="font-size:28px">Cette adresse utilise Google</h1><p class="sub" style="font-size:15px">Vous avez créé votre compte Deepn avec Google. Continuez avec lui pour retrouver votre bibliothèque.</p>
  <div style="height:20px"></div>${chipMail()}<div style="height:16px"></div>${google()}<div style="height:6px"></div>${btn("Utiliser une autre adresse", "ghost")}`);

// =====================================================================================
// C — Vitrine : la valeur avant le formulaire
// =====================================================================================
const C = {};
const showcase = (h = 470) => `<div style="position:absolute;left:0;right:0;top:0;height:${h}px;background:var(--surface-container-low);border-radius:0 0 36px 36px;overflow:hidden">
  ${cover(COVERS[0], "position:absolute;left:26px;top:96px;width:210px;transform:rotate(-5deg)")}
  ${cover(COVERS[2], "position:absolute;left:178px;top:150px;width:206px;transform:rotate(4deg)")}
  <div class="callout" style="position:absolute;left:34px;right:34px;top:${h - 150}px">
  <span class="q">« Pendant le sommeil profond, le cerveau rejoue ce qu’il a appris dans la journée. »</span>
  <small>${ic("sparkles-outline", 13)} L’essentiel · Comment le sommeil consolide la mémoire</small></div></div>`;
C.welcome = `${showcase()}<div class="scr" style="padding-top:0"><div style="height:446px"></div>
  <div class="pager"><i class="on"></i><i></i><i></i></div><div style="height:22px"></div>
  <h1 class="h1">Gardez ce qui compte.<br>Allez au fond.</h1><p class="sub">Vidéos, articles, podcasts : Deepn en tire l’essentiel et vous aide à le retenir.</p>
  <div class="sp"></div><div class="stack g8">${primary("Commencer")}${btn("J’ai déjà un compte", "ghost")}</div></div>`;
C.sheet = `${showcase()}<div class="scr" style="padding-top:0"><div style="height:446px"></div><h1 class="h1">Gardez ce qui compte.<br>Allez au fond.</h1></div>
  <div class="scrim"></div><div class="sheet"><div class="grab"></div>
  <h2 class="h2">Créer votre compte</h2><p class="sub" style="margin:-6px 0 6px">Votre bibliothèque vous suit sur téléphone et sur le web.</p>
  ${apple()}${google()}${mailBtn()}<div style="height:2px"></div>${legal("En créant un compte")}<p class="foot" style="margin:0">Déjà un compte ? <a class="lnk">Se connecter</a></p></div>`;
C.sheetEmail = `${showcase()}<div class="scrim"></div><div class="sheet" style="top:96px">
  <div class="grab"></div><div class="row between">${back()}<span class="small">Étape 1 sur 2</span></div>
  <h2 class="h2">Avec votre e-mail</h2>
  ${field({ label: "Adresse e-mail", value: EMAIL })}
  <div class="stack g12">${field({ label: "Mot de passe", value: "Lecture2aaaaa", pw: true, focus: true })}${checks(RULES_NOW.map(([t], i) => [t, i < 3]))}</div>
  <div style="height:4px"></div>${primary("Continuer")}<div class="sp"></div>${legal("En créant un compte")}</div>`;
C.code = `<div class="scr center" style="text-align:center;align-items:center">
  <div class="halo lg">${ic("mail-open-outline", 38)}</div><div style="height:22px"></div><div class="steps"><i class="on"></i><i class="on"></i></div><div style="height:16px"></div>
  <h1 class="h1" style="font-size:28px">Un code vous attend</h1><p class="sub">Nous l’avons envoyé à<br><b style="color:var(--text-main)">${EMAIL}</b></p>
  <div style="height:26px;width:100%"></div><div style="width:100%">${otp("", {})}</div><div style="height:22px"></div>
  <div style="width:100%" class="stack g8">${btn(`${ic("mail-outline", 19)} Ouvrir Mail`, "tonal")}${btn("Renvoyer le code dans 0:42", "ghost")}</div>
  <div style="height:80px"></div></div>`;
C.ready = `<div class="scr center" style="text-align:center;align-items:center">
  <div class="halo lg" style="background:var(--primary);color:var(--on-primary)">${ic("checkmark", 42)}</div><div style="height:24px"></div>
  <h1 class="h1">Votre compte est prêt</h1><p class="sub" style="max-width:320px">Un dernier réglage : la langue dans laquelle Deepn rédige vos résumés.</p>
  <div style="height:28px;width:100%"></div><div style="width:100%">${primary("Choisir ma langue de lecture", { icon: "arrow-forward" })}</div>
  <div style="height:26px"></div>${note("info", "link-outline", "", `<span style="text-align:left;display:block">Astuce : depuis YouTube, Safari ou un podcast, touchez <b style="display:inline;font-size:14.5px">Partager › Deepn</b> pour enregistrer une source.</span>`)}
  <div style="height:60px"></div></div>`;

const showcaseWeb = `<div style="position:absolute;left:48px;top:40px">${brand()}</div>
  <div style="position:absolute;left:48px;top:132px;width:480px"><div class="h1" style="font-size:44px;letter-spacing:-1.2px">Gardez ce qui compte.<br>Allez au fond.</div></div>
  ${cover(COVERS[0], "position:absolute;left:56px;top:290px;width:230px;transform:rotate(-4deg)")}
  ${cover(COVERS[1], "position:absolute;left:250px;top:330px;width:230px;transform:rotate(3deg)")}
  <div class="callout" style="position:absolute;left:84px;width:420px;top:470px"><span class="q">« Le cerveau rejoue pendant la nuit ce qu’il a appris le jour. »</span><small>${ic("sparkles-outline", 13)} L’essentiel · Comment le sommeil consolide la mémoire</small></div>
  <div style="position:absolute;left:48px;right:48px;bottom:40px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px;font-size:13.5px;line-height:1.45;color:var(--text-subtle)">
  ${[["link-outline", "Enregistrez", "Un lien, un fichier, une photo."], ["sparkles-outline", "Comprenez", "L’essentiel et une discussion avec la source."], ["refresh-outline", "Retenez", "Cartes mémo, quiz et digest du jour."]]
    .map(([i, t, d]) => `<div>${ic(i, 20)}<b style="display:block;color:var(--text-main);font-size:14.5px;margin:6px 0 2px">${t}</b>${d}</div>`).join("")}</div>`;
const wC = (inner) => `<div style="flex:1;display:flex"><div style="width:580px;position:relative;background:var(--surface-container-low)">${showcaseWeb}</div>
  <div style="flex:1;display:flex;align-items:center;justify-content:center"><div style="width:380px">${inner}</div></div></div>`;
C.webRegister = wC(`<div class="seg"><span class="on">Créer un compte</span><span>Se connecter</span></div><div style="height:28px"></div>
  <div class="stack g12">${apple()}${google()}</div><div style="margin:18px 0 14px">${divider("ou avec votre e-mail")}</div>
  <div class="stack g16">${field({ label: "Adresse e-mail", value: EMAIL })}<div class="stack g12">${field({ label: "Mot de passe", value: "Lecture2aaaaa", pw: true, focus: true })}${checks(RULES_NOW.map(([t], i) => [t, i < 3]))}</div>${primary("Créer mon compte", { off: true })}</div>
  <div style="height:18px"></div>${legal("En créant un compte")}`);
C.webLogin = wC(`<div class="seg"><span>Créer un compte</span><span class="on">Se connecter</span></div><div style="height:28px"></div>
  <div class="stack g12">${apple()}${google()}</div><div style="margin:18px 0 14px">${divider("ou avec votre e-mail")}</div>
  <div class="stack g16">${field({ label: "Adresse e-mail", value: EMAIL })}${field({ label: "Mot de passe", value: "a".repeat(10), pw: true, right: forgot, err: `Mot de passe incorrect. Réessayez, ou <a class="lnk">réinitialisez-le</a>.` })}${primary("Se connecter")}</div>`);
C.webCode = wC(`<div class="halo">${ic("mail-open-outline", 30)}</div><div style="height:20px"></div><h1 class="h1" style="font-size:28px">Un code vous attend</h1>
  <p class="sub" style="font-size:15px">Envoyé à <b style="color:var(--text-main)">${EMAIL}</b> · <a class="lnk">Modifier</a></p><div style="height:24px"></div>${otp("48", {})}
  <div style="height:16px"></div>${resend()}<div style="height:20px"></div>${btn(`${ic("open-outline", 18)} Ouvrir Gmail`, "tonal")}`);

// =====================================================================================
// D — Sans mot de passe : un code, puis une clé d'accès
// =====================================================================================
const D = {};
D.start = `<div class="scr"><div style="height:26px"></div>${brand()}<div style="height:54px"></div>
  <h1 class="h1">Entrez dans votre bibliothèque</h1><p class="sub">Aucun mot de passe à retenir : nous vous envoyons un code.</p>
  <div class="stack g12" style="margin-top:28px">${apple()}${google()}</div><div style="margin:22px 0 18px">${divider("ou")}</div>
  <div class="stack g16">${field({ label: "Adresse e-mail", value: EMAIL })}${primary("Recevoir un code")}</div>
  <div class="sp"></div>${legal()}</div>`;
D.code = `<div class="scr">${back()}<div style="height:10px"></div>
  <h1 class="h1" style="font-size:28px">Saisissez le code</h1><p class="sub">Envoyé à <b style="color:var(--text-main)">${EMAIL}</b> · <a class="lnk">Modifier</a></p>
  <div style="height:26px"></div>${otp("48291")}<div style="height:18px"></div>${resend("0:28")}</div>${keyboard({ mode: "num", qt: qtCode })}`;
D.passkey = `<div class="scr center" style="text-align:center;align-items:center">
  <div class="halo lg">${ic("scan-outline", 40)}</div><div style="height:24px"></div>
  <h1 class="h1" style="font-size:29px">La prochaine fois,<br>Face ID suffit</h1><p class="sub" style="max-width:330px">Créez une clé d’accès : rien à retenir, rien à saisir. Elle reste dans votre trousseau iCloud.</p>
  <div style="height:24px"></div><div class="stack g12" style="text-align:left;width:100%;padding:0 12px">
  ${[["shield-checkmark-outline", "Impossible à hameçonner : elle ne fonctionne que sur Deepn."], ["key-outline", "Synchronisée sur vos appareils Apple."], ["mail-outline", "Le code par e-mail reste disponible en secours."]]
    .map(([i, t]) => `<div class="row g12" style="font-size:15px;line-height:1.45">${ic(i, 22)}<span>${t}</span></div>`).join("")}</div>
  <div style="height:32px;width:100%"></div><div class="stack g8" style="width:100%">${primary("Créer une clé d’accès")}${btn("Plus tard", "ghost")}</div><div style="height:40px"></div></div>`;
D.system = `${D.start}<div class="scrim"></div><div class="ios-sheet"><span class="x">${ic("close", 16)}</span>
  <div style="width:56px;height:56px;margin:4px auto 12px;border-radius:14px;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#1c1b1a">${ic("layers-outline", 28)}</div>
  <div style="font-size:19px;font-weight:650">Se connecter à « ‹domaine› » ?</div>
  <div style="font-size:14px;color:#6e6e73;margin:6px 0 18px">Utilisez la clé d’accès enregistrée dans votre trousseau.</div>
  <div style="background:#fff;border-radius:12px;padding:12px 14px;display:flex;gap:12px;align-items:center;text-align:left;margin-bottom:16px">${ic("person-circle-outline", 30)}<div><div style="font-weight:600;font-size:15px">${EMAIL}</div><div style="font-size:12.5px;color:#6e6e73">Clé d’accès · Trousseau iCloud</div></div></div>
  <div class="btn">Continuer</div><div style="font-size:13px;color:#0a84ff;margin-top:14px">Autres options</div></div>`;
D.wrong = `<div class="scr">${back()}<div style="height:10px"></div>
  <h1 class="h1" style="font-size:28px">Saisissez le code</h1><p class="sub">Envoyé à <b style="color:var(--text-main)">${EMAIL}</b> · <a class="lnk">Modifier</a></p>
  <div style="height:26px"></div>${otp("482931", { err: true })}<div style="height:14px"></div>
  <div class="fld"><div class="msg err">${ic("alert-circle-outline", 17)}<span>Ce code ne correspond pas. Vérifiez le dernier e-mail reçu de Deepn.</span></div></div>
  <div style="height:22px"></div>${btn(`${ic("refresh-outline", 18)} Recevoir un nouveau code`, "tonal")}
  <div class="sp"></div>${note("info", "information-circle-outline", "", "Un ancien e-mail ? Seul le dernier code envoyé fonctionne.")}</div>`;

const wD = (inner) => `<div style="height:72px;display:flex;align-items:center;padding:0 40px">${brand()}</div>
  <div style="flex:1;display:flex;justify-content:center;padding-top:48px"><div style="width:380px;position:relative">${inner}</div></div>
  <div class="small ctr" style="padding:0 0 18px">Conditions d’utilisation · Confidentialité · Aide</div>`;
D.webStart = wD(`<h1 class="h1" style="font-size:30px">Entrez dans votre bibliothèque</h1><p class="sub" style="font-size:15px">Aucun mot de passe à retenir : nous vous envoyons un code.</p>
  <div class="stack g12" style="margin-top:26px">${apple()}${google()}</div><div style="margin:20px 0 16px">${divider("ou")}</div>
  <div class="stack g12"><div style="position:relative">${field({ label: "Adresse e-mail", value: "", ph: "vous@exemple.com", caret: true, focus: true, trailing: ic("key-outline", 18) })}
  <div class="autofill" style="left:0;right:0;top:calc(100% + 6px)"><div class="opt hl">${ic("key-outline", 20)}<div><b>${EMAIL}</b><small>Clé d’accès · Gestionnaire de mots de passe Google</small></div></div><hr><div class="opt" style="color:#5c6880">Gérer les clés d’accès…</div></div></div>
  <div style="height:112px"></div>${primary("Recevoir un code")}</div>`);
D.webCode = wD(`<h1 class="h1" style="font-size:30px">Saisissez le code</h1><p class="sub" style="font-size:15px">Envoyé à <b style="color:var(--text-main)">${EMAIL}</b> · <a class="lnk">Modifier</a></p>
  <div style="height:26px"></div>${otp("482", { split: true })}<div style="height:16px"></div>${resend("0:28")}
  <div style="height:22px"></div>${btn(`${ic("open-outline", 18)} Ouvrir Gmail`, "tonal")}`);

// =====================================================================================
// Pages
// =====================================================================================
const SOURCES = `<ul>
<li><a href="https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple">Apple HIG — Sign in with Apple</a> : bouton au moins aussi grand que les autres, sans défilement ; titres autorisés « Sign in / Sign up / Continue with Apple » ; noir sur fond clair, blanc sur fond sombre ; accueillir la personne dès la connexion faite ; ne jamais redemander un mot de passe à qui vient d’Apple.</li>
<li><a href="https://developers.google.com/identity/branding-guidelines">Google — Sign in with Google Branding Guidelines</a> : obligatoire pour la vérification de l’app ; « Continuer avec Google » est un libellé autorisé ; bouton au moins aussi visible que les autres fournisseurs ; « G » en quatre couleurs, variantes claire, neutre et sombre.</li>
<li><a href="https://www.nngroup.com/articles/login-walls/">NN/g — Login Walls</a> : un mur de connexion a un coût ; il se justifie quand la personne comprend ce qu’elle y gagne.</li>
<li><a href="https://pages.nist.gov/800-63-4/sp800-63b/authenticators">NIST SP 800-63B-4</a> : mot de passe seul facteur : 15 caractères minimum, aucune règle de composition (majuscule, chiffre…), refus des mots de passe courants ou compromis ; au moins 64 caractères acceptés.</li>
<li><a href="https://www.twilio.com/en-us/blog/developers/best-practices/otp-input-forms-html">Twilio — OTP input forms</a> et <a href="https://nordhealth.design/raw/components/otp-field.md">Nord — OTP field</a> : <code>autocomplete="one-time-code"</code> / <code>textContentType=oneTimeCode</code>, cases par chiffre adossées à un seul champ, collage réparti, validation automatique au dernier chiffre.</li>
<li><a href="https://design.visa.com/patterns/one-time-passcode/">Visa Design — One-time passcode</a> : chiffres visibles, adresse de destination affichée.</li>
<li><a href="https://fidoalliance.org/design-guidelines/patterns/new-account-creation-with-a-passkey/">FIDO Alliance — UX guidelines</a> et <a href="https://aws.amazon.com/about-aws/whats-new/2024/11/amazon-cognito-passwordless-authentication-low-friction-secure-logins">AWS — Cognito passwordless</a> : un seul point d’entrée connexion / inscription ; clé d’accès proposée après une première connexion réussie ; Cognito les offre via <code>USER_AUTH</code>, palier Essentials ou Plus.</li>
</ul>`;

const consequences = (rows) => `<table class="t"><tbody>${rows.map(([k, v]) => `<tr><th style="width:20%">${k}</th><td>${v}</td></tr>`).join("")}</tbody></table>`;

const dirPage = ({ dir, n, name, bet, lede, phones, desks, texts, cons }) => write(dir, page({
  title: `Authentification — ${n} — ${name}`,
  body: `<div class="kicker">Authentification · direction ${n}</div><h1>${name}</h1><p class="lede">${lede}</p>
  <p><span class="tag y">Parie sur</span> ${bet}</p>
  <h2>Application mobile</h2><div class="cells">${phones.join("")}</div>
  <h2>Web app (ordinateur)</h2><p class="small">Sur téléphone, la web app reprend l’écran mobile ci-dessus (décision de l’owner du 2026-10-11, <code>web_app_owner_direction/README.md</code>).</p>
  <div class="cells">${desks.join("")}</div>
  <h2>Textes</h2><div class="panel">${textTable(texts)}</div>
  <h2>Conséquences</h2><div class="panel">${consequences(cons)}</div>`,
}));

// ---------- A ----------
const textsCommon = [
  ["Boutons sociaux", "« Continuer avec Google » · « Se connecter avec Apple », y compris sur l’inscription", "« Continuer avec Apple » · « Continuer avec Google » : même verbe, valable pour se connecter comme pour s’inscrire (titres autorisés par Apple et Google)"],
  ["Séparateur", "« ou »", "« ou avec votre e-mail »"],
  ["Mauvais mot de passe", "Bandeau rouge en haut : message générique de <code>getFriendlyErrorMessage</code>", "Sous le champ : « Mot de passe incorrect. Réessayez, ou réinitialisez-le. » (lien)"],
  ["Compte existant (inscription)", "Bandeau rouge « error.emailAlreadyExists » + deux liens", "Encart neutre sous l’adresse : « Vous avez déjà un compte — Cette adresse est déjà inscrite sur Deepn. » [Se connecter] [Mot de passe oublié]. Ce n’est pas une erreur : pas de rouge."],
  ["Écran du code", "« Vérifier l’e-mail » · « Saisissez le code reçu par e-mail. »", "« Vérifiez votre boîte mail » · « Code à 6 chiffres envoyé à camille.martin@gmail.com · Modifier »"],
  ["Renvoi", "« Renvoyer un code » puis « Consultez vos e-mails. »", "« Pas reçu ? Vérifiez les courriers indésirables, ou renvoyez le code dans 0:42. » puis « Nouveau code envoyé. »"],
  ["Mentions", "aucune", "« En créant un compte, vous acceptez les Conditions d’utilisation et la Politique de confidentialité de Deepn. » (liens vers les pages de task-357)"],
];
dirPage({
  dir: "direction_a_epuree", n: "A", name: "« Épurée »",
  bet: "la clarté du parcours actuel. Mêmes écrans, mêmes routes, aucun changement serveur.",
  lede: "Le parcours ne change pas : connexion, inscription, code, mot de passe oublié. Chaque écran est resserré autour d’une hiérarchie unique : la marque, une question, les fournisseurs en premier, l’e-mail ensuite, et les erreurs attachées au champ qui les cause.",
  phones: [
    phone(A.login(), { title: "Connexion", caption: "La marque en tête (absente aujourd’hui sur mobile). Apple puis Google <i>au-dessus</i> du formulaire, à taille égale et sans défilement (HIG). « Oublié ? » sur la ligne du libellé, là où l’œil cherche quand le mot de passe échoue." }),
    phone(A.register, { title: "Inscription", caption: "Les règles du mot de passe deviennent une liste qui se coche en direct (ici le chiffre manque, le bouton reste inactif). Les mentions légales apparaissent au moment de l’engagement." }),
    phone(A.loginError, { title: "Mot de passe incorrect", caption: "L’erreur est sous le champ fautif, avec la sortie (réinitialiser) dans la phrase. L’adresse est conservée. Plus de bandeau en haut de page." }),
    phone(A.exists, { title: "Compte déjà existant", caption: "Une adresse déjà inscrite n’est pas une faute : encart neutre, placé sous l’adresse, avec les deux issues en boutons (task-530)." }),
    phone(A.code, { title: "Code de vérification", caption: "Six cases adossées à un seul champ <code>oneTimeCode</code> : iOS propose le code reçu dans Mail au-dessus du clavier. Validation automatique au sixième chiffre ; renvoi possible après un délai visible." }),
    phone(A.reset, { title: "Nouveau mot de passe", caption: "Code et nouveau mot de passe sur le même écran, comme aujourd’hui, mais le code est découpé 3 + 3 et l’œil permet de vérifier la saisie." }),
    phone(A.login(true), { dark: true, title: "Thème sombre", caption: "Bouton Apple blanc sur fond sombre (HIG), Google en variante sombre de sa charte. L’ambre reste réservé à l’action principale." }),
  ],
  desks: [
    desk(A.webLogin, { title: "Connexion", caption: "La carte centrée d’aujourd’hui (capture 19), avec la même hiérarchie que sur mobile : Apple et Google au même rang, champs libellés, « Oublié ? » sur la ligne du libellé. Le lien d’inscription sort de la carte." }),
    desk(A.webRegister, { url: "‹domaine›/register", title: "Inscription, compte existant", caption: "Même encart que sur mobile, sous le champ concerné." }),
    desk(A.webCode, { url: "‹domaine›/register", title: "Code", caption: "Les cases acceptent le collage du code entier (cas le plus courant sur ordinateur)." }),
  ],
  texts: [["Titre connexion", "« Bon retour » · « Connectez-vous pour accéder à votre bibliothèque »", "« Se connecter » · « Retrouvez votre bibliothèque et vos fiches. » (l’app s’ouvre sur cet écran, y compris pour qui n’a jamais eu de compte)"],
    ["Titre inscription", "« Créer un compte » · « Commencez à bâtir votre base de connaissances »", "« Créer votre compte » · « Enregistrez ce qui compte. Deepn vous aide à l’approfondir. »"],
    ["Règles du mot de passe", "« 12 caractères min. · majuscule · minuscule · chiffre » en gris", "Liste cochée en direct : « 12 caractères · Une majuscule · Une minuscule · Un chiffre »"],
    ["Bouton d’inscription", "« Créer le compte »", "« Créer mon compte »"],
    ...textsCommon],
  cons: [["Ce qui change", "Mise en page et textes de <code>login.tsx</code>, <code>register.tsx</code>, <code>AuthCodeScreen.tsx</code>, <code>SocialAuthButtons.tsx</code>, <code>PasswordField.tsx</code> et de leurs équivalents web ; un composant de code à 6 cases ; un compte à rebours de renvoi ; clés i18n dans les 11 langues."],
    ["Backend", "Aucun."],
    ["Risque", "Faible. Le composant de code doit garder l’auto-remplissage (un seul <code>TextInput</code> caché sous les cases, pas six champs)."],
    ["Effort", "S"]],
});

// ---------- B ----------
dirPage({
  dir: "direction_b_une_seule_porte", n: "B", name: "« Une seule porte »",
  bet: "ne jamais demander « avez-vous déjà un compte ? ». On donne son adresse, Deepn sait la suite.",
  lede: "Un seul point d’entrée pour se connecter et s’inscrire (FIDO Alliance). L’adresse est demandée seule ; selon ce que le serveur sait d’elle, l’écran suivant demande le mot de passe, en fait créer un, ou renvoie vers Google ou Apple. Les cas que task-529 et task-530 traitent comme des erreurs deviennent des chemins.",
  phones: [
    phone(B.welcome, { title: "Accueil", caption: "Trois boutons de même taille, aucun formulaire. Rien ne demande de savoir si l’on a déjà un compte." }),
    phone(B.email, { title: "Adresse", caption: "Une seule question. Clavier e-mail, adresse proposée par iOS au-dessus du clavier." }),
    phone(B.known, { title: "Compte trouvé", caption: "« Bon retour » n’est dit qu’à qui revient vraiment. L’adresse est rappelée avec « Modifier ». Le trousseau propose le mot de passe." }),
    phone(B.create, { title: "Adresse nouvelle", caption: "Proposition : une seule règle, 15 caractères, sans composition (NIST 800-63B-4), avec une jauge. Une phrase de quelques mots y suffit." }),
    phone(B.googleOnly, { title: "Compte Google seulement", caption: "Aujourd’hui, « Ce compte n’a pas de mot de passe » après un échec. Ici, on l’apprend avant d’essayer, avec le bon bouton." }),
    phone(B.link, { title: "Apple → compte existant", caption: "Le cas de task-529, dit en clair : pourquoi on demande le mot de passe, et ce qu’on y gagne." }),
  ],
  desks: [
    desk(B.webStart, { title: "Entrée", caption: "Sur ordinateur, l’adresse est saisie dès le premier écran : un clic de moins qu’un bouton « Continuer avec un e-mail ». Pas de carte : une colonne, la marque en haut à gauche." }),
    desk(B.webKnown, { title: "Compte trouvé" }),
    desk(B.webGoogle, { title: "Compte Google seulement" }),
  ],
  texts: [["Accueil", "(aucun : l’app s’ouvre sur « Bon retour »)", "« Deepn — Gardez ce qui compte. Allez au fond. »"],
    ["Bouton e-mail", "(formulaire affiché)", "« Continuer avec un e-mail »"],
    ["Étape adresse", "—", "« Quelle est votre adresse e-mail ? » · « Si vous avez déjà un compte Deepn, nous le retrouverons. »"],
    ["Compte trouvé", "« Bon retour »", "« Bon retour » + adresse rappelée · Modifier"],
    ["Adresse nouvelle", "« Créer un compte »", "« Créez votre compte » · « Aucun compte Deepn n’utilise encore cette adresse. »"],
    ["Règle du mot de passe", "« 12 caractères min. · majuscule · minuscule · chiffre »", "« 15 caractères au moins » + « Astuce : quelques mots qui n’ont rien à voir font un excellent mot de passe. »"],
    ["Compte sans mot de passe", "« Ce compte n’a pas de mot de passe : connectez-vous avec Apple ou Google. » (après échec)", "« Cette adresse utilise Google » · « Vous avez créé votre compte Deepn avec Google. Continuez avec lui pour retrouver votre bibliothèque. »"],
    ["Liaison (task-529)", "« Un compte Deepn existe déjà avec cette adresse. Connectez-vous avec {methods} pour y ajouter {provider}. »", "« Vous avez déjà un compte » · « Saisissez ce mot de passe une seule fois : Apple sera ajouté à votre compte, et la prochaine connexion se fera d’un geste. » · bouton « Se connecter et ajouter Apple »"],
    ...textsCommon.filter(([w]) => !["Compte existant (inscription)", "Mauvais mot de passe"].includes(w))],
  cons: [["Ce qui disparaît", "Le choix connexion / inscription, les écrans <code>register.tsx</code> et la page web <code>/register</code> comme entrées distinctes, l’erreur « compte existant », l’erreur « compte sans mot de passe »."],
    ["Backend", "Un appel qui renvoie, pour une adresse, les moyens de connexion du compte (<code>password</code>, <code>google</code>, <code>apple</code>) ou rien. Il dit si l’adresse a un compte, ce que task-530 a déjà accepté de dire à l’inscription ; il demande la même limitation de débit. Règle Cognito à 15 caractères sans composition (<code>cognito.tf</code>), si retenue."],
    ["Risque", "Une étape de plus pour qui se connecte par mot de passe : à compenser en gardant un champ mot de passe masqué dès l’écran d’adresse, pour que le trousseau remplisse les deux d’un coup."],
    ["Effort", "M"]],
});

// ---------- C ----------
dirPage({
  dir: "direction_c_vitrine", n: "C", name: "« Vitrine »",
  bet: "montrer la valeur avant de demander un compte (Apple : « expliquer pourquoi un compte est requis » ; NN/g : un mur de connexion se justifie par ce qu’il donne).",
  lede: "Le premier écran ne demande rien : il montre une bibliothèque, une source et l’essentiel qu’en tire Deepn, surligné à l’ambre comme dans l’app. Les moyens de connexion arrivent dans une feuille, au geste. Sur ordinateur, la vitrine occupe la moitié gauche de l’écran, le formulaire la droite.",
  phones: [
    phone(C.welcome, { title: "Accueil", caption: "La signature de l’app : couvertures, encart ambre de « L’essentiel ». Trois pages à faire défiler (Enregistrer, Comprendre, Retenir). Deux choix seulement." }),
    phone(C.sheet, { title: "Commencer", caption: "La feuille garde la vitrine visible derrière : on ne quitte pas ce qu’on vient de voir." }),
    phone(C.sheetEmail, { title: "Avec un e-mail", caption: "La feuille s’agrandit. « Étape 1 sur 2 » annonce le code qui suit." }),
    phone(C.code, { title: "Code", caption: "« Ouvrir Mail » pour qui ne voit pas la suggestion du clavier. Écran centré, plus calme, sans clavier tant qu’on n’a pas touché les cases." }),
    phone(C.ready, { title: "Compte prêt", caption: "Apple : accueillir dès la création. La seule étape restante (la langue de lecture, déjà existante) est nommée et justifiée." }),
  ],
  desks: [
    desk(C.webRegister, { url: "‹domaine›/register", title: "Inscription", caption: "Contrôle segmenté de DESIGN.md (actif à l’ambre) pour passer de l’inscription à la connexion sans changer de page." }),
    desk(C.webLogin, { title: "Connexion, erreur" }),
    desk(C.webCode, { url: "‹domaine›/register", title: "Code", caption: "Sur ordinateur, un lien vers le webmail de l’adresse (ici Gmail) quand le domaine est connu." }),
  ],
  texts: [["Accueil", "(aucun)", "« Gardez ce qui compte. Allez au fond. » · « Vidéos, articles, podcasts : Deepn en tire l’essentiel et vous aide à le retenir. »"],
    ["Boutons d’accueil", "—", "« Commencer » · « J’ai déjà un compte »"],
    ["Feuille", "—", "« Créer votre compte » · « Votre bibliothèque vous suit sur téléphone et sur le web. »"],
    ["Code", "« Vérifier l’e-mail »", "« Un code vous attend » · « Nous l’avons envoyé à … » · « Ouvrir Mail »"],
    ["Après vérification", "(passage direct à la langue)", "« Votre compte est prêt » · « Un dernier réglage : la langue dans laquelle Deepn rédige vos résumés. » · « Choisir ma langue de lecture »"],
    ...textsCommon.filter(([w]) => w !== "Écran du code")],
  cons: [["Ce qui change", "Un écran d’accueil et une feuille avant les formulaires ; un écran « compte prêt » avant la langue de lecture. Les formulaires eux-mêmes reprennent A (ou B)."],
    ["Backend", "Aucun."],
    ["Risque", "Un geste de plus pour qui revient (« J’ai déjà un compte ») ; rare, car la session est conservée. Les couvertures de la vitrine doivent être des visuels libres de droits, traduits dans les 11 langues."],
    ["Effort", "M (illustration et carrousel), combinable avec A ou B."]],
});

// ---------- D ----------
dirPage({
  dir: "direction_d_sans_mot_de_passe", n: "D", name: "« Sans mot de passe »",
  bet: "supprimer le mot de passe : un code par e-mail pour entrer, puis une clé d’accès (Face ID, Touch ID, empreinte) pour revenir.",
  lede: "Plus de mot de passe à créer, à retenir ou à réinitialiser. L’adresse reçoit un code ; après la première connexion, Deepn propose une clé d’accès. Apple et Google restent en tête. C’est la direction qui supprime le plus d’écrans et de cas d’erreur, mais elle dépend d’un changement de palier Cognito.",
  phones: [
    phone(D.start, { title: "Entrée", caption: "Un seul champ. Le bouton dit ce qui va se passer : « Recevoir un code »." }),
    phone(D.code, { title: "Code", caption: "Le code suggéré par iOS depuis Mail : un toucher, validation automatique." }),
    phone(D.passkey, { title: "Proposer une clé d’accès", caption: "Après la première connexion réussie, jamais avant (FIDO). « Plus tard » est un vrai choix ; on reproposera dans Compte." }),
    phone(D.system, { title: "Retour avec une clé", caption: "Feuille du système, pas de Deepn : la connexion se fait en un regard." }),
    phone(D.wrong, { title: "Code erroné", caption: "Les cases passent au rouge ; la cause la plus probable (un ancien e-mail) est donnée." }),
  ],
  desks: [
    desk(D.webStart, { title: "Entrée", caption: "Interface conditionnelle WebAuthn : le navigateur propose la clé d’accès dans l’auto-remplissage du champ d’adresse, sans bouton dédié." }),
    desk(D.webCode, { title: "Code" }),
  ],
  texts: [["Titre", "« Bon retour »", "« Entrez dans votre bibliothèque » · « Aucun mot de passe à retenir : nous vous envoyons un code. »"],
    ["Bouton", "« Se connecter »", "« Recevoir un code »"],
    ["Code", "« Vérifier l’e-mail »", "« Saisissez le code » · « Envoyé à … · Modifier »"],
    ["Code erroné", "« Ce code est invalide. Vérifiez-le et réessayez. »", "« Ce code ne correspond pas. Vérifiez le dernier e-mail reçu de Deepn. » · « Recevoir un nouveau code »"],
    ["Clé d’accès", "—", "« La prochaine fois, Face ID suffit » · « Créer une clé d’accès » · « Plus tard »"],
    ["Mot de passe oublié", "écran dédié", "(supprimé)"],
    ...textsCommon.filter(([w]) => ["Boutons sociaux", "Mentions"].includes(w))],
  cons: [["Ce qui disparaît", "Mot de passe, règle de composition, « Mot de passe oublié », le mode « recovery » d’<code>AuthCodeScreen</code>, l’erreur « compte sans mot de passe », l’attaque de pré-détournement de task-530 (personne ne choisit de mot de passe à la place de la victime)."],
    ["Backend", "Cognito <code>USER_AUTH</code> (connexion au choix) avec <code>EMAIL_OTP</code> et <code>WEB_AUTHN</code> : palier Essentials ou Plus, connexion gérée (managed login) et pas de MFA obligatoire. L’envoi d’e-mails passe de <code>COGNITO_DEFAULT</code> à SES : chaque connexion sur un nouvel appareil envoie un e-mail. Domaine associé (Associated Domains / Digital Asset Links) pour les clés d’accès sur mobile."],
    ["Risque", "Délivrabilité des e-mails ; coût du palier par utilisateur actif ; comportement de la liaison Google / Apple (task-529) avec ce flux."],
    ["Effort", "L — décision technique à étayer : benchmark avant implémentation (CLAUDE.md)."]],
});

// ---------- comparatif ----------
const DIAG = [
  ["L’app s’ouvre sur « Bon retour », y compris pour qui n’a jamais eu de compte.", "<code>app/index.tsx</code> → <code>/(auth)/login</code>", "Un titre neutre, ou un accueil qui ne présuppose rien (A, B, C)."],
  ["Mobile : Google et Apple sont sous le formulaire et sous « Mot de passe oublié ? » ; sur un petit écran il faut défiler pour les voir. Le web les met au-dessus.", "<code>login.tsx</code>, <code>register.tsx</code>, <code>AuthPage.tsx</code>", "HIG : bouton Apple sans défilement, pas plus petit que les autres. Même ordre partout."],
  ["Verbes différents : « Continuer avec Google », « Se connecter avec Apple », y compris à l’inscription.", "<code>auth.continueWithGoogle</code>, <code>auth.signInWithApple</code>", "« Continuer avec … » pour les deux, autorisé par les deux chartes."],
  ["Les erreurs apparaissent dans un bandeau en haut du formulaire (mobile), loin du champ, qui n’est pas marqué.", "<code>login.tsx</code> <code>errorContainer</code>", "Message sous le champ fautif, avec l’issue dans la phrase."],
  ["Règle de mot de passe composée (12 + majuscule + minuscule + chiffre) dite en une ligne grise ; on découvre ce qui manque après l’échec.", "<code>auth.passwordPolicy</code>, <code>cognito.tf</code>", "Liste cochée en direct (A) ; ou 15 caractères sans composition (NIST 800-63B-4, B)."],
  ["Le code est un champ texte ordinaire ; le titre ne dit pas à quelle adresse il est parti ; « Renvoyer un code » n’a ni délai ni confirmation claire (« Consultez vos e-mails. »).", "<code>AuthCodeScreen.tsx</code>, <code>AuthCodePage.tsx</code>", "Six cases, adresse affichée avec « Modifier », renvoi après délai visible."],
  ["Sur l’écran du code, le bouton principal reprend le style d’un libellé (14 px) et les marges diffèrent de la connexion ; sur le web, « Renvoyer un code » pèse autant que « Valider ».", "<code>AuthCodeScreen.tsx</code> <code>styles.label</code>", "Un seul gabarit pour tous les écrans d’auth ; le renvoi en lien discret."],
  ["Aucune mention des conditions d’utilisation ni de la confidentialité à l’inscription.", "toutes les pages d’auth", "Une ligne au-dessus ou sous le bouton d’inscription."],
  ["Le logo Deepn n’apparaît pas sur les écrans mobiles d’auth (il est sur le web).", "<code>login.tsx</code>", "La marque en tête, petite."],
  ["La liaison Google / Apple (task-529) est une longue phrase dans un bloc gris, sans bouton qui dise ce qui va se passer.", "<code>auth.linkRequired</code>", "Titre, raison, bénéfice, bouton nommé (B)."],
];

write("comparatif", page({
  title: "Authentification — comparatif",
  body: `<div class="kicker">Authentification · mobile et web</div><h1>Quatre directions pour entrer dans Deepn</h1>
  <p class="lede">Ce que voit une personne avant d’avoir une bibliothèque : connexion, inscription, code reçu par e-mail, mot de passe oublié, liaison avec Google ou Apple. Quatre directions, de la plus sage à la plus radicale, dessinées sur téléphone et sur ordinateur avec les tokens d’Amber Clarity.</p>

  <h2>Ce qui coince aujourd’hui</h2><div class="panel"><table class="t"><thead><tr><th style="width:44%">Constat</th><th style="width:22%">Où</th><th>Bonne pratique</th></tr></thead><tbody>
  ${DIAG.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`).join("")}</tbody></table></div>

  <h2>Les quatre directions</h2><div class="panel"><table class="t"><thead><tr><th>Direction</th><th>Parie sur</th><th>Ce qui disparaît</th><th>Serveur</th><th>Effort</th></tr></thead><tbody>
  <tr><td><b>A — « Épurée »</b><br><code>direction_a_epuree/</code></td><td>la clarté du parcours actuel</td><td>bandeaux d’erreur, règles en gris, champ de code nu</td><td>rien</td><td>S</td></tr>
  <tr><td><b>B — « Une seule porte »</b><br><code>direction_b_une_seule_porte/</code></td><td>l’adresse d’abord, Deepn choisit la suite</td><td>le choix connexion / inscription, les erreurs « compte existant » et « sans mot de passe »</td><td>un appel « moyens de connexion d’une adresse »</td><td>M</td></tr>
  <tr><td><b>C — « Vitrine »</b><br><code>direction_c_vitrine/</code></td><td>montrer la valeur avant de demander un compte</td><td>l’entrée sur un formulaire</td><td>rien</td><td>M</td></tr>
  <tr><td><b>D — « Sans mot de passe »</b><br><code>direction_d_sans_mot_de_passe/</code></td><td>un code puis une clé d’accès</td><td>mot de passe, règle, « mot de passe oublié », pré-détournement</td><td>Cognito <code>USER_AUTH</code>, palier Essentials, SES</td><td>L + benchmark</td></tr>
  </tbody></table>
  <p class="small">Les directions se combinent : C est un accueil qui se pose devant A, B ou D ; A est le socle visuel des trois autres (cases du code, erreurs sous le champ, boutons sociaux en tête).</p></div>

  <h2>Premier écran de chaque direction</h2>
  <div class="cells">
  ${phone(A.login(), { title: "A — Épurée", caption: "Connexion resserrée, fournisseurs en tête." })}
  ${phone(B.welcome, { title: "B — Une seule porte", caption: "Trois boutons, aucune question." })}
  ${phone(C.welcome, { title: "C — Vitrine", caption: "La bibliothèque et l’essentiel avant le formulaire." })}
  ${phone(D.start, { title: "D — Sans mot de passe", caption: "Une adresse, un code." })}
  </div>
  <div class="cells" style="margin-top:28px">
  ${desk(A.webLogin, { half: true, title: "A — web" })}${desk(B.webStart, { half: true, title: "B — web" })}
  ${desk(C.webRegister, { half: true, title: "C — web", url: "‹domaine›/register" })}${desk(D.webStart, { half: true, title: "D — web" })}
  </div>

  <h2>Ce que je retiendrais</h2><div class="panel">
  <ul><li><b>Tout de suite : A.</b> Aucun changement serveur, et chaque constat du tableau est corrigé. C’est aussi le vocabulaire visuel commun aux autres directions.</li>
  <li><b>Ensuite : B, avec l’accueil de C.</b> task-530 a déjà accepté de dire qu’une adresse a un compte ; B en tire le parcours le plus simple, et transforme en chemins les cas que task-529 et task-530 traitent comme des erreurs. L’accueil de C remplace l’écran « Bon retour » montré à tout le monde.</li>
  <li><b>Cible : D, après un benchmark.</b> C’est la seule direction qui supprime le mot de passe et ses failles, mais elle change le palier Cognito et l’envoi d’e-mails.</li></ul></div>

  <h2>Bonnes pratiques retenues</h2><div class="panel">${SOURCES}</div>
  <h2>Conventions</h2><p class="small">Pages générées par <code>_build/build.mjs</code> (icônes : <code>_build/extract_icons.py</code>, depuis l’Ionicons.ttf de l’app). Cadres 414 x 896 et 1200 x 780. Données fictives ; « ‹domaine› » tient la place du domaine non encore acquis (<code>docs/BRAND_IDENTITY.md</code>). Les boutons Apple et Google sont dessinés pour la maquette : l’app garde le bouton natif Apple et le rendu prescrit par la charte Google.</p>`,
}));

console.log("ok");
