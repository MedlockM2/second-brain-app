import { requireOptionalNativeModule } from "expo";

export type GoogleCredentialManagerResult =
  | { type: "success"; idToken: string }
  | { type: "cancelled" }
  | { type: "noGoogleAccount" };

interface GoogleCredentialManagerNativeModule {
  signInAsync(serverClientId: string, nonce: string): Promise<GoogleCredentialManagerResult>;
}

// Android only; optional so iOS and older binaries can still load the JS bundle.
const nativeModule = requireOptionalNativeModule<GoogleCredentialManagerNativeModule>("GoogleCredentialManager");

export async function signInWithGoogleAsync(serverClientId: string, nonce: string): Promise<GoogleCredentialManagerResult> {
  if (!nativeModule) throw new Error("GoogleCredentialManager requires a new Android binary");
  return nativeModule.signInAsync(serverClientId, nonce);
}
