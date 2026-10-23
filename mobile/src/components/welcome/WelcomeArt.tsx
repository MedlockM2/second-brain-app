import { Image, Platform, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useThemedStyles } from "../../contexts/ThemeContext";
import type { Theme } from "../../constants/theme";
import { t, type TranslationKey } from "../../i18n";
import { Bar, Card, CardHead, Dashes, Glow } from "./artKit";

type IconName = keyof typeof Ionicons.glyphMap;

// ---------------------------------------------------------------------------
// 1 — Depth: the sources fanned at the back, their text in the middle, what it
// becomes in front. Each source wears the fill of its media-type badge in the
// app (`src/lib/mediaTypeDisplay.ts`); video and podcast, the rare ones, sit at
// the centre; the edges run off the screen and fade: the list goes on.
// ---------------------------------------------------------------------------
type Source = "video" | "podcast" | "short" | "audio" | "photo" | "article" | "pdf" | "link";
const SOURCE: Record<Source, { fill: keyof Theme["colors"]; icon: IconName; label: TranslationKey }> = {
  video: { fill: "errorContainer", icon: "play-circle-outline", label: "welcome.art.video" },
  podcast: { fill: "primary", icon: "headset-outline", label: "welcome.art.podcast" },
  short: { fill: "shortVideoContainer", icon: "play-circle-outline", label: "welcome.art.short" },
  audio: { fill: "audioContainer", icon: "mic-outline", label: "welcome.art.audio" },
  photo: { fill: "imagePostContainer", icon: "images-outline", label: "welcome.art.photo" },
  article: { fill: "articleContainer", icon: "document-text-outline", label: "welcome.art.article" },
  pdf: { fill: "surfaceContainerHigh", icon: "reader-outline", label: "welcome.art.pdf" },
  link: { fill: "surfaceContainerHigh", icon: "link-outline", label: "welcome.art.link" },
};
// [source, centre x, top, rotation, opacity]
const FAN: [Source, number, number, number, number][] = [
  ["pdf", -61, 66, -15, 0.3], ["audio", 17, 44, -11, 0.45], ["article", 93, 24, -7, 1], ["video", 169, 10, -3, 1],
  ["podcast", 245, 10, 3, 1], ["short", 321, 24, 7, 1], ["photo", 397, 44, 11, 0.45], ["link", 475, 66, 15, 0.3],
];

export function DepthArt() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeDepthStyles);
  // Outer cards first, so the centre ones are drawn on top.
  const fan = [...FAN].sort((a, b) => Math.abs(b[1] - 207) - Math.abs(a[1] - 207));
  const lines = (widths: `${number}%`[]) => <View style={styles.lines}>{widths.map((w, i) => <Bar key={i} width={w} />)}</View>;
  return <>
    <Glow top={96} height={260} />
    {FAN.slice(1, 7).map(([key, x, y]) => <Dashes key={key} from={[x, y + 88]} c1={[x, y + 116]} c2={[207, 128]} to={[207, 152]} />)}
    {[30, 136, 278, 384].map((x) => <Dashes key={x} from={[207, 262]} c1={[207, 276]} c2={[x, 274]} to={[x, 290]} />)}
    {fan.map(([key, x, y, rotation, opacity]) => {
      const source = SOURCE[key];
      const ink = key === "podcast" ? colors.onPrimary : colors.textMain;
      return <View key={key} style={[styles.source, { left: x - 39, top: y, opacity, backgroundColor: colors[source.fill],
        transform: [{ rotate: `${rotation}deg` }] }]}>
        <Ionicons name={source.icon} size={28} color={ink} />
        <Text numberOfLines={1} style={[styles.sourceLabel, { color: ink }]}>{t(source.label)}</Text>
      </View>;
    })}
    <Card style={styles.callout}>
      <CardHead icon="color-wand-outline" label={t("welcome.art.extracted")} />
      <Text style={styles.quote}>
        {t("welcome.art.quoteStart")}
        <Text style={styles.highlight}>{t("welcome.art.quoteHighlight")}</Text>
        {t("welcome.art.quoteEnd")}
      </Text>
    </Card>
    {/* The faded cards at the edges show their title on the visible side. */}
    <Card style={[styles.use, styles.edge, { left: -62, alignItems: "flex-end" }]}>
      <CardHead icon="reader-outline" label={t("welcome.art.summary")} size={20} />
      {lines(["90%", "100%", "70%", "85%"])}
    </Card>
    <Card style={[styles.use, styles.edge, { left: 340 }]}>
      <CardHead icon="copy-outline" label={t("welcome.art.cards")} size={20} />
      {lines(["80%", "95%", "60%"])}
    </Card>
    <Card style={[styles.use, { left: 68 }]}>
      <CardHead icon="chatbubbles-outline" label={t("welcome.art.chat")} />
      <View style={styles.question}><Text style={styles.questionText}>{t("welcome.art.chatQuestion")}</Text></View>
      <View style={styles.thinking}>
        <Text numberOfLines={1} style={styles.thinkingText}>{t("welcome.art.chatThinking")}</Text>
        {[1, 0.6, 0.3].map((o) => <View key={o} style={[styles.dot, { opacity: o }]} />)}
      </View>
    </Card>
    <Card style={[styles.use, { left: 210 }]}>
      <CardHead icon="school-outline" label={t("welcome.art.quiz")} />
      <Text style={styles.quizQuestion}>{t("welcome.art.quizQuestion")}</Text>
      <View style={styles.answers}>
        <View style={[styles.answer, styles.answerWrong]}><Text numberOfLines={1} style={styles.answerText}>{t("welcome.art.quizWrong")}</Text></View>
        <View style={[styles.answer, styles.answerRight]}><Text numberOfLines={1} style={[styles.answerText, styles.answerRightText]}>{t("welcome.art.quizRight")}</Text></View>
      </View>
    </Card>
  </>;
}

