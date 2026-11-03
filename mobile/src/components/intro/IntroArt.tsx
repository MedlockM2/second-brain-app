import type { ReactNode } from "react";
import { Image, Platform, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useThemedStyles } from "../../contexts/ThemeContext";
import type { Theme } from "../../constants/theme";
import { t } from "../../i18n";
import { ART_WIDTH, Bar } from "./artKit";

type IconName = keyof typeof Ionicons.glyphMap;

/** The app's real icon (rendered from `web/public/favicon.svg` by `mobile/scripts/make_icons.py`), not an Ionicons glyph. */
// Metro resolves images through `require`; the app declares no `*.png` module type to import it with.
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const APP_ICON: ImageSourcePropType = require("../../../assets/icon.png");

const IS_ANDROID = Platform.OS === "android";

// ---------------------------------------------------------------------------
// The apps that can share to Deepn, as each system draws them. The list follows
// SHARE_TARGETS (`core/media_ingestion/adapters/share_targets.py`): no Apple
// Podcasts on Android, Chrome and Keep instead of Safari and Notes.
// ---------------------------------------------------------------------------
const TILES: Record<string, ImageSourcePropType> = IS_ANDROID ? {
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

/** The system's share glyph: square and arrow on iOS, three linked dots on Android. */
export const SHARE_ICON: IconName = IS_ANDROID ? "share-social-outline" : "share-outline";

/** « Works with » between two hairlines, then every app that shares to Deepn. */
export function WorksWith() {
  const styles = useThemedStyles(makeWorksWithStyles);
  return <View style={styles.block}>
    <View style={styles.legend}>
      <View style={styles.hairline} />
      <Text style={styles.legendText}>{t("intro.worksWith")}</Text>
      <View style={styles.hairline} />
    </View>
    <View style={styles.tiles}>{Object.entries(TILES).map(([key, source]) => <Image key={key} source={source} style={styles.tile} />)}</View>
  </View>;
}

const makeWorksWithStyles = ({ colors }: Theme) => StyleSheet.create({
  block: { marginTop: 22, alignSelf: "stretch" },
  legend: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  hairline: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant },
  legendText: { fontSize: 12, color: colors.textSubtle },
  tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  tile: { width: 28, height: 28 },
});

// ---------------------------------------------------------------------------
// Page 1 — the system share sheet, Deepn singled out (after Readwise Reader),
// shown where it lives: on a phone, over the app it was opened from (YouTube,
// dimmed under the system's scrim). The phone's frame is the border between the
// example and the intro screen (TestFlight feedback ADZeDymcOHjaBxBEw0v01wY,
// mockup `mobile-design-mockups/onboarding_frontiere_partage`): a sheet drawn
// straight on the screen measured 1.06:1 against it in dark mode. The frame is
// page 2's phone (#1c1b1a), with a titanium edge so it still reads on a dark
// screen; the sheet and YouTube take the system's and YouTube's colours, not
// Deepn's, since that is what the person will see.
// What is drawn is what the system shows: Deepn's own icon in the row of apps,
// named « Deepn » (what an iPhone displays, as the owner checked). The app has no
// action extension, so no « Save to Deepn » row is invented. Everything else is
// dimmed, its labels reduced to bars so no fake app name needs translating: the
// eye goes to the one icon to touch. The people row is left out: drawn inside
// the phone it would push the row of apps under the button's fade. The phone
// runs off the bottom of the screen, where the intro fades it out.
// ---------------------------------------------------------------------------
const VIDEO_FILL = "#3d4a6b";
const DIM = 0.32;

/** Phone frame, in the 414-point art box; its screen is drawn at `SCREEN_DRAWN` points wide and scaled in. */
const PHONE = { width: 340, height: 720, bezel: 9, top: 8 };
const SCREEN_WIDTH = PHONE.width - 2 * PHONE.bezel;
const SCREEN_DRAWN = 392;
const SCREEN_SCALE = SCREEN_WIDTH / SCREEN_DRAWN;

