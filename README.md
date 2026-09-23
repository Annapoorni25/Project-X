# Project X

Project X is a React + TypeScript application that lets a signed-in Google user upload photos, read GPS metadata from the image, store the location details in a Google Sheet, view the uploaded photos in a gallery, and see GPS-tagged photos on a map. The app creates or reuses a Drive folder for the signed-in user and keeps the workflow private by using the user’s Google account rather than public sharing.

## 1. Project overview

This project is a frontend-only app for:

- Google Sign-In with Google Identity Services
- Photo upload to the user’s Google Drive
- GPS extraction from EXIF metadata
- Logging photo metadata into a Google Sheet
- Gallery view of uploaded images
- Map view using Leaflet and OpenStreetMap
- Private sharing with a specific Google user

The app is designed to work without a backend and without paid Google services.

## 2. Features

- Google authentication through Google Identity Services
- Auto-create or reuse a Drive folder named after the signed-in user
- Auto-create or reuse a sheet named `Project X GPS Log`
- Upload photos to the folder
- Extract GPS coordinates and timestamps from EXIF metadata
- Write photo metadata to the Google Sheet
- View uploaded photos in a gallery
- View GPS-tagged photos on a map
- Share a photo privately with another Google user email

## 3. Tech stack

- React
- TypeScript
- Vite
- Google Identity Services (GIS)
- Google Drive API
- Google Sheets API
- Leaflet + OpenStreetMap
- exifr for EXIF parsing

## 4. Project structure

```text
project-x/
├─ public/                     # sample/test image assets
├─ src/
│  ├─ App.tsx                 # main app flow and UI
│  ├─ googleDrive.ts          # Drive folder creation, upload, thumbnail, sharing
│  ├─ googleSheets.ts         # Sheet creation/reuse and row logging
│  ├─ photoMetadata.ts        # EXIF/GPS extraction
│  ├─ App.css                 # app styling
│  ├─ index.css               # global styles and Leaflet CSS
│  ├─ main.tsx                # app entry
│  └─ vite-env.d.ts           # Vite typings
├─ .env.local                 # local Google client ID
├─ .gitignore
├─ package.json
├─ tsconfig*.json
├─ vite.config.ts
├─ README.md
└─ index.html
```

## 5. Google Cloud setup

Create or use a Google Cloud project and enable the following APIs:

- Google Drive API
- Google Sheets API

Important: this project does not use any paid Google service and does not require billing.

## 6. OAuth configuration

In Google Cloud Console:

1. Open APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID for a Web application
3. Add the app origins to Authorized JavaScript origins
4. Add the local app URLs you will use during development

Typical local origins:

```text
http://localhost:5173
http://127.0.0.1:5173
```

If the app is served from another local URL, add that exact origin too.

The project uses only:

- Google Identity Services authentication
- Google Drive API access
- Google Sheets API access

No backend or client secret is required in the browser app.

## 7. Drive API setup

Enable the Drive API in the same Google Cloud project.

The app requests the Google Drive scope:

```text
https://www.googleapis.com/auth/drive.file
```

This lets the app:

- create or find a folder for the signed-in user
- upload files into that folder
- read thumbnails for the gallery
- create private file permissions for a specific user

The app does not make files public.

## 8. Sheets API setup

Enable the Google Sheets API in the same project.

The app requests the Sheets scope:

```text
https://www.googleapis.com/auth/spreadsheets
```

This lets the app:

- find or create the spreadsheet named `Project X GPS Log`
- initialize the required columns
- append photo metadata rows

## 9. Environment variables

Create a `.env.local` file in the project root:

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

The value must be the OAuth Web client ID from Google Cloud Console.

## 10. Installation

From the project folder:

```bash
npm install
```

## 11. Running locally

Start the app:

```bash
npm run dev -- --host 0.0.0.0
```

Then open the app in a browser at:

```text
http://localhost:5173
```

If you are using the loopback address instead:

```text
http://127.0.0.1:5173
```

Make sure the exact URL is also added to the authorized JavaScript origins in Google Cloud Console.

## 12. How the application works

1. The user signs in with Google.
2. The app loads the Google OAuth access token.
3. The app checks whether a Drive folder for the signed-in user exists.
4. If the folder does not exist, it creates it.
5. The app checks whether the sheet `Project X GPS Log` exists inside the folder.
6. If it does not exist, the app creates it and initializes the headers.
7. The user uploads a photo.
8. The app reads EXIF metadata and extracts GPS coordinates and timestamps.
9. The photo is uploaded to the user’s Drive folder.
10. The app appends the metadata to the Google Sheet.
11. The gallery loads the uploaded photos.
12. Clicking a GPS-tagged photo shows it on a Leaflet map.
13. The user can share the photo privately with another Google user email.

