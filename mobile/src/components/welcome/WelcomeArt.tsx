import type { ReactNode } from "react";
import { Image, Platform, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useThemedStyles } from "../../contexts/ThemeContext";
import type { Theme } from "../../constants/theme";
import { markedParts } from "@media-summarizer/core/i18n/parts";
import { t, tCount, type TranslationKey } from "../../i18n";
import { Bar, Card, CardHead, Glow } from "./artKit";

type IconName = keyof typeof Ionicons.glyphMap;

// ---------------------------------------------------------------------------
// 1 — Depth: three media on one subject (sleep and memory) lie on top of what
// you get from them, a chat with the AI and a quiz, covering only the empty
// head of those cards. The same three media come back in small at the foot of
// both cards (« Sources »): that is what ties them together, with no line.
// ---------------------------------------------------------------------------
type Medium = "video" | "podcast" | "article";
const MEDIA: Record<Medium, { icon: IconName; type: TranslationKey; title: TranslationKey }> = {
  video: { icon: "play-circle-outline", type: "welcome.art.video", title: "welcome.art.videoTitle" },
  podcast: { icon: "headset-outline", type: "welcome.art.podcast", title: "welcome.art.podcastTitle" },
  article: { icon: "document-text-outline", type: "welcome.art.article", title: "welcome.art.articleTitle" },
};
// [medium, left, top, rotation]: the podcast at the centre, a little higher.
const SPREAD: [Medium, number, number, number][] = [["video", 18, 30, -6], ["article", 274, 30, 6], ["podcast", 146, 16, 0]];
// A sound wave's bar heights, irregular but fixed.
const WAVE = Array.from({ length: 10 }, (_, k) => Math.max(4, Math.round(34 * (0.35 + 0.65 * Math.abs(Math.sin(k * 1.7) * Math.cos(k * 0.6))))));
const VIDEO_FILL = "#3d4a6b";

export function DepthArt() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeDepthStyles);
  const fill: Record<Medium, string> = { video: VIDEO_FILL, podcast: colors.primary, article: colors.articleContainer };
  const ink: Record<Medium, string> = { video: "#fff", podcast: colors.onPrimary, article: colors.textMain };
  // The three media in small, overlapping like avatars.
  const sources = <View style={styles.sources}>
    <Text style={styles.sourcesLabel}>{t("welcome.art.sources")}</Text>
    {(["video", "podcast", "article"] as const).map((key, n) => <View key={key} style={[styles.token, { backgroundColor: fill[key], marginLeft: n ? -5 : 0 }]}>
      <Ionicons name={MEDIA[key].icon} size={15} color={ink[key]} />
    </View>)}
  </View>;
  const look: Record<Medium, ReactNode> = {
    video: <View style={styles.player}>
      <View style={styles.playDisc}><Ionicons name="play" size={16} color={VIDEO_FILL} /></View>
      <View style={styles.progress}><View style={styles.progressDone} /></View>
    </View>,
    podcast: <View style={styles.wave}>
      <Ionicons name="headset-outline" size={28} color={ink.podcast} />
      <View style={styles.bars}>{WAVE.map((h, k) => <View key={k} style={[styles.waveBar, { height: h }]} />)}</View>
    </View>,
    article: <View style={styles.page}>
      <Bar width="70%" height={6} color="rgba(28, 27, 26, 0.55)" />
      {(["100%", "90%", "96%"] as const).map((w) => <Bar key={w} width={w} height={4} color="rgba(28, 27, 26, 0.2)" />)}
    </View>,
  };
  return <>
    <Glow top={40} height={360} />
    <Card style={[styles.front, { left: 18, transform: [{ rotate: "-3deg" }] }]}>
      <CardHead icon="chatbubbles-outline" label={t("welcome.art.chat")} size={24} />
      <View style={styles.question}><Text style={styles.questionText}>{t("welcome.art.chatQuestion")}</Text></View>
      <View style={styles.thinking}>
        <Text numberOfLines={1} style={styles.thinkingText}>{t("welcome.art.chatThinking")}</Text>
        {[1, 0.6, 0.3].map((o) => <View key={o} style={[styles.dot, { opacity: o }]} />)}
      </View>
      {sources}
    </Card>
    <Card style={[styles.front, { left: 214, transform: [{ rotate: "3deg" }] }]}>
      <CardHead icon="school-outline" label={t("welcome.art.quiz")} size={24} />
      <Text style={styles.quizQuestion}>{t("welcome.art.quizQuestion")}</Text>
      <View style={styles.answers}>
        <View style={[styles.answer, styles.answerWrong]}><Text numberOfLines={1} style={styles.answerText}>{t("welcome.art.quizWrong")}</Text></View>
        <View style={[styles.answer, styles.answerRight]}>
          <Ionicons name="checkmark" size={14} color={colors.success} />
          <Text numberOfLines={1} style={[styles.answerText, styles.answerRightText]}>{t("welcome.art.quizRight")}</Text>
        </View>
      </View>
      {sources}
    </Card>
    {SPREAD.map(([key, x, y, rotation]) => <View key={key} style={[styles.medium, { left: x, top: y, backgroundColor: fill[key],
      transform: [{ rotate: `${rotation}deg` }] }]}>
      {look[key]}
      <Text numberOfLines={1} style={[styles.mediumType, { color: ink[key] }]}>{t(MEDIA[key].type)}</Text>
      <Text numberOfLines={2} style={[styles.mediumTitle, { color: ink[key] }]}>{t(MEDIA[key].title)}</Text>
    </View>)}
  </>;
}

