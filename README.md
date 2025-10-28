# Pickleball Live (Firebase Edition)

A low-cost, low-ops scoreboard for Group A/B schedules, live standings, and admin score entry. Built on **Firebase Hosting + Auth + Firestore**.

## 1) Prerequisites
- Node 18+
- `npm i -g firebase-tools` then `firebase login`
- Firebase project with Hosting, Authentication, and Firestore enabled.

## 2) Configure
1. Copy `.env.example` → `.env` and fill your Firebase web config values.
2. Update `.firebaserc` with your project id.
3. Deploy Firestore rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

## 3) Seed data
Use the Firebase Console (Firestore Data) to add:
- **groups**: docs for `Group A`, `Group B` (fields: `name`)
- **teams**: each with `groupId`, `code` (A1..A5/B1..B5), `name`
- **matches**: fields `groupId, round, slot, court, startTime, endTime, team1Id, team2Id, status='scheduled'`

> Tip: You can also write a small Admin SDK script to import JSON; keep service credentials private.

## 4) Make an Editor
Set a custom claim `role=editor` for your user via Admin SDK (run locally):
```js
import admin from 'firebase-admin';
admin.initializeApp();
await admin.auth().setCustomUserClaims('<UID>', { role: 'editor' });
```
Sign out/in to refresh the token; the header will show **Editor**.

## 5) Run & Deploy
```bash
npm install
npm run dev        # local dev at http://localhost:5173
npm run build
firebase deploy --only hosting,firestore:rules
```

## 6) Using the app
- **Group A / Group B** tabs: live schedule with court colors & winner highlights
- **Standings**: computed client-side (Wins → Diff → PF)
- **Admin**: editors can enter scores inline; updates broadcast instantly via Firestore listeners.

## Notes
- Keep it simple at first; add Cloud Functions only if you need server-side validation.
- Hosting, Auth, and Firestore have generous free quotas on Firebase's free tier for small apps.