const makeDepthStyles = ({ colors }: Theme) => StyleSheet.create({
  source: { position: "absolute", width: 78, height: 84, borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 6,
    shadowColor: "#2b2d42", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  sourceLabel: { fontSize: 12, fontWeight: "700", paddingHorizontal: 4 },
  callout: { left: 30, right: 30, top: 152, paddingVertical: 14, paddingLeft: 20, paddingRight: 16, gap: 8,
    borderTopLeftRadius: 4, borderBottomLeftRadius: 4, borderLeftWidth: 4, borderLeftColor: colors.primary },
  quote: { fontSize: 14.5, lineHeight: 22, fontStyle: "italic", color: colors.textMain },
  highlight: { backgroundColor: "rgba(255, 203, 5, 0.3)" },
  use: { top: 290, width: 136, height: 122, paddingVertical: 10, paddingHorizontal: 12, gap: 6 },
  edge: { opacity: 0.45, paddingHorizontal: 8 },
  lines: { gap: 7, marginTop: 4, alignSelf: "stretch" },
  question: { backgroundColor: colors.textMain, borderRadius: 14, borderBottomRightRadius: 4, paddingVertical: 6, paddingHorizontal: 10 },
  questionText: { color: colors.background, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  thinking: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.surfaceContainer,
    borderRadius: 14, borderBottomLeftRadius: 4, paddingVertical: 6, paddingHorizontal: 8, maxWidth: "100%" },
  thinkingText: { fontSize: 11, fontStyle: "italic", color: colors.textSubtle, flexShrink: 1, marginRight: 2 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textSubtle },
  quizQuestion: { fontSize: 12, lineHeight: 16, fontWeight: "700", color: colors.textMain },
  answers: { flexDirection: "row", gap: 6, marginTop: 2 },
  answer: { height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  answerWrong: { flex: 1, borderWidth: 1, borderColor: colors.outlineVariant },
  answerRight: { flex: 1.5, borderWidth: 1.5, borderColor: colors.success, backgroundColor: colors.successTint },
  answerText: { fontSize: 11.5, color: colors.textMain },
  answerRightText: { color: colors.success, fontWeight: "700" },
});

// ---------------------------------------------------------------------------
// 2 — Two gestures: share from another app, or add from the phone (the rows of
// `AddSourceSheet`). Each system shows its own share icon and its own app list:
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
    <View style={styles.halo}><Ionicons name={icon} size={19} color={colors.textMain} /></View>
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
        <View style={styles.mark}><Ionicons name="layers-outline" size={22} color={colors.onPrimary} /></View>
      </View>
      <View style={styles.tiles}>{Object.entries(TILES).map(([key, source]) => <Image key={key} source={source} style={styles.smallTile} />)}</View>
    </Card>
    <Card style={styles.bottom}>
      {caps("add", "welcome.art.fromPhone")}
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
  bottom: { left: 20, right: 20, top: 176, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 8 },
  caps: { flexDirection: "row", alignItems: "center", gap: 6 },
  capsText: { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.8, color: colors.textSubtle },
  gesture: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, marginBottom: 14 },
  bigTile: { width: 44, height: 44 },
  pill: { flexDirection: "row", alignItems: "center", gap: 7, height: 34, paddingLeft: 11, paddingRight: 14, borderRadius: 999,
    backgroundColor: colors.surface, flexShrink: 1 },
  pillText: { fontSize: 14, fontWeight: "700", color: colors.textMain, flexShrink: 1 },
  mark: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  smallTile: { width: 28, height: 28 },
  rows: { marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 7 },
  halo: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.highlight, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: "600", color: colors.textMain },
  rowDetail: { fontSize: 12, color: colors.textSubtle },
});