/** Colours that are the device's, the system's or YouTube's — not the design system's. */
const DEVICE_COLORS = {
  light: { bezel: "#1c1b1a", bezelEdge: "#3d3a36", sheet: "#ffffff", line: "#ececec", chip: "#e9e9eb", page: "#ffffff", pageBar: "#e5e5e5" },
  dark: { bezel: "#0b0a09", bezelEdge: "#5a544c", sheet: "#1c1c1e", line: "#2c2c2e", chip: "#3a3a3c", page: "#0f0f0f", pageBar: "#272727" },
} as const;

export function ShareSheetArt() {
  const { colors, mode } = useTheme();
  const device = DEVICE_COLORS[mode];
  const styles = useThemedStyles(makeSheetStyles);
  const tileRadius = (size: number) => (IS_ANDROID ? size / 2 : Math.round(size * 0.23));
  const plain = (background: string, color: string, icon: IconName) =>
    <View style={[styles.tile, { backgroundColor: background, borderRadius: tileRadius(56) }]}><Ionicons name={icon} size={28} color={color} /></View>;
  const image = (source: ImageSourcePropType) => <Image source={source} style={[styles.tile, { borderRadius: tileRadius(56) }]} />;
  const dimmedApp = (key: string, tile: ReactNode) => <View key={key} style={[styles.app, { opacity: DIM }]}>{tile}<Bar width={36} height={5} color={device.chip} /></View>;
  const others = IS_ANDROID
    ? [dimmedApp("messages", plain("#1a73e8", "#fff", "chatbubble-outline")), dimmedApp("gmail", plain("#fff", "#ea4335", "mail-outline")),
      dimmedApp("keep", image(TILES.googlekeep)), dimmedApp("drive", plain("#fff", "#188038", "cloud-upload-outline"))]
    : [dimmedApp("messages", plain("#34c759", "#fff", "chatbubble-outline")), dimmedApp("mail", plain("#1f8bff", "#fff", "mail-outline")),
      dimmedApp("notes", image(TILES.notes)), dimmedApp("more", plain(device.chip, colors.textSubtle, "ellipsis-horizontal"))];
  const actions: [IconName, number][] = IS_ANDROID
    ? [["copy-outline", 120], ["open-outline", 170], ["download-outline", 96]]
    : [["copy-outline", 120], ["book-outline", 196], ["heart-outline", 150], ["search-outline", 170]];
  const rule = <View style={[styles.rule, { backgroundColor: device.line }]} />;
  return <View style={[styles.phone, { backgroundColor: device.bezel, borderColor: device.bezelEdge, borderRadius: IS_ANDROID ? 40 : 50 }]}>
    <View style={[styles.screen, { borderRadius: IS_ANDROID ? 32 : 41 }]}>
      <View style={[styles.drawn, { backgroundColor: device.page }]}>
        {/* The app the sheet was opened from: a YouTube video page, under the system's scrim. */}
        <View style={{ height: IS_ANDROID ? 40 : 54 }} />
        <View style={styles.video}><Ionicons name="play-circle-outline" size={54} color="#fff" /></View>
        <View style={styles.videoText}>
          <Bar width="86%" height={9} color={device.pageBar} />
          <Bar width="54%" height={9} color={device.pageBar} />
          <View style={styles.channel}><View style={[styles.channelAvatar, { backgroundColor: device.pageBar }]} /><Bar width="30%" height={9} color={device.pageBar} /></View>
        </View>
        <View style={styles.scrim} />
        <View style={[styles.sheet, IS_ANDROID ? styles.sheetAndroid : styles.sheetIos, { backgroundColor: device.sheet }]}>
          {IS_ANDROID && <View style={styles.handle} />}
          <View style={styles.head}>
            <View style={styles.thumb}><Ionicons name="play-circle-outline" size={20} color="#fff" /></View>
            <View style={styles.headText}>
              <Text numberOfLines={1} style={styles.headTitle}>{t("welcome.art.videoTitle")}</Text>
              <Text numberOfLines={1} style={styles.headDetail}>youtube.com</Text>
            </View>
            {!IS_ANDROID && <View style={[styles.close, { backgroundColor: device.line }]}><Ionicons name="close" size={16} color={colors.textSubtle} /></View>}
          </View>
          {rule}
          <View style={styles.apps}>
            <View style={styles.app}>
              <View>
                <View style={[styles.ring, { borderRadius: IS_ANDROID ? 34 : 19 }]} />
                <Image source={APP_ICON} style={[styles.tile, { borderRadius: tileRadius(56) }]} />
              </View>
              <Text numberOfLines={1} style={styles.appLabel}>Deepn</Text>
            </View>
            {others}
          </View>
          {rule}
          <View style={{ opacity: DIM }}>
            {actions.map(([icon, width], n) => <View key={icon} style={[styles.action, n > 0 && { borderTopWidth: 1, borderTopColor: device.line }]}>
              <Ionicons name={icon} size={18} color={colors.textMain} /><Bar width={width} height={6} color={device.chip} />
            </View>)}
          </View>
        </View>
      </View>
      {IS_ANDROID ? <View style={styles.camera} /> : <View style={styles.island} />}
    </View>
  </View>;
}

