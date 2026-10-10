// Shared corpus of the five web-app directions (task-424, pass 3).
// Deterministic: the same seed gives the same 240 folders in every direction, so the
// five prototypes are examined on the very same library.

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Roots and their children, written by hand so that the library reads like a real one:
// long names, a few very long ones, and the same names under different parents.
const ROOTS = [
  ["Neurosciences de l'attention", ["Mémoire de travail", "Fatigue attentionnelle et récupération", "Sommeil", "Notes de lecture", "Entretiens", "Méthodes de mesure (EEG, oculométrie, temps de réaction)"]],
  ["Histoire économique de l'Europe industrielle (1780-1914) — séminaire du jeudi", ["Révolution industrielle britannique", "Chemins de fer", "Banques et crédit", "Notes de lecture", "Sources primaires", "Exposé de mars"]],
  ["Projet Deepn", ["Concurrence", "Entretiens utilisateurs", "Pricing", "Design", "Recrutement", "Références", "2025"]],
  ["Cuisine", ["Fermentation", "Pain au levain", "Cuisine japonaise", "Recettes à tester", "Techniques de base"]],
  ["Philosophie", ["Stoïcisme", "Phénoménologie", "Éthique appliquée", "Notes de lecture", "Entretiens", "Cours en ligne"]],
  ["Santé et sport", ["Course à pied", "Nutrition", "Mobilité et étirements", "Sommeil", "Références"]],
  ["Climat et énergie", ["Rapports du GIEC — résumés pour décideurs", "Nucléaire", "Renouvelables", "Politiques publiques", "Entretiens", "2024", "2025"]],
  ["Musique", ["Théorie et harmonie", "Jazz modal", "Production", "Entretiens", "À écouter"]],
  ["Lectures du club du mardi", ["2024", "2025", "Romans", "Essais", "À proposer au groupe"]],
  ["Développement logiciel", ["Architecture", "TypeScript", "Bases de données", "Accessibilité web", "Conférences", "Notes de lecture", "Références"]],
  ["Voyages", ["Japon", "Portugal", "Islande", "Idées pour 2026"]],
  ["Psychologie cognitive et sciences de l'apprentissage appliquées à l'enseignement secondaire", ["Répétition espacée", "Charge cognitive", "Motivation", "Notes de lecture", "Méthodes de mesure", "Entretiens"]],
  ["Finances personnelles", ["Épargne retraite", "Immobilier", "Fiscalité", "Références"]],
  ["Design d'interfaces", ["Typographie", "Navigation", "Recherche et filtres", "Accessibilité web", "Notes de lecture", "Études de cas"]],
  ["Parentalité", ["Sommeil", "Langage", "Écrans", "Références"]],
];

// Third level: drawn from a small pool, which is exactly what produces homonyms in
// different parents ("Notes de lecture", "2025", "Entretiens"…), plus a few names
// that only make sense where they are.
const LEAF_POOL = ["Notes de lecture", "À relire", "Entretiens", "Références", "2024", "2025", "Méthodes", "Cas pratiques", "Archives", "Brouillons de synthèse", "Séance 1", "Séance 2", "Séance 3", "Questions ouvertes", "Citations à vérifier"];
const SPECIAL_LEAVES = {
  "Mémoire de travail": ["Modèle de Baddeley et Hitch", "Empan et entraînement — ce que disent vraiment les méta-analyses", "Notes de lecture"],
  "Fatigue attentionnelle et récupération": ["Restauration de l'attention (nature, pauses)", "Notes de lecture", "Entretiens"],
  "Entretiens utilisateurs": ["Vague 1 — étudiants", "Vague 2 — chercheurs", "Vague 3 — podcasteurs", "Synthèse"],
  "Concurrence": ["Recall", "Readwise", "NotebookLM", "Snipd"],
  "Japon": ["Kyoto", "Tokyo", "Hokkaido en hiver"],
  "Chemins de fer": ["Notes de lecture", "Cartes et statistiques", "Sources primaires"],
};