// ---------------------------------------------------------------------------
// 3 — A whole folder: its sources, and one question asked to all of them.
// ---------------------------------------------------------------------------
const COVERS: { title: TranslationKey; type: TranslationKey; color: string; icon: IconName }[] = [
  { title: "welcome.art.cover1", type: "welcome.art.cover1Type", color: "#3d4a6b", icon: "play-circle-outline" },
  { title: "welcome.art.cover2", type: "welcome.art.cover2Type", color: "#b88a3e", icon: "document-text-outline" },
  { title: "welcome.art.cover3", type: "welcome.art.cover3Type", color: "#4f6b5a", icon: "headset-outline" },
];

export function FolderArt() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeFolderStyles);
  return <>
    <Card style={styles.folder}>
      <View style={styles.head}>
        <View style={styles.halo}><Ionicons name="folder-outline" size={21} color={colors.textMain} /></View>
        <View>
          <Text style={styles.name}>{t("welcome.art.folderName")}</Text>
          <Text style={styles.count}>{t("welcome.art.folderCount")}</Text>
        </View>
      </View>
      {COVERS.map((cover) => <View key={cover.title} style={styles.item}>
        <View style={[styles.thumb, { backgroundColor: cover.color }]}><Ionicons name={cover.icon} size={15} color="#fff" /></View>
        <View style={styles.itemText}>
          <Text numberOfLines={1} style={styles.itemTitle}>{t(cover.title)}</Text>
          <Text numberOfLines={1} style={styles.itemType}>{t(cover.type)}</Text>
        </View>
      </View>)}
    </Card>
    <View style={styles.composer}>
      <Text numberOfLines={1} style={styles.placeholder}>{t("welcome.art.askFolder")}</Text>
      <View style={styles.send}><Ionicons name="arrow-up" size={20} color={colors.onPrimary} /></View>
    </View>
  </>;
}

const makeFolderStyles = ({ colors }: Theme) => StyleSheet.create({
  folder: { left: 30, right: 30, top: 20, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  halo: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.highlight, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 16, fontWeight: "700", color: colors.textMain },
  count: { fontSize: 12.5, color: colors.textSubtle },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.surfaceContainer },
  thumb: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  itemText: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 13, fontWeight: "700", color: colors.textMain },
  itemType: { fontSize: 12, color: colors.textSubtle },
  composer: { position: "absolute", left: 30, right: 30, top: 296, height: 52, borderRadius: 26, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: "row", alignItems: "center", paddingLeft: 18, paddingRight: 6 },
  placeholder: { flex: 1, fontSize: 14.5, color: colors.textMuted },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});

// ---------------------------------------------------------------------------
// 4 — Everywhere: the web app on a laptop, the app on a phone.
// ---------------------------------------------------------------------------
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
            <View style={[styles.cover, { backgroundColor: COVERS[0].color }]} />
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
        <View style={[styles.phoneCover, { backgroundColor: COVERS[1].color }]} />
        <Bar width="80%" height={5} />
        <View style={[styles.phoneCover, { backgroundColor: COVERS[2].color }]} />
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

