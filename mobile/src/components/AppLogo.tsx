import { Image, StyleSheet, View } from "react-native";
import { APP_ICON } from "./intro/IntroArt";

/**
 * The app's logo as its icon: the real `assets/icon.png` (rendered from
 * `web/public/favicon.svg`), not an Ionicons glyph, in the « glass edge » finish
 * the owner chose for the sign-in screen (texture E, mockup
 * `mobile-design-mockups/onboarding_apres_connexion`): flat amber and the plain
 * glyph, one edge of light along the top and a very thin light rim, as the glass
 * of iOS 26 icons catches it, over one soft neutral shadow. No sheen, no halo.
 *
 * The rim is an overlay above the image: an inset shadow on the frame itself
 * would be painted under it.
 */
export function AppLogo({ size = 92 }: { size?: number }) {
  const radius = Math.round(size * 0.23);
  return <View style={[styles.frame, { width: size, height: size, borderRadius: radius }]}>
    <Image source={APP_ICON} style={{ width: size, height: size, borderRadius: radius }} accessibilityIgnoresInvertColors />
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rim, { borderRadius: radius }]} />
  </View>;
}

const styles = StyleSheet.create({
  frame: { boxShadow: "0px 1px 1px rgba(28, 27, 26, 0.04), 0px 12px 24px -14px rgba(28, 27, 26, 0.28)" },
  rim: { boxShadow: "inset 0px 1px 0px rgba(255, 255, 255, 0.55), inset 0px 0px 0px 1px rgba(255, 255, 255, 0.22)" },
});
