# Getting LinkUpNaija into the stores

Everything in the repo is done. What is left is accounts, keys and two
installs, and all of it is on your side because it needs your identity or a
download I cannot run for you.

Do them in this order. Android is first because it is where your members
are, it is cheaper, and it is the one most likely to be approved.

---

## Before anything: the constraint on this Mac

This machine is a MacBook Pro 13" from 2017. It runs macOS 13 Ventura and
cannot be upgraded further, because Sonoma and everything after it need a
2018 model or newer. Ventura caps out at Xcode 15.2, and since April 2026
Apple has refused any App Store upload not built with Xcode 26.

So **iOS can never be built on this laptop**. That is not a setup problem to
work around; the machine is finished for that purpose. The workflow at
`.github/workflows/ios-testflight.yml` builds iOS on a hosted Mac instead, so
you do not need to buy hardware.

**Android builds here perfectly well.** Skip the emulator (8GB of RAM will
make it crawl) and plug a real Android phone in over USB.

---

## 1. Play Console - do this first

Costs $25, once. The account is usually usable immediately.

1. Go to <https://play.google.com/console/signup> and sign up as an
   organisation, using the LinkUpNaija business details.
2. Create an app. Name **LinkUpNaija**, default language **English (Nigeria)**,
   type **App**, **Free**.
3. Leave the listing half-finished for now. The piece you need next is the
   signing key, and that only appears after a first upload.

## 2. Android Studio

1. Download from <https://developer.android.com/studio>. Take the
   **Intel** build, not Apple silicon.
2. Open it once and let it install the SDK it asks for.
3. In this project, run:

   ```
   npm run app:android
   ```

   That opens the Android project in Android Studio.
4. Put your phone in developer mode (Settings → About phone → tap Build
   number seven times → back → Developer options → USB debugging), plug it
   in, and press Run. The app should open on your phone showing the live
   site with no browser bar.

   **This is the moment to check it properly.** Tap around. Try the back
   button from a deep page; it should walk back rather than close the app.
   Turn airplane mode on and relaunch; you should get the "No connection"
   screen rather than a white rectangle.

## 3. First upload, then the fingerprint

1. In Android Studio: **Build → Generate Signed App Bundle**. Create a new
   keystore when asked. **Back that keystore file up somewhere you will
   still have in three years** - losing it means you can never update the
   app again under the same listing, and there is no recovery.
2. Upload the `.aab` to Play Console under **Testing → Internal testing**.
3. Now go to **Setup → App signing**. Copy the **SHA-256 certificate
   fingerprint** under "App signing key certificate". It is the long
   colon-separated hex string.

   Take it from **App signing key**, not **Upload key**. Using the upload
   key's fingerprint is the usual reason deep links work in testing and
   silently fail in production.
4. Put it in Vercel as an environment variable:

   ```
   ANDROID_CERT_SHA256 = AB:CD:EF:...
   ```

   Redeploy. Then check it is live:

   ```
   curl https://www.linkupnaija.com/.well-known/assetlinks.json
   ```

   The fingerprint should be in the response. Until it is, tapping a
   linkupnaija.com link opens the browser rather than the app.

## 4. Firebase - this is what turns push on

Free. Covers both platforms, because Firebase relays to Apple once the APNs
key is uploaded.

1. <https://console.firebase.google.com> → add a project, name it
   **LinkUpNaija**. Google Analytics is optional; you already have GA4 on
   the site.
2. Add an **Android** app. Package name exactly:

   ```
   com.linkupnaija.app
   ```

   Download `google-services.json` and put it at `android/app/google-services.json`.
   It is already gitignored, so it will not be committed.
3. **Project settings → Service accounts → Generate new private key.** That
   downloads a JSON file containing a private key.
4. Paste the **entire contents of that file** into Supabase as a secret named
   `FCM_SERVICE_ACCOUNT`:

   Supabase Dashboard → Edge Functions → Secrets → Add new secret.

   Push starts working the moment this exists. Without it the native send is
   skipped and web push carries on as before, so nothing breaks in the
   meantime.

## 5. Apple Developer - start it now, finish it later

$99 a year. Enrolment can take several days, which is why it is worth
starting before you need it.

1. <https://developer.apple.com/programs/enroll/>. Enrol as an organisation
   if you have the business registration; it needs a D-U-N-S number and
   takes longer. As an individual it is quicker but your personal name
   appears as the seller on the App Store.
2. Once in: **Membership** → copy your **Team ID** (ten characters).
3. Put it in Vercel:

   ```
   APPLE_TEAM_ID = ABCDE12345
   ```

   Redeploy, then confirm:

   ```
   curl https://www.linkupnaija.com/.well-known/apple-app-site-association
   ```

   It should show your real team ID, not `TEAMID`.

## 6. The App Store Connect key, for the build pipeline

1. <https://appstoreconnect.apple.com> → **Users and Access → Integrations →
   App Store Connect API** → generate a key with the **App Manager** role.
2. Download the `.p8`. **You get one download and no second chance.**
3. Note the **Key ID** and the **Issuer ID** from the same page.
4. In GitHub → your repo → **Settings → Secrets and variables → Actions**,
   add four secrets:

   | Name | Value |
   |---|---|
   | `ASC_KEY_ID` | the Key ID |
   | `ASC_ISSUER_ID` | the Issuer ID |
   | `ASC_KEY_P8` | the .p8 file, base64 encoded |
   | `APPLE_TEAM_ID` | your Team ID |

   For the base64 one, run this and paste the whole output:

   ```
   base64 -i AuthKey_XXXXXXXX.p8 | pbcopy
   ```

5. In App Store Connect, create the app record. Bundle ID
   `com.linkupnaija.app`, name **LinkUpNaija**.
6. Upload the APNs key for push: **Certificates, Identifiers & Profiles →
   Keys → +** → tick **Apple Push Notifications service**. Download that
   `.p8` too, then in Firebase: **Project settings → Cloud Messaging → iOS**
   → upload it with its Key ID and your Team ID.
7. Run the build: GitHub → **Actions → iOS → TestFlight → Run workflow**,
   and give it a build number of `1`. Increase it every run; Apple refuses a
   number it has already seen.

---

## What to expect from review

**Google** usually approves within a few days and rarely argues about a
webview app.

**Apple may reject it under guideline 4.2**, "minimum functionality", which
is their rule against apps that are only a website in a wrapper. That is a
fair rule and the app is built to answer it. Put this in the review notes:

> LinkUpNaija is a Nigerian events platform. The iOS app adds native
> functionality beyond the website: push notifications via APNs for event
> invitations, host replies and payout updates; Universal Links so a shared
> event opens directly in the app; and an offline state. Payment flows open
> in Safari rather than in-app so users can verify the payment provider.

If it is rejected anyway, reply in Resolution Center rather than
resubmitting blind. The usual fix is more native behaviour, and the obvious
next candidate is the camera for event check-ins.

---

## After it is live

A site deploy reaches every installed app immediately, because the app loads
its pages from the live site. You only need a new build when the native
shell itself changes: a plugin, `capacitor.config.ts`, the icons, or a
version bump.

```
npm run app:sync       after any plugin or config change
npm run app:android     open Android Studio
```

iOS has no local command, by necessity. Use the GitHub Action.