const makeSheetStyles = ({ colors }: Theme) => StyleSheet.create({
  phone: { position: "absolute", left: (ART_WIDTH - PHONE.width) / 2, top: PHONE.top, width: PHONE.width, height: PHONE.height, padding: PHONE.bezel,
    borderWidth: 1.5, shadowColor: "#000", shadowOffset: { width: 0, height: 30 }, shadowOpacity: 0.22, shadowRadius: 30, elevation: 8 },
  screen: { flex: 1, overflow: "hidden" },
  // The screen keeps the mockup's 392-point layout, scaled from its top-left corner into the frame.
  drawn: { position: "absolute", left: 0, top: 0, width: SCREEN_DRAWN, height: PHONE.height / SCREEN_SCALE, transform: [{ scale: SCREEN_SCALE }], transformOrigin: "left top" },
  video: { height: 220, backgroundColor: VIDEO_FILL, alignItems: "center", justifyContent: "center" },
  videoText: { paddingVertical: 16, paddingHorizontal: 14, gap: 10 },
  channel: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  channelAvatar: { width: 34, height: 34, borderRadius: 17 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.42)" },
  island: { position: "absolute", left: SCREEN_WIDTH / 2 - 48, top: 10, width: 96, height: 28, borderRadius: 16, backgroundColor: "#000" },
  camera: { position: "absolute", left: SCREEN_WIDTH / 2 - 6, top: 13, width: 12, height: 12, borderRadius: 6, backgroundColor: "#000" },
  sheet: { position: "absolute", top: 196, overflow: "hidden" },
  sheetIos: { left: 6, right: 6, bottom: 0, borderRadius: 30 },
  sheetAndroid: { left: 0, right: 0, bottom: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.outlineVariant, alignSelf: "center", marginTop: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12 },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: VIDEO_FILL, alignItems: "center", justifyContent: "center" },
  headText: { flex: 1, minWidth: 0 },
  headTitle: { fontSize: 14, fontWeight: "600", color: colors.textMain },
  headDetail: { fontSize: 12, color: colors.textSubtle },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  rule: { height: 1 },
  apps: { flexDirection: "row", justifyContent: "space-between", paddingTop: 14, paddingHorizontal: 10, paddingBottom: 12 },
  app: { width: 70, alignItems: "center", gap: 8 },
  tile: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", left: -6, top: -6, right: -6, bottom: -6, borderWidth: 2.5, borderColor: colors.primary },
  appLabel: { fontSize: 11.5, fontWeight: "700", color: colors.textMain },
  action: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
});

// ---------------------------------------------------------------------------
// Page 2 — Everywhere: the web app on a laptop, the app on a phone.
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
});
