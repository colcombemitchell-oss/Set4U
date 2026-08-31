# Set4U Android release

Generated with Google Chrome Labs Bubblewrap 1.25.0. This is a Trusted Web Activity around https://colcombemitchell-oss.github.io/Set4U/.

- Package: `io.github.colcombemitchelloss.set4u`
- Version: `1.2.0`, code `1`
- Minimum SDK: 23; compile and target SDK: 36
- JDK 17; Gradle 8.11.1 (checksum pinned); Android Gradle Plugin 8.9.1
- Android Browser Helper 2.6.2, with notifications, billing, location delegation and analytics disabled
- The browser supplies file selection, local storage and offline caching. Uninstalling the wrapper does not guarantee browser data is erased.

## Build

Install JDK 17, Android platform 36, build-tools 35.0.0 and platform-tools after reviewing the relevant SDK terms. Set `JAVA_HOME` and `ANDROID_HOME` appropriately, then run:

```powershell
.\gradlew.bat --no-daemon :app:bundleRelease :app:assembleRelease :app:lintRelease
```

The generated AAB is unsigned. Use `sign-bundle.ps1` with the existing private upload key and a new output filename. Never put keys or passwords inside this repository. `.github/workflows/android.yml` can build unsigned AAB/debug APK artifacts on a configured GitHub runner; it does not publish or sign a Play release.

## Website association: a separate required deployment

The file must be served at exactly:

`https://colcombemitchell-oss.github.io/.well-known/assetlinks.json`

Putting it inside `/Set4U/` is not sufficient. The root GitHub Pages repository needs to publish it with HTTP 200, JSON content type, HTTPS and no redirect. If Jekyll is enabled, explicitly include `.well-known` or use `.nojekyll`.

`assetlinks.upload-key.json` contains this build's public upload-key certificate fingerprint. It can verify locally signed APKs after being published at the root endpoint. It is NOT yet the Play signing configuration. After uploading the AAB to Play Console, get the **app-signing certificate SHA-256** from App integrity/App signing and add it to the same `sha256_cert_fingerprints` array. Do not substitute the upload certificate fingerprint for Google's app-signing certificate.

Merge with any existing root association statements; never replace other apps' statements blindly. Before publishing, check that the root endpoint is controlled by the account and not already configured for another release.

Without a valid matching association, the app opens as a browser custom tab with a URL bar. Test a build installed through a Play testing track before claiming verified fullscreen TWA operation.

## Local modifications after generation

`mavenCentral()` replaces retired JCenter; Android backup is disabled for the wrapper; the Gradle distribution checksum is pinned. The web origin's data stays in its browser profile. Regenerating with Bubblewrap may overwrite these changes. Preserve them and rerun source checks and Android lint.

For every subsequent Play upload, increment `versionCode`; do not change the package ID or silently rotate the signing key.
