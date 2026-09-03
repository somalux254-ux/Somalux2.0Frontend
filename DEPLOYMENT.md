# SomaLux Deployment Guide

This project uses separate frontend and backend deployments.

```text
Frontend: https://somalux.co.ke
Backend:  https://somalux-backend-xfq9.onrender.com
```

## 1. GitHub Repositories

Use separate repositories:

- Frontend: `Somalux2.0Frontend`
- Backend: `Somalux2.0Backend`

Keep secrets out of GitHub. Do not commit `.env` files, `node_modules`, or build output.

## 2. Deploy the Backend to Render

Create a Render **Web Service** connected to `Somalux2.0Backend`.

```text
Branch: main
Root Directory: leave blank
Build Command: npm install
Start Command: npm start
```

The backend repository contains `index.js` and `package.json` at its root, so do not set the Root Directory to `backend`.

Add backend environment variables in Render. Use values from your private local `.env` file, but rotate any credentials that were previously exposed.

Important variables include:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
AGORA_APP_ID
AGORA_APP_CERTIFICATE
GOOGLE_BOOKS_API_KEY
MPESA_CONSUMER_KEY
MPESA_CONSUMER_SECRET
MPESA_BUSINESS_SHORTCODE
MPESA_PASSKEY
MPESA_INITIATOR_NAME
MPESA_INITIATOR_PASSWORD
MPESA_SECURITY_CREDENTIAL
MPESA_ENVIRONMENT
MPESA_CALLBACK_URL
EMAIL_HOST
EMAIL_PORT
EMAIL_USER
EMAIL_PASS
EMAIL_FROM
ADMIN_EMAILS
```

Confirm the backend health URL returns JSON showing that the service is running.

## 3. Deploy the Frontend to Render

Create a Render **Static Site** connected to `Somalux2.0Frontend`.

```text
Branch: main
Root Directory: leave blank
Build Command: npm run build
Publish Directory: build
```

Add these frontend environment variables:

```text
REACT_APP_API_URL=https://somalux-backend-xfq9.onrender.com
REACT_APP_SUPABASE_URL=https://agirxwnwpxpddaqylucg.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_GOOGLE_WEB_CLIENT_ID=your_web_oauth_client_id
```

Do not add `SUPABASE_SERVICE_ROLE_KEY` to the frontend.

## 4. Connect a Custom Domain

The custom domain belongs to the frontend Static Site:

```text
https://somalux.co.ke
https://www.somalux.co.ke
```

Do not point the frontend domain to the backend. The backend should keep its Render URL, or use a separate API subdomain such as `api.somalux.co.ke`.

In Render:

1. Open the frontend Static Site.
2. Go to **Settings > Custom Domains**.
3. Add `somalux.co.ke` and `www.somalux.co.ke`.
4. Add the DNS records Render provides at your domain provider.
5. Wait for **Verified** and **Certificate Issued**.

The root website should display the frontend. The backend health URL should display JSON.

## 5. Publish the Android APK

Build the signed release APK:

```powershell
npm run android:release
```

The output is:

```text
android\app\build\outputs\apk\release\app-release.apk
```

Create or edit a GitHub Release in `Somalux2.0Frontend`:

1. Open the repository's **Releases** page.
2. Create a tag such as `v1.0.0`, or edit the current release.
3. Upload the release APK.
4. Rename the uploaded file exactly to `somalux.apk`.
5. Publish or update the release.

The frontend download prompt uses:

```text
https://github.com/somalux254-ux/Somalux2.0Frontend/releases/latest/download/somalux.apk
```

Users download the APK, open it, and confirm installation. Android may require permission for the browser to install unknown apps.

## 6. Google Sign-In Certificates

The Web OAuth client ID is passed to the plugin. Google Cloud must also contain Android OAuth clients for the package and signing certificates.

```text
Package name: com.somalux.app
```

Register the SHA-1 certificate for each build type:

- Debug/live reload: debug keystore SHA-1
- Local release APK: local release keystore SHA-1
- Google Play: Play Console app-signing SHA-1

The certificate must match the APK actually installed on the device.

## 7. Updating the Project

For frontend changes:

```powershell
npm run build
$git = "C:\Program Files\Git\cmd\git.exe"
& $git add .
& $git commit -m "Update frontend"
& $git push
```

Render redeploys the frontend from the pushed `main` branch.

For an updated APK:

```powershell
npm run android:release
```

Upload the new APK to the GitHub Release, replacing `somalux.apk`.

For debug live reload:

```powershell
npm run android:debug-live
```

Stop any old React server first so it does not reuse stale environment variables.

## 8. Troubleshooting

### Render says the root directory does not exist

The backend repository was pushed with its contents at the repository root. Leave Render's Root Directory blank.

### The website shows backend JSON

The custom domain is attached to the backend. Move it to the frontend Static Site.

### The website shows a 404 after refreshing a route

Use the frontend's hash routing or configure a Render rewrite to `/index.html`.

### Google sign-in fails in release but works in debug

Register the release APK SHA-1 in Google Cloud. Debug and release APKs use different signing certificates.

### The APK prompt appears inside the APK

The prompt is intended for the web frontend only. Rebuild and reinstall the latest APK after frontend changes.