## 13. Known limitations

- This is a frontend-only project; there is no backend service.
- Google OAuth requires the correct authorized JavaScript origins in Cloud Console.
- Live Google sign-in will fail unless the app origin is explicitly allowed in the OAuth client config.
- The app uses Drive and Sheets APIs only; it does not use Google Maps.
- The app intentionally avoids public file sharing and billing-based services.
- GPS is only available when the uploaded photo contains valid EXIF GPS metadata.

## Quick validation

The project has been checked with:

```bash
npm run lint
npm run build
```

These commands should pass after installation and configuration.

## AI development prompt history

The following are the important prompts from the development conversation. They are included using the original user wording rather than rewritten summaries.

### Prompt 1 — Project requirements and constraints

> Use the following decisions for Project X:
>
> 1. Google OAuth in the browser using Google Identity Services, with no custom backend: **YES**
> 2. `{Your Name}` should come from the authenticated user's Google profile name: **YES**
> 3. Use the restricted `drive.file` scope for Google Drive access: **YES**
> 4. Create one `{Your Name}` folder per user and reuse it on future logins: **YES**
> 5. Create one Google Sheet per user inside that folder and reuse it: **YES**
> 6. The Sheet should contain: photo name, Drive link, latitude, longitude, capture timestamp, and upload timestamp.
> 7. Photos without GPS metadata should still upload. Display blank/unavailable GPS values in the gallery and Sheet: **YES**
> 8. Support image selection from device storage and camera capture on mobile where supported: **YES**
> 9. Accept JPEG, PNG, HEIC, and WebP where browser support allows. Handle unsupported formats gracefully: **YES**
> 10. The gallery should show only photos uploaded/managed by this application, not every image already present in the user's Drive folder: **YES**
> 11. Clicking a thumbnail should open a dedicated in-app map view/page: **YES**
> 12. Do NOT use Google Maps JavaScript API because I cannot enable Google Cloud billing. Use Leaflet + OpenStreetMap for the map instead.
> 13. I do NOT currently have a Google Maps API key. Do not add Google Maps dependencies or require a billing account.
> 14. Sharing should initially support entering one Google email address and sharing the specific Drive photo with the Viewer permission. Do not make files public and do not use "anyone with the link".
> 15. Display clear sharing errors if Google rejects the request or the recipient cannot be added: **YES**
> 16. Make the application responsive for desktop and mobile: **YES**
> 17. Use Vite + React + TypeScript: **YES**
>
> Do not introduce any paid Google Cloud service.
>
> Use Google only for:
>
> - Google Identity Services authentication
> - Google Drive API
> - Google Sheets API
>
> Use Leaflet/OpenStreetMap for the map.
>
> Before implementing Google OAuth/Drive/Sheets, inspect the current project and tell me exactly which Google Cloud configuration is required and whether any of it requires billing.
>
> Do not generate the whole application at once. Implement and test one feature at a time, starting with the React project structure and then Google authentication. Move to next module only when I say 'move'

**Why:** Defined the architecture, APIs, security boundaries, no-billing constraint, and staged implementation process.

### Prompt 2 — Module progression

> move

**Why:** Approved progression from the initial project structure to the next implementation module.

### Prompt 3 — Architecture checkpoint

> this is our project arachitecture
>
> PROJECT X → React + TypeScript → Google OAuth, EXIF/GPS processing, Leaflet + OSM → Google Drive API and Google Sheets API.
>
> this is listed necessary: Overview of the app and its architecture; all the prompts you used with AI tools, listed in order, along with why you used each one; how you set up Google Authentication, the Drive API, and the Sheets API; screenshot proof of sharing a photo with su1@vr2.in; challenges you faced, and what you would improve with more time.
>
> so stop here. and explain whether we are on the right track according to the project structure if not explain what is needed to be changed. do not implement yet

**Why:** Confirmed that the implementation matched the required architecture and identified the documentation deliverables.

### Prompt 4 — Authentication and Drive UI fix

> We are NOT moving to the next module.
>
> I manually reviewed http://localhost:5173/ and found a critical issue: The application currently renders mostly static HTML and there is NO visible Google Sign-In button. I cannot authenticate, so I cannot validate the Drive Folder module.
>
> Fix ONLY the current authentication + Drive Folder UI flow. Inspect the existing React application before changing anything. Identify why the Google Sign-In UI is not appearing. Ensure there is a clearly visible "Sign in with Google" button. Use the existing Google Identity Services OAuth implementation if it already exists. Do NOT add a backend or change the current architecture.
>
> After successful authentication, obtain the authenticated Google profile name and run the existing Drive folder preparation logic. Display the Google profile name, folder name, Created or Reused status, loading state, and error state. Add a Sign Out button after login. Do not display "Folder ready" unless the Drive API operation actually succeeds. Do not implement photo upload, EXIF, Sheets, Gallery, Map, or Sharing yet. Validation is mandatory.