const makeDepthStyles = ({ colors }: Theme) => StyleSheet.create({
  medium: { position: "absolute", width: 122, height: 142, borderRadius: 18, padding: 12, gap: 4,
    shadowColor: "#2b2d42", shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 4 },
  mediumType: { marginTop: 8, fontSize: 11.5, fontWeight: "600", opacity: 0.75 },
  mediumTitle: { fontSize: 14, lineHeight: 17, fontWeight: "800" },
  player: { height: 58, borderRadius: 10, backgroundColor: "rgba(255, 255, 255, 0.14)", alignItems: "center", justifyContent: "center" },
  playDisc: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingLeft: 2 },
  progress: { position: "absolute", left: 8, right: 8, bottom: 7, height: 3, borderRadius: 2, backgroundColor: "rgba(255, 255, 255, 0.3)" },
  progressDone: { width: "40%", height: 3, borderRadius: 2, backgroundColor: "#ff5a4f" },
  wave: { height: 58, flexDirection: "row", alignItems: "center", gap: 10 },
  bars: { flexDirection: "row", alignItems: "center", gap: 3 },
  waveBar: { width: 3, borderRadius: 1.5, backgroundColor: "rgba(28, 27, 26, 0.6)" },
  page: { height: 58, borderRadius: 10, backgroundColor: "rgba(255, 255, 255, 0.6)", padding: 9, gap: 5 },
  front: { top: 150, width: 182, height: 236, borderRadius: 20, paddingTop: 44, paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  question: { alignSelf: "flex-end", backgroundColor: colors.textMain, borderRadius: 16, borderBottomRightRadius: 4, paddingVertical: 8, paddingHorizontal: 12 },
  questionText: { color: colors.background, fontSize: 13, lineHeight: 17, fontWeight: "600" },
  thinking: { alignSelf: "flex-start", height: 34, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.surfaceContainer,
    borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 12, maxWidth: "100%" },
  thinkingText: { fontSize: 12.5, fontStyle: "italic", color: colors.textSubtle, flexShrink: 1, marginRight: 3 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.textSubtle },
  quizQuestion: { fontSize: 14.5, lineHeight: 19, fontWeight: "800", color: colors.textMain },
  answers: { flexDirection: "row", gap: 6 },
  answer: { height: 34, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 4 },
  answerWrong: { flex: 1, borderWidth: 1, borderColor: colors.outlineVariant },
  answerRight: { flex: 1.3, borderWidth: 1.5, borderColor: colors.success, backgroundColor: colors.successTint },
  answerText: { fontSize: 13, color: colors.textMain },
  answerRightText: { color: colors.success, fontWeight: "700" },
  sources: { marginTop: "auto", flexDirection: "row", alignItems: "center" },
  sourcesLabel: { fontSize: 12, color: colors.textSubtle, marginRight: 6 },
  token: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.surface, alignItems: "center", justifyContent: "center" },
});

