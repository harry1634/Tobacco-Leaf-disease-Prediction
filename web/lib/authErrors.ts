// Turns Firebase error codes into messages a user can act on.
const messages: Record<string, string> = {
  "auth/email-already-in-use": "An account with this email already exists. Try logging in instead.",
  "auth/invalid-email": "That email address is not valid.",
  "auth/weak-password": "Password is too weak. Use at least 8 characters.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/network-request-failed": "Network error. Check your internet connection and try again.",
  "auth/operation-not-allowed": "Email/password sign-in is not enabled in the Firebase console.",
};

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  return (code && messages[code]) || "Something went wrong. Please try again.";
}
