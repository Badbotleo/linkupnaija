/**
 * App Links, Android side.
 *
 * Android fetches this when the app installs. If the SHA-256 fingerprint of
 * the signing certificate matches, linkupnaija.com links open straight in the
 * app with no "open with" chooser. If it does not match, the links keep
 * working in the browser and nothing announces the failure, which is why the
 * fingerprint is worth checking rather than assuming.
 *
 * WHERE THE FINGERPRINT COMES FROM. Not the local debug keystore. Google Play
 * re-signs every upload with its own key, so the value that matters is the
 * one in Play Console under Setup > App signing, listed as "SHA-256
 * certificate fingerprint". Using the upload key's fingerprint instead is the
 * usual reason verification fails on a published app while working fine on a
 * phone during testing.
 *
 * Both fingerprints can be listed at once, which is what ANDROID_CERT_SHA256
 * supports: comma-separate them and local test builds and the Play build both
 * verify.
 */
export const dynamic = "force-static";

const PACKAGE_NAME = "com.linkupnaija.app";

export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean);

  const body = [
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        // Lets Chrome and the password manager offer the same saved
        // credentials in the app as on the site, so signing in does not
        // start from nothing.
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