// ---------------------------------------------------------------------------
// 2 — Two gestures: share from another app, or add right in Deepn (the rows of
// `AddSourceSheet`, each on the amber disc). Each system shows its own share icon and its own app list:
// no Apple Podcasts on Android, Chrome and Keep instead of Safari and Notes.
// The list follows SHARE_TARGETS (`core/media_ingestion/adapters/share_targets.py`).
// ---------------------------------------------------------------------------
const TILES: Record<string, ImageSourcePropType> = Platform.OS === "android" ? {
  youtube: require("../../../assets/welcome/youtube-android.png"),
  tiktok: require("../../../assets/welcome/tiktok-android.png"),
  instagram: require("../../../assets/welcome/instagram-android.png"),
  x: require("../../../assets/welcome/x-android.png"),
  spotify: require("../../../assets/welcome/spotify-android.png"),
  deezer: require("../../../assets/welcome/deezer-android.png"),
  whatsapp: require("../../../assets/welcome/whatsapp-android.png"),
  googlechrome: require("../../../assets/welcome/googlechrome-android.png"),
  googlekeep: require("../../../assets/welcome/googlekeep-android.png"),
} : {
  youtube: require("../../../assets/welcome/youtube-ios.png"),
  tiktok: require("../../../assets/welcome/tiktok-ios.png"),
  instagram: require("../../../assets/welcome/instagram-ios.png"),
  x: require("../../../assets/welcome/x-ios.png"),
  spotify: require("../../../assets/welcome/spotify-ios.png"),
  applepodcasts: require("../../../assets/welcome/applepodcasts-ios.png"),
  deezer: require("../../../assets/welcome/deezer-ios.png"),
  whatsapp: require("../../../assets/welcome/whatsapp-ios.png"),
  safari: require("../../../assets/welcome/safari-ios.png"),
  notes: require("../../../assets/welcome/notes-ios.png"),
};
const SHARE_ICON: IconName = Platform.OS === "android" ? "share-social-outline" : "share-outline";

export function ShareArt() {
  const { colors, shadows } = useTheme();
  const styles = useThemedStyles(makeShareStyles);
  const arrow = <Ionicons name="chevron-forward" size={18} color={colors.outline} />;
  const caps = (icon: IconName, key: TranslationKey) => <View style={styles.caps}>
    <Ionicons name={icon} size={14} color={colors.textSubtle} />
    <Text style={styles.capsText}>{t(key).toLocaleUpperCase()}</Text>
  </View>;
  const row = (icon: IconName, title: TranslationKey, detail: string) => <View style={styles.row}>
    <View style={styles.disc}><Ionicons name={icon} size={19} color={colors.onPrimary} /></View>
    <View style={styles.rowText}>
      <Text numberOfLines={1} style={styles.rowTitle}>{t(title)}</Text>
      <Text numberOfLines={1} style={styles.rowDetail}>{detail}</Text>
    </View>
  </View>;
  return <>
    <Card style={styles.top}>
      {caps(SHARE_ICON, "welcome.art.fromApp")}
      <View style={styles.gesture}>
        <Image source={TILES.youtube} style={styles.bigTile} />
        {arrow}
        <View style={[styles.pill, shadows.soft]}>
          <Ionicons name={SHARE_ICON} size={18} color={colors.textMain} />
          <Text numberOfLines={1} style={styles.pillText}>{t("welcome.art.share")}</Text>
        </View>
        {arrow}
        <View>
          <View style={styles.mark}><Ionicons name="layers-outline" size={22} color={colors.onPrimary} /></View>
          {/* Under the mark without widening it, so the three steps stay centred. */}
          <Text numberOfLines={1} style={styles.markLabel}>Deepn</Text>
        </View>
      </View>
      {/* « Works with » between two hairlines: the logos below are the apps that can share to Deepn. */}
      <View style={styles.worksWith}>
        <View style={styles.hairline} />
        <Text style={styles.worksWithText}>{t("welcome.art.worksWith")}</Text>
        <View style={styles.hairline} />
      </View>
      <View style={styles.tiles}>{Object.entries(TILES).map(([key, source]) => <Image key={key} source={source} style={styles.smallTile} />)}</View>
    </Card>
    <Card style={styles.bottom}>
      {caps("add", "welcome.art.inDeepn")}
      <View style={styles.rows}>
        {row("document-text-outline", "addSource.importFile.label", "PDF, DOCX, PPTX, XLSX, TXT, MP3, M4A…")}
        {row("images-outline", "addSource.importPhoto.label", t("welcome.art.photoLibrary"))}
        {row("link-outline", "addSource.enterUrl.label", t("welcome.art.linkKinds"))}
      </View>
    </Card>
  </>;
}