function buildCorpus(size) {
  const rand = mulberry32(size === "xl" ? 1000 : 424);
  const folders = [];
  let n = 0;
  const add = (name, parent, depth) => {
    const f = { id: "f" + (++n), name, parent: parent ? parent.id : null, depth, children: [], count: 0, lastOpened: Math.floor(rand() * 220) };
    folders.push(f);
    if (parent) parent.children.push(f);
    return f;
  };
  const unsorted = { id: "f0", name: "Non classés", parent: null, depth: 0, children: [], count: 12, lastOpened: 0, isDefault: true };
  if (size === "small") {
    const small = [["Neurosciences de l'attention", ["Mémoire de travail", "Sommeil"]], ["Projet Deepn", ["Concurrence"]], ["Cuisine", []]];
    for (const [r, cs] of small) {
      const root = add(r, null, 0);
      for (const c of cs) {
        const child = add(c, root, 1);
        if (c === "Mémoire de travail") add("Notes de lecture", child, 2);
      }
    }
  } else {
    for (const [r, cs] of ROOTS) {
      const root = add(r, null, 0);
      for (const c of cs) {
        const child = add(c, root, 1);
        const leaves = SPECIAL_LEAVES[c] || LEAF_POOL.filter(() => rand() < 0.17).slice(0, 4);
        for (const l of leaves) add(l, child, 2);
      }
    }
    if (size === "xl") {
      // Push the same library to ~1 000 folders: more roots of the kinds a heavy user
      // accumulates (one per course, per client, per year), each three levels deep.
      const kinds = ["Cours", "Client", "Lecture suivie", "Projet", "Veille"];
      let k = 0;
      while (folders.length < 990) {
        const root = add(`${kinds[k % kinds.length]} — ${String(Math.floor(k / kinds.length) + 1).padStart(2, "0")} · ${ROOTS[k % ROOTS.length][1][0]}`, null, 0);
        for (let i = 0; i < 6; i++) {
          const child = add(LEAF_POOL[(k + i * 3) % LEAF_POOL.length] + (i > 3 ? ` (${i})` : ""), root, 1);
          for (let j = 0; j < 4; j++) add(LEAF_POOL[(k * 7 + i + j * 5) % LEAF_POOL.length], child, 2);
        }
        k++;
      }
    }
  }
  for (const f of folders) f.count = f.children.length ? Math.floor(rand() * 6) : 1 + Math.floor(rand() * 14);
  const byId = new Map(folders.map((f) => [f.id, f]));
  byId.set(unsorted.id, unsorted);
  const roots = folders.filter((f) => !f.parent);
  const sortByName = (a, b) => a.name.localeCompare(b.name, "fr");
  roots.sort(sortByName);
  for (const f of folders) f.children.sort(sortByName);
  // The two folders the walkthroughs open, pinned to stable ids whatever the corpus.
  const memory = folders.find((f) => f.name === "Mémoire de travail");
  if (memory) memory.count = 9;
  const leafMemory = memory && memory.children.find((c) => c.name === "Notes de lecture");
  if (leafMemory) leafMemory.lastOpened = 180; // a rarely used one, for the "find it again" walkthrough
  return { folders, byId, roots, unsorted, memory, leafMemory };
}

const CORPORA = {};
function corpus(size) {
  return CORPORA[size] || (CORPORA[size] = buildCorpus(size));
}

function folderPath(c, f) {
  const out = [];
  let cur = f;
  while (cur) { out.unshift(cur); cur = cur.parent ? c.byId.get(cur.parent) : null; }
  return out;
}
function descendantCount(f) {
  return f.children.reduce((s, c) => s + 1 + descendantCount(c), 0);
}
function totalSources(f) {
  return f.count + f.children.reduce((s, c) => s + totalSources(c), 0);
}

