# Solace

Solace is a personal home for memories, built with Next.js, TypeScript, Tailwind CSS, Firebase Authentication, and Cloud Firestore.

## Local setup

1. Use Node.js 20.9 or newer.
2. Run `npm install`.
3. Keep Firebase values in `.env.local`; use `.env.example` as a checklist. Never commit `.env.local` or share a service account private key.
4. In Firebase Console, enable Email/Password sign-in and create a Cloud Firestore database.
5. Start the app with `npm run dev` and open <http://localhost:3000>.

## Useful commands

- `npm run lint` — lint the project.
- `npm run typecheck` — check TypeScript.
- `npm test` — run the auth validation tests.
- `npm run test:rules` — run Firestore rules tests in the local emulator.
- `npm run build` — create a production build.

Deploy Firestore rules after signing in to the Firebase CLI:

```powershell
npx --yes firebase-tools deploy --only firestore:rules,firestore:indexes --project solace-5d481
```