const makeShareStyles = ({ colors }: Theme) => StyleSheet.create({
  top: { left: 20, right: 20, top: 4, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16 },
  bottom: { left: 20, right: 20, top: 204, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 8 },
  caps: { flexDirection: "row", alignItems: "center", gap: 6 },
  capsText: { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.8, color: colors.textSubtle },
  gesture: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, marginBottom: 26 },
  bigTile: { width: 44, height: 44 },
  pill: { flexDirection: "row", alignItems: "center", gap: 7, height: 34, paddingLeft: 11, paddingRight: 14, borderRadius: 999,
    backgroundColor: colors.surface, flexShrink: 1 },
  pillText: { fontSize: 14, fontWeight: "700", color: colors.textMain, flexShrink: 1 },
  mark: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  markLabel: { position: "absolute", top: 48, left: -20, right: -20, textAlign: "center", fontSize: 11.5, fontWeight: "700", color: colors.textMain },
  worksWith: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  hairline: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant },
  worksWithText: { fontSize: 11.5, color: colors.textSubtle },
  tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  smallTile: { width: 28, height: 28 },
  rows: { marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 7 },
  disc: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: "600", color: colors.textMain },
  rowDetail: { fontSize: 12, color: colors.textSubtle },
});

// ---------------------------------------------------------------------------
// 3 — Search: a few remembered words typed, and the three media of page 1 found
// by them. Each result quotes its passage with the query's words highlighted
// (each language marks its own words, `[like this]`, in the catalog), and the
// video and the podcast give the moment it is said. The app's results do not
// carry that moment yet: the owner keeps it in the image.
// ---------------------------------------------------------------------------
const RESULTS: { medium: Medium; quote: TranslationKey; at?: string }[] = [
  { medium: "podcast", quote: "welcome.art.searchPodcast", at: "12:34" },
  { medium: "video", quote: "welcome.art.searchVideo", at: "03:10" },
  { medium: "article", quote: "welcome.art.searchArticle" },
];

export function SearchArt() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeSearchStyles);
  // The article tile keeps a dark glyph: its sea-green stays light in both themes here.
  const tile: Record<Medium, [string, string]> = { video: [VIDEO_FILL, "#fff"], podcast: [colors.primary, colors.onPrimary], article: ["#c1ebec", "#1c1b1a"] };
  return <>
    <Glow top={60} height={300} />
    <Card style={styles.bar}>
      <Ionicons name="search-outline" size={20} color={colors.textSubtle} />
      <Text numberOfLines={1} style={styles.query}>{t("welcome.art.searchQuery")}</Text>
      <View style={styles.caret} />
      <Text style={styles.count}>{tCount("search.resultCount", 3)}</Text>
    </Card>
    {RESULTS.map(({ medium, quote, at }, index) => <Card key={medium} style={[styles.result, { top: 84 + index * 104 }]}>
      <View style={[styles.tile, { backgroundColor: tile[medium][0] }]}><Ionicons name={MEDIA[medium].icon} size={20} color={tile[medium][1]} /></View>
      <View style={styles.resultText}>
        <View style={styles.resultHead}>
          <Text numberOfLines={1} style={styles.resultTitle}>{t(MEDIA[medium].title)}</Text>
          {at && <View style={styles.at}><Ionicons name="play" size={10} color={colors.textMain} /><Text style={styles.atText}>{at}</Text></View>}
        </View>
        <Text numberOfLines={2} style={styles.quote}>
          « {markedParts(t(quote)).map((part, i) => <Text key={i} style={part.marked ? styles.hit : undefined}>{part.text}</Text>)} »
        </Text>
      </View>
    </Card>)}
  </>;
}

