export function authErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("Add these Firebase web values")) {
    return error.message;
  }

  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/email-already-in-use":
      return "An account already exists for this email. Try signing in instead.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "That email and password don't match. Please try again.";
    case "auth/weak-password":
      return "Choose a stronger password with at least 8 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Connection trouble. Check your internet and try again.";
    default:
      return error instanceof Error ? error.message : "Something went wrong. Please try again.";
  }
}