// Accent- and case-insensitive match, the way the mobile picker's filterFoldersByName
// matches (mobile/src/lib/folderSearch.ts), extended to the path for disambiguation.
function fold(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function searchFolders(c, query, limit = 50) {
  const q = fold(query.trim());
  if (!q) return [];
  const terms = q.split(/\s+/);
  const hits = [];
  for (const f of c.folders) {
    const name = fold(f.name);
    const path = fold(folderPath(c, f).map((p) => p.name).join(" "));
    // Every term somewhere in the path, and the last one in the folder's own name:
    // "neuro notes" finds the « Notes de lecture » under Neurosciences, and a folder is
    // never a hit only because one of its ancestors matches.
    if (!terms.every((t) => path.includes(t)) || !name.includes(terms[terms.length - 1])) continue;
    // Name matches rank above path-only matches, prefix above infix, recent above stale.
    const score = (terms.every((t) => name.includes(t)) ? 0 : 100) + (name.startsWith(terms[0]) ? 0 : 10) + f.lastOpened / 100;
    hits.push({ f, score });
  }
  hits.sort((a, b) => a.score - b.score);
  return hits.slice(0, limit).map((h) => h.f);
}
function homonymCount(c, f) {
  return c.folders.filter((o) => o.name === f.name).length;
}

// ---------------------------------------------------------------- media

const MEDIA = [
  { id: "m1", type: "podcast", title: "Comment l'attention se fatigue — et comment la reposer", creator: "Huberman Lab", duration: "1 h 52", age: "Il y a 2 h", folder: "memory", lang: "EN", progress: 0.38, color: "#3b4a6b" },
  { id: "m2", type: "article", title: "Working memory is not a muscle: a meta-analysis of 87 training studies", creator: "Psychological Bulletin", duration: "24 min", age: "Hier", folder: "memory", lang: "EN", color: "#6b5b3b" },
  { id: "m3", type: "video", title: "Baddeley explique son modèle en 15 minutes", creator: "Cambridge Talks", duration: "15 min", age: "Il y a 3 j", folder: "memory", lang: "EN", color: "#2f5d50" },
  { id: "m4", type: "document", title: "Cowan 2010 — The Magical Mystery Four.pdf", creator: "PDF · 14 pages", duration: "14 p.", age: "Il y a 4 j", folder: "memory", lang: "EN", color: "#7a6e5d" },
  { id: "m5", type: "short", title: "Pourquoi on oublie un numéro en 20 secondes", creator: "@sciencecourte", duration: "58 s", age: "Il y a 5 j", folder: "memory", lang: "FR", color: "#5d3b6b" },
  { id: "m6", type: "podcast", title: "La charge mentale des open spaces, mesurée", creator: "France Culture — La Méthode scientifique", duration: "58 min", age: "Il y a 1 sem.", folder: "memory", lang: "FR", color: "#3b5d6b" },
  { id: "m7", type: "article", title: "Ce que les pauses courtes font vraiment à la mémoire de travail", creator: "The Conversation", duration: "9 min", age: "Il y a 2 sem.", folder: "memory", lang: "FR", color: "#6b3b3b" },
  { id: "m8", type: "imagePost", title: "Schéma du calepin visuo-spatial (carrousel)", creator: "@cogsci.sketches", duration: "6 images", age: "Il y a 3 sem.", folder: "memory", lang: "EN", color: "#4a6b3b" },
  { id: "m9", type: "audio", title: "Note vocale — idée d'exercice pour le séminaire", creator: "Note vocale", duration: "2 min", age: "Il y a 1 mois", folder: "memory", lang: "FR", color: "#5b5b5b" },
  { id: "m10", type: "video", title: "Inside the race to build the next generation of batteries", creator: "Undecided with Matt Ferrell", duration: "21 min", age: "Il y a 40 min", folder: null, lang: "EN", status: "processing", color: "#3b6b5d" },
  { id: "m11", type: "article", title: "Le levain, une écologie microbienne à domicile", creator: "Le Monde", duration: "11 min", age: "Il y a 5 h", folder: null, lang: "FR", color: "#7a5d3b" },
  { id: "m12", type: "link", title: "Vidéo en direct — conférence d'ouverture", creator: "youtube.com", duration: "", age: "Hier", folder: null, lang: "EN", status: "failed", color: "#6b6b6b" },
  { id: "m13", type: "podcast", title: "Stoïcisme : Épictète pour les gens pressés", creator: "Philosophize This!", duration: "41 min", age: "Hier", folder: null, lang: "EN", color: "#4b3b6b" },
  { id: "m14", type: "text", title: "Note partagée — liste des questions pour l'entretien n° 7", creator: "Note partagée", duration: "1 min", age: "Il y a 2 j", folder: null, lang: "FR", color: "#5d5d4a" },
  { id: "m15", type: "short", title: "Le geste qui sauve votre pain au levain", creator: "@boulange.maison", duration: "45 s", age: "Il y a 3 j", folder: null, lang: "FR", color: "#6b4a3b" },
];
const TYPE_META = {
  podcast: { label: "PODCAST", icon: "headset-outline" },
  article: { label: "ARTICLE", icon: "newspaper-outline" },
  video: { label: "VIDÉO", icon: "play-circle-outline" },
  short: { label: "SHORT", icon: "videocam-outline" },
  imagePost: { label: "PHOTOS", icon: "image-outline" },
  audio: { label: "AUDIO", icon: "mic-outline" },
  text: { label: "TEXTE", icon: "text-outline" },
  document: { label: "DOC", icon: "document-text-outline" },
  link: { label: "LIEN", icon: "link-outline" },
};

// Generic sources for any other folder, derived from its name so that each folder
// shows its own believable list without hand-writing 240 of them.
const GENERIC_TITLES = [
  ["podcast", "Épisode : {n} — ce que l'on sait vraiment"], ["article", "{n} : l'état de l'art en 2026"], ["video", "Conférence — {n}, introduction"],
  ["document", "Polycopié — {n}.pdf"], ["short", "{n} en 60 secondes"], ["article", "Cinq erreurs courantes sur « {n} »"], ["podcast", "Entretien long sur {n}"],
];
function sourcesOf(c, f) {
  if (f === c.memory || (f && f.name === "Mémoire de travail")) return MEDIA.filter((m) => m.folder === "memory");
  if (f && f.isDefault) return MEDIA.filter((m) => !m.folder);
  const rand = mulberry32(f.id.length * 97 + f.name.length * 13 + f.depth);
  const out = [];
  for (let i = 0; i < f.count; i++) {
    const [type, tpl] = GENERIC_TITLES[(i + f.name.length) % GENERIC_TITLES.length];
    out.push({ id: `g${f.id}-${i}`, type, title: tpl.replace("{n}", f.name), creator: ["Arte", "Radio France", "Medium", "YouTube", "Substack"][i % 5], duration: `${5 + Math.floor(rand() * 60)} min`, age: `Il y a ${1 + Math.floor(rand() * 9)} sem.`, lang: "FR", color: ["#3b4a6b", "#6b5b3b", "#2f5d50", "#5d3b6b", "#6b3b3b"][i % 5], generic: true });
  }
  return out;
}
function mediaById(id) {
  return MEDIA.find((m) => m.id === id) || MEDIA[0];
}

// ---------------------------------------------------------------- reading

const PREVIEW = {
  blurb: "Un épisode sur la fatigue attentionnelle : pourquoi elle n'est pas de l'ennui, ce qui la provoque au travail, et les trois formes de pause qui la réparent réellement.",
  points: ["La fatigue attentionnelle vient de l'effort d'inhibition, pas de la durée de la tâche.", "Une pause qui sollicite encore l'attention dirigée (téléphone, messages) ne repose pas.", "Dix minutes de « regard large » en extérieur restaurent mieux qu'une sieste courte."],
};
const PARAGRAPHS = [
  "Commençons par une distinction que l'on fait rarement : être fatigué d'une tâche et s'ennuyer pendant une tâche sont deux états qui se ressemblent de l'extérieur, mais qui n'ont presque rien en commun dans le cerveau.",
  "L'ennui est un signal de valeur : la tâche ne rapporte pas assez par rapport à ce qu'elle coûte. La fatigue attentionnelle, elle, apparaît même quand la tâche nous passionne. Ce qui s'use, ce n'est pas l'intérêt, c'est la capacité à tenir à distance tout ce qui n'est pas la tâche.",
  "C'est ce que les chercheurs appellent l'attention dirigée. Elle repose sur un effort constant d'inhibition : ignorer la conversation à côté, la notification, l'idée qui vient de surgir. Cet effort a un coût mesurable en temps de réaction au bout de quarante à soixante minutes.",
  "Le piège, c'est la pause. Quand on prend son téléphone pour « se reposer », on demande à ce même système d'inhibition de trier un flux de stimulations très saillantes. On change de contenu, mais on ne change pas de régime attentionnel.",
  "Les études sur la restauration de l'attention montrent un effet assez robuste : dix à quinze minutes dans un environnement qui attire l'attention sans l'exiger — un parc, une fenêtre sur des arbres, le ciel — suffisent à faire remonter les performances sur des tâches de mémoire de travail.",
  "On parle de fascination douce. Le regard est attiré, mais rien ne demande à être trié ni retenu. Le système d'inhibition peut enfin relâcher son effort.",
  "Deuxième forme de pause efficace : le regard large. Élargir volontairement le champ visuel, regarder l'horizon plutôt qu'un point, active des circuits associés à la baisse de vigilance et au calme. C'est l'inverse exact de la fixation sur un écran.",
  "Troisième forme : le mouvement sans but. Marcher sans destination, sans podcast dans les oreilles. Plusieurs personnes nous ont dit trouver cela insupportable au début, et c'est justement le signe que l'attention dirigée était encore aux commandes.",
  "Ce qui ne marche pas, en revanche, c'est la sieste très courte prise à la place de ces pauses. Elle aide la vigilance, mais n'a pas d'effet mesurable sur la fatigue d'inhibition elle-même.",
  "Si vous ne retenez qu'une chose : la bonne pause n'est pas celle qui vous distrait, c'est celle qui ne vous demande rien.",
];

// ---------------------------------------------------------------- AI artifacts

const ARTIFACT_TYPES = [
  { key: "summaryShort", label: "Résumé", icon: "document-text-outline" },
  { key: "summaryDetailed", label: "Résumé détaillé", icon: "documents-outline" },
  { key: "notes", label: "Notes d'apprentissage", icon: "school-outline" },
  { key: "flashcards", label: "Flashcards", icon: "albums-outline" },
  { key: "quiz", label: "Quiz", icon: "help-circle-outline" },
];
const MEDIA_ARTIFACTS = { summaryShort: "generated", flashcards: "generated", notes: "generating", summaryDetailed: "idle", quiz: "idle" };
const FOLDER_ARTIFACTS = { summaryShort: "idle", summaryDetailed: "generated", notes: "idle", flashcards: "failed", quiz: "queued" };
const MEDIA_HISTORY = [
  { type: "flashcards", title: "Fatigue attentionnelle : 12 cartes", when: "Hier, 21:14" },
  { type: "summaryShort", title: "La bonne pause ne demande rien", when: "Hier, 21:02" },
];
const FOLDER_HISTORY = [
  { type: "summaryDetailed", title: "Mémoire de travail : capacité, fatigue et récupération", when: "Il y a 2 j", sources: 9 },
  { type: "quiz", title: "Quiz — modèles de la mémoire de travail", when: "Il y a 1 sem.", sources: 7 },
  { type: "summaryDetailed", title: "Mémoire de travail : ce que disent les méta-analyses", when: "Il y a 2 sem.", sources: 6 },
];
const FLASHCARDS = [
  ["Quelle est la différence entre fatigue attentionnelle et ennui ?", "L'ennui signale une valeur trop faible de la tâche ; la fatigue attentionnelle vient de l'usure de l'effort d'inhibition, même quand la tâche intéresse."],
  ["Pourquoi le téléphone ne repose-t-il pas ?", "Il sollicite le même système d'inhibition avec des stimulations très saillantes."],
  ["Qu'est-ce que la « fascination douce » ?", "Un environnement qui attire l'attention sans l'exiger, comme un parc ou le ciel."],
];
const QUIZ = {
  question: "Au bout de combien de temps l'effort d'inhibition a-t-il un coût mesurable en temps de réaction ?",
  options: [["A", "10 à 15 minutes"], ["B", "40 à 60 minutes"], ["C", "Deux heures"], ["D", "Il n'a pas de coût mesurable"]],
  correct: "B",
  explanation: "L'épisode situe la baisse mesurable entre quarante et soixante minutes d'attention dirigée (§3).",
};

// ---------------------------------------------------------------- chat
// The validated scopes (task-434 Decision): a media item (in Lecture) and a folder
// (in Sources). Nothing at library level. History is durable (task-430 Decision §3).

const CHAT = {
  media: {
    conversations: [
      { id: "c1", title: "Fatigue ou ennui ?", when: "Aujourd'hui, 09:12", turns: 3, active: true },
      { id: "c2", title: "Les trois pauses, appliquées au bureau", when: "Hier", turns: 5 },
      { id: "c3", title: "Sources citées dans l'épisode", when: "Il y a 4 j", turns: 2, interrupted: true },
    ],
    messages: [
      { role: "user", text: "Quelle différence fait-il entre la fatigue attentionnelle et l'ennui ?" },
      { role: "assistant", text: "Il les oppose sur leur origine. L'ennui est un <b>signal de valeur</b> : la tâche ne rapporte pas assez pour ce qu'elle coûte <cite>§2</cite>. La fatigue attentionnelle apparaît <b>même quand la tâche passionne</b>, parce que ce qui s'use est l'effort d'inhibition — tenir à distance ce qui n'est pas la tâche <cite>§2</cite> <cite>§3</cite>." },
      { role: "user", text: "Et donc, quelle pause pour une après-midi de relecture ?" },
    ],
    streaming: "Pour une relecture, l'épisode recommande une pause qui ne demande rien : dix à quinze minutes dehors ou face à une fenêtre <cite>§5</cite>, ou une marche sans but et sans écouteurs <cite>§8</cite>. À éviter : le téléphone, qui sollicite le même système d'inhibition que la relec",
    suggestions: ["Résume les trois pauses en une ligne chacune", "Quelles études sont citées ?", "Qu'est-ce qui ne marche pas ?"],
  },
  folder: {
    conversations: [
      { id: "d1", title: "Points communs sur la récupération", when: "Aujourd'hui, 10:40", turns: 4, active: true },
      { id: "d2", title: "Désaccords entre Cowan et Baddeley", when: "Il y a 3 j", turns: 6 },
    ],
    messages: [
      { role: "user", text: "Sur quoi ces sources sont-elles d'accord à propos de la récupération de l'attention ?" },
      { role: "assistant", text: "Trois sources convergent : une pause n'aide que si elle <b>cesse de solliciter l'attention dirigée</b> <cite>1</cite> <cite>7</cite>, et l'entraînement ne fait pas « grossir » la mémoire de travail au-delà des tâches entraînées <cite>2</cite>. Le podcast de France Culture ajoute une mesure en open space qui va dans le même sens <cite>6</cite>.", stopped: true, partial: "Réponse arrêtée par vous — le texte reçu est conservé." },
      { role: "user", text: "Lesquelles se contredisent sur la capacité ?" },
      { role: "assistant", text: "Cowan défend une limite d'environ quatre éléments <cite>4</cite>, là où la vidéo sur Baddeley présente", failed: true },
    ],
    streaming: "Cowan défend une limite d'environ <b>quatre éléments</b> <cite>4</cite>, là où la présentation de Baddeley décrit des sous-systèmes dont la capacité dépend du format — verbal ou visuo-spatial <cite>3</cite> <cite>8</cite>. La méta-analyse ne tranche pas entre les deux modèles mais",
    suggestions: ["Fais un tableau des désaccords", "Quelle source lire en premier ?", "Qu'est-ce qui manque dans ce dossier ?"],
  },
};

// ---------------------------------------------------------------- misc

const DIGEST = {
  daily: { count: 4, items: ["m1", "m11", "m13", "m14"] },
  weekly: { count: 11, items: ["m2", "m3", "m4", "m6", "m7"] },
};
const SEARCH_HITS = [
  { media: "m1", snippet: "…la bonne <mark>pause</mark> n'est pas celle qui vous distrait, c'est celle qui ne vous demande rien." },
  { media: "m7", snippet: "…ce que les <mark>pauses</mark> courtes font vraiment à la mémoire de travail, selon trois expériences…" },
  { media: "m6", snippet: "…les salariés interrogés prennent leur <mark>pause</mark> sur le téléphone dans 71 % des cas…" },
  { media: "m15", snippet: "…laissez la pâte en <mark>pause</mark> 30 minutes après le premier pétrissage…" },
];
const READING_LANGUAGES = ["Français", "English", "Deutsch", "Español", "Italiano", "Nederlands", "Português", "العربية", "हिन्दी", "日本語", "中文"];