**Why:** Diagnosed the missing sign-in UI and made the first real authentication and Drive-folder workflow testable.

### Prompt 5 — Module 2 implementation

> Move to module 2

**Why:** Started the Google Sheets folder setup after the authentication and Drive folder flow was validated.

### Prompt 6 — Module 2 end-to-end validation

> I fixed the Google OAuth authorized JavaScript origin for the actual dev URL: http://localhost:5174. Please continue by testing Module 2 end-to-end with the real Google APIs.
>
> Verify that Google sign-in works; the app can access the user's Drive; it finds or creates "Project X GPS Log" inside the user's Drive folder; a newly created sheet is moved into the user folder; the required six headers are initialized; existing sheets are reused on subsequent logins; and the UI correctly shows the sheet name and Created/Reused status. Do not start Module 3 yet. If anything fails, diagnose the exact Google API/OAuth error.

**Why:** Implemented and validated spreadsheet creation, placement, headers, reuse, and OAuth-dependent behavior.

### Prompt 7 — Module 2 completion check

> Module 2 now works successfully.
>
> The app created:
> - Drive folder: "Annapoorni M"
> - Sheet: "Project X GPS Log"
>
> Please perform the remaining Module 2 validation: reload/sign in again and verify the existing folder and sheet are reused rather than duplicated; verify the six required headers are present; verify the UI shows Created on first creation and Reused on subsequent access; confirm there are no duplicate folders or sheets. If all checks pass, mark Module 2 as complete and then show me the exact plan/files/changes you intend to make for Module 3 before implementing it. Do not implement Module 3 yet.

**Why:** Confirmed that the Drive folder and sheet were reused correctly and that duplicate resources were not created.

### Prompt 8 — Modules 3 and 4 progression

> move to module 3

> move to module 4

**Why:** Approved the staged implementation of photo upload and EXIF/GPS extraction after Module 2 was complete.

### Prompt 9 — Google Sheets data flow

> Modules 1, 2, 3, and 4 are already implemented successfully.
>
> The remaining task is the Google Sheets data flow. Please implement only the integration that runs after a photo is successfully uploaded to Google Drive: get the uploaded photo's photo name, Drive link, extracted latitude, extracted longitude, capture timestamp, and upload timestamp; append one new row to the existing `Project X GPS Log` sheet; map the values exactly to the six columns; write `Unavailable` for latitude/longitude when GPS metadata is unavailable; reuse the existing sheet; handle Sheets API errors gracefully; run `npm run lint` and `npm run build` after implementation.

**Why:** Connected successful uploads and extracted metadata to the existing GPS log sheet.

### Prompt 10 — GPS test assets

> Can you help me generate three images with valid latitude longitude and gps location to test the functioanlities also i want you to test these functionalities at this point to ensure our project x has the necessary functions correctly implemented
>
> Test: Sign in. Open the gallery. Find a photo with valid GPS. Click it. Confirm the map appears. Confirm the map centers on the correct coordinates. Confirm the marker is at the correct location. Click a different GPS-tagged photo. Confirm the map moves to the second location. Click a photo showing `GPS unavailable`. Confirm the app doesn't crash or try to send invalid coordinates to Leaflet.

**Why:** Created realistic GPS and no-GPS test inputs and defined the gallery-to-map validation workflow.

### Prompt 11 — Map selection bug fix

> There is a bug in Module 6.
>
> When I click GPS-A, the map correctly shows GPS-A. When I click GPS-B, the selected photo changes but the map stays on GPS-A instead of moving to GPS-B.
>
> Please fix this issue. Check how the selected photo and its latitude/longitude are passed to the Leaflet map. Make the map update and center on the newly selected photo's coordinates. Make sure the marker also updates. Do not change the existing upload, GPS extraction, Drive, Sheets, or gallery functionality. Test GPS-A → GPS-B → GPS-A and confirm the map moves to the correct location each time. Then run: npm run lint; npm run build.

**Why:** Fixed the selected-photo state and Leaflet map synchronization without changing the existing upload or logging flow.

### Prompt 12 — Module 7 progression and sharing fix

> move to module 7

> Module 7 sharing is failing with this Google Drive error:
> `Photo share failed (403): allowFileDiscovery is not valid for individual users.`
>
> Please fix the sharing request in `googleDrive.ts`.

**Why:** Added private Drive sharing and corrected the permission payload for individual Google users.
