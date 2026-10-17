import { Redirect } from "expo-router";
// Live browser sessions are completed by expo-auth-session. A cold/stale callback
// contains no session to adopt; it must start a fresh authorization request.
export default function AuthCallback() { return <Redirect href="/(auth)/login" />; }