const makeSearchStyles = ({ colors }: Theme) => StyleSheet.create({
  bar: { left: 20, right: 20, top: 14, height: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 10 },
  query: { flexShrink: 1, fontSize: 16, fontWeight: "600", color: colors.textMain },
  caret: { width: 2, height: 22, borderRadius: 1, backgroundColor: colors.primary, marginLeft: -8 },
  count: { marginLeft: "auto", fontSize: 12.5, color: colors.textSubtle },
  result: { left: 20, right: 20, height: 92, paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  resultText: { flex: 1, minWidth: 0 },
  resultHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.textMain },
  at: { flexDirection: "row", alignItems: "center", gap: 4, height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: colors.surfaceContainer },
  atText: { fontSize: 11.5, fontWeight: "600", color: colors.textMain },
  quote: { marginTop: 4, fontSize: 13, lineHeight: 18, color: colors.textSubtle },
  hit: { backgroundColor: "rgba(255, 203, 5, 0.3)", color: colors.textMain, fontWeight: "600" },
});

// ---------------------------------------------------------------------------
// 4 — Everywhere: the web app on a laptop, the app on a phone.
// ---------------------------------------------------------------------------
const LAPTOP_COVER = "#3d4a6b";
const PHONE_COVERS = ["#b88a3e", "#4f6b5a"];

export function EverywhereArt() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeEverywhereStyles);
  return <>
    <View style={styles.laptop}>
      <View style={styles.screen}>
        <View style={styles.toolbar}>
          <View style={styles.logo} /><Bar width={34} height={5} /><Bar width={34} height={5} /><Bar width={34} height={5} />
        </View>
        <View style={styles.panes}>
          <View style={styles.leftPane}>
            <View style={[styles.cover, { backgroundColor: LAPTOP_COVER }]} />
            <Bar width={60} height={5} /><Bar width={50} height={5} /><Bar width={64} height={5} />
          </View>
          <View style={styles.mainPane}>
            <Bar width="80%" height={5} /><Bar width="60%" height={5} />
            <View style={styles.bubble} />
            <Bar width="70%" height={5} />
          </View>
          <View style={styles.rightPane}>{[0, 1, 2, 3].map((i) => <View key={i} style={styles.chip} />)}</View>
        </View>
      </View>
    </View>
    <View style={styles.base} />
    <View style={styles.phone}>
      <View style={styles.phoneScreen}>
        <Bar width={50} height={6} color={colors.textMain} />
        <View style={[styles.phoneCover, { backgroundColor: PHONE_COVERS[0] }]} />
        <Bar width="80%" height={5} />
        <View style={[styles.phoneCover, { backgroundColor: PHONE_COVERS[1] }]} />
        <Bar width="70%" height={5} />
      </View>
    </View>
    <View style={styles.caption}>
      <Ionicons name="desktop-outline" size={16} color={colors.textSubtle} />
      <Text style={styles.captionText}>{t("welcome.art.platforms")}</Text>
    </View>
  </>;
}

const makeEverywhereStyles = ({ colors }: Theme) => StyleSheet.create({
  laptop: { position: "absolute", left: 28, top: 62, width: 310, height: 200, borderRadius: 14, backgroundColor: "#2b2d42", padding: 8 },
  screen: { flex: 1, borderRadius: 7, backgroundColor: colors.background, overflow: "hidden" },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 6, height: 22, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainer },
  logo: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  panes: { flex: 1, flexDirection: "row", gap: 6, padding: 8 },
  leftPane: { width: 70, gap: 6 },
  cover: { width: 70, height: 42, borderRadius: 6 },
  mainPane: { flex: 1, gap: 6, backgroundColor: colors.surface, borderRadius: 6, padding: 8 },
  bubble: { marginLeft: "auto", width: "60%", height: 16, borderRadius: 6, backgroundColor: colors.surfaceContainerHigh },
  rightPane: { width: 58, gap: 5 },
  chip: { height: 14, borderRadius: 7, backgroundColor: colors.highlight },
  base: { position: "absolute", left: 8, top: 262, width: 350, height: 12, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, backgroundColor: "#c9c4bf" },
  phone: { position: "absolute", left: 282, top: 118, width: 104, height: 212, borderRadius: 22, backgroundColor: "#1c1b1a", padding: 5,
    shadowColor: "#2b2d42", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 4 },
  phoneScreen: { flex: 1, borderRadius: 17, backgroundColor: colors.background, paddingTop: 18, paddingHorizontal: 8, paddingBottom: 8, gap: 6 },
  phoneCover: { height: 52, borderRadius: 8 },
  caption: { position: "absolute", left: 0, right: 0, top: 350, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  captionText: { fontSize: 13, color: colors.textSubtle },
});

