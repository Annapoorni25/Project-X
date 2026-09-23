import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import './App.css'
import {
  fetchPhotoThumbnail,
  findOrCreateUserFolder,
  listPhotosInFolder,
  sharePhotoWithUser,
  uploadPhotoToFolder,
  type GalleryDrivePhoto,
  type UploadedDrivePhoto,
} from './googleDrive'
import { appendPhotoLogRow, findOrCreateLogSheet, readPhotoLogRows, type PhotoLogEntry } from './googleSheets'
import { extractPhotoMetadata, type PhotoMetadata } from './photoMetadata'

type GoogleProfile = {
  name: string
  email: string
  picture?: string
}

type DriveFolder = {
  id: string
  name: string
  status: 'Created' | 'Reused'
}

type LogSheet = {
  id: string
  name: string
  status: 'Created' | 'Reused'
  url?: string
}

type GalleryItem = {
  photo: GalleryDrivePhoto
  thumbnailUrl: string
  log: PhotoLogEntry | null
}

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
const googleApiScopes = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
].join(' ')

function decodeProfile(credential: string): GoogleProfile {
  const payload = credential.split('.')[1]

  if (!payload) {
    throw new Error('Google returned an invalid credential.')
  }

  const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
  const decodedPayload = decodeURIComponent(
    window
      .atob(normalizedPayload)
      .split('')
      .map((character) => `%${`00${character.charCodeAt(0).toString(16)}`.slice(-2)}`)
      .join(''),
  )

  return JSON.parse(decodedPayload) as GoogleProfile
}

async function loadGalleryItems(accessToken: string, folderId: string, sheetId: string): Promise<GalleryItem[]> {
  const [photos, logs] = await Promise.all([
    listPhotosInFolder(accessToken, folderId),
    readPhotoLogRows(accessToken, sheetId),
  ])

  return Promise.all(photos.map(async (photo) => {
    const log = logs.find((entry) => entry.driveLink.includes(photo.id) || entry.photoName === photo.name) ?? null
    try {
      return { photo, thumbnailUrl: await fetchPhotoThumbnail(accessToken, photo.id), log }
    } catch {
      return { photo, thumbnailUrl: '', log }
    }
  }))
}

function App() {
  const buttonContainerRef = useRef<HTMLDivElement>(null)
  const tokenClientRef = useRef<GoogleIdentityServices.TokenClient | null>(null)
  const accessTokenRef = useRef<string | null>(null)
  const profileRef = useRef<GoogleProfile | null>(null)
  const googleInitializedRef = useRef(false)
  const [profile, setProfile] = useState<GoogleProfile | null>(null)
  const [driveFolder, setDriveFolder] = useState<DriveFolder | null>(null)
  const [logSheet, setLogSheet] = useState<LogSheet | null>(null)
  const [uploadedPhoto, setUploadedPhoto] = useState<UploadedDrivePhoto | null>(null)
  const [uploadedPhotoMetadata, setUploadedPhotoMetadata] = useState<PhotoMetadata | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [logStatus, setLogStatus] = useState('')
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [shareEmailByPhotoId, setShareEmailByPhotoId] = useState<Record<string, string>>({})
  const [shareStatusByPhotoId, setShareStatusByPhotoId] = useState<Record<string, string>>({})
  const [shareErrorByPhotoId, setShareErrorByPhotoId] = useState<Record<string, string>>({})
  const [isGalleryLoading, setIsGalleryLoading] = useState(false)
  const [galleryError, setGalleryError] = useState('')
  const [status, setStatus] = useState(() => clientId ? '' : 'Google sign-in is not configured.')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(() => clientId ? '' : 'Add VITE_GOOGLE_CLIENT_ID to .env.local, then restart the dev server.')

  useEffect(() => {
    if (!clientId) {
      return
    }

    const renderGoogleButton = () => {
      if (!window.google || !buttonContainerRef.current || googleInitializedRef.current) {
        return false
      }

      googleInitializedRef.current = true
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          try {
            const signedInProfile = decodeProfile(response.credential)
            profileRef.current = signedInProfile
            setProfile(signedInProfile)
            setError('')
            setIsLoading(true)
            setStatus('Google profile received. Requesting Drive access...')
            tokenClientRef.current?.requestAccessToken({ prompt: 'consent' })
          } catch (error) {
            setIsLoading(false)
            setError(error instanceof Error ? error.message : 'Unable to complete sign-in.')
          }
        },
        error_callback: (error) => {
          setIsLoading(false)
          setError(error.message ?? `Google sign-in failed: ${error.type}.`)
        },
      })
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: googleApiScopes,
        callback: (response) => {
          if (response.error || !response.access_token) {
            setIsLoading(false)
            setError(response.error_description ?? 'Google authorization was not completed.')
            return
          }

          accessTokenRef.current = response.access_token
          setStatus('Access granted. Preparing your Drive folder...')
          const signedInProfile = profileRef.current
          if (signedInProfile) {
            findOrCreateUserFolder(response.access_token, signedInProfile.name)
              .then((result) => {
                setDriveFolder({ id: result.folder.id, name: result.folder.name, status: result.status })
                setStatus(`Drive folder ${result.status.toLowerCase()}. Preparing the GPS log sheet...`)
                return findOrCreateLogSheet(response.access_token, result.folder.id).then((sheet) => ({
                  folderId: result.folder.id,
                  sheet,
                }))
              })
              .then(({ folderId, sheet }) => {
                setLogSheet(sheet)
                setIsGalleryLoading(true)
                return loadGalleryItems(response.access_token, folderId, sheet.id)
              })
              .then((items) => {
                setGalleryItems(items)
                setIsGalleryLoading(false)
                setIsLoading(false)
                setStatus(`Drive folder and GPS log sheet are ready.`)
              })
              .catch((error: unknown) => {
                setIsGalleryLoading(false)
                setIsLoading(false)
                setError(error instanceof Error ? error.message : 'Unable to prepare your Drive folder.')
              })
          } else {
            setIsLoading(false)
            setError('Google profile information was not available.')
          }
        },
        error_callback: (error) => {
          setIsLoading(false)
          setError(error.message ?? 'Google authorization was not completed.')
        },
      })
      window.google.accounts.id.renderButton(buttonContainerRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: 320,
      })
      return true
    }

    if (renderGoogleButton()) {
      return
    }

    const scriptPoll = window.setInterval(() => {
      if (renderGoogleButton()) {
        window.clearInterval(scriptPoll)
      }
    }, 100)

    return () => window.clearInterval(scriptPoll)
  }, [profile])

  const signOut = () => {
    if (accessTokenRef.current) {
      window.google?.accounts.oauth2.revoke(accessTokenRef.current)
      accessTokenRef.current = null
    }
    window.google?.accounts.id.disableAutoSelect()
    profileRef.current = null
    googleInitializedRef.current = false
    setProfile(null)
    setDriveFolder(null)
    setLogSheet(null)
    setUploadedPhoto(null)
    setUploadedPhotoMetadata(null)
    setUploadError('')
    setLogStatus('')
    galleryItems.forEach((item) => {
      if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl)
    })
    setGalleryItems([])
    setSelectedPhotoId(null)
    setGalleryError('')
    setStatus(clientId ? '' : 'Google sign-in is not configured.')
    setError(clientId ? '' : 'Add VITE_GOOGLE_CLIENT_ID to .env.local, then restart the dev server.')
    setIsLoading(false)
  }

  type MapGalleryItem = GalleryItem & {
    log: PhotoLogEntry & {
      latitude: number
      longitude: number
    }
  }

  const mapItems = galleryItems.filter((item): item is MapGalleryItem => Boolean(
    item.log
    && typeof item.log.latitude === 'number'
    && typeof item.log.longitude === 'number',
  ))
  const selectedMapItem = selectedPhotoId
    ? mapItems.find((item) => item.photo.id === selectedPhotoId) ?? mapItems[0] ?? null
    : mapItems[0] ?? null
  const selectedMapPosition = selectedMapItem
    ? ([selectedMapItem.log.latitude, selectedMapItem.log.longitude] as [number, number])
    : null

  const mapPinIcon = (isSelected: boolean) => divIcon({
    className: `photo-map-pin${isSelected ? ' selected' : ''}`,
    html: '<span></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })

  const sharePhoto = async (photoId: string) => {
    const emailAddress = (shareEmailByPhotoId[photoId] ?? '').trim()

    if (!accessTokenRef.current) {
      setShareErrorByPhotoId((current) => ({ ...current, [photoId]: 'You must sign in before sharing a photo.' }))
      return
    }

    if (!emailAddress) {
      setShareErrorByPhotoId((current) => ({ ...current, [photoId]: 'Enter a Google account email to share this file.' }))
      setShareStatusByPhotoId((current) => ({ ...current, [photoId]: '' }))
      return
    }

    try {
      await sharePhotoWithUser(accessTokenRef.current, photoId, emailAddress)
      setShareStatusByPhotoId((current) => ({ ...current, [photoId]: `Photo shared with ${emailAddress}.` }))
      setShareErrorByPhotoId((current) => ({ ...current, [photoId]: '' }))
      setShareEmailByPhotoId((current) => ({ ...current, [photoId]: '' }))
    } catch (error: unknown) {
      setShareErrorByPhotoId((current) => ({
        ...current,
        [photoId]: error instanceof Error ? error.message : 'Unable to share this photo.',
      }))
      setShareStatusByPhotoId((current) => ({ ...current, [photoId]: '' }))
    }
  }

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const photo = event.target.files?.[0]
    event.target.value = ''

    if (!photo || !accessTokenRef.current || !driveFolder) {
      return
    }

    setIsUploading(true)
    setUploadError('')
    setLogStatus('')
    setUploadedPhoto(null)
    setUploadedPhotoMetadata(null)
    try {
      const metadata = await extractPhotoMetadata(photo)
      const uploaded = await uploadPhotoToFolder(accessTokenRef.current, driveFolder.id, photo)
      const uploadTimestamp = new Date().toISOString()
      setUploadedPhoto(uploaded)
      setUploadedPhotoMetadata(metadata)
      if (!logSheet) {
        setLogStatus('Photo uploaded, but the GPS log sheet is unavailable.')
        return
      }

      try {
        await appendPhotoLogRow(accessTokenRef.current, logSheet.id, {
          photoName: uploaded.name,
          driveLink: uploaded.webViewLink ?? `https://drive.google.com/file/d/${uploaded.id}/view`,
          latitude: metadata.latitude,
          longitude: metadata.longitude,
          captureTimestamp: metadata.captureTimestamp,
          uploadTimestamp,
        })
        setLogStatus('Photo uploaded and GPS log row added.')
        try {
          const refreshedItems = await loadGalleryItems(accessTokenRef.current, driveFolder.id, logSheet.id)
          setGalleryItems(refreshedItems)
        } catch (galleryFailure: unknown) {
          setGalleryError(galleryFailure instanceof Error ? galleryFailure.message : 'Gallery refresh failed.')
        }
      } catch (loggingFailure: unknown) {
        setLogStatus(loggingFailure instanceof Error
          ? `Photo uploaded, but GPS log failed: ${loggingFailure.message}`
          : 'Photo uploaded, but GPS log failed.')
      }
    } catch (uploadFailure: unknown) {
      setUploadError(uploadFailure instanceof Error ? uploadFailure.message : 'Unable to upload the photo.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="intro-panel">
        <span className="eyebrow">Project X</span>
        <h1>Your documents,<br /><em>right where they belong.</em></h1>
        <p>Capture application documents, keep their location data, and find everything again in your own Drive.</p>
        <div className="feature-list" aria-label="Project features">
          <span><strong>01</strong> Private by default</span>
          <span><strong>02</strong> GPS-aware records</span>
          <span><strong>03</strong> Your Google Drive</span>
        </div>
      </section>

      <section className="auth-panel" aria-labelledby="welcome-heading">
        <div className="auth-mark" aria-hidden="true">X</div>
        {profile ? (
          <div className="signed-in-state">
            {profile.picture && <img className="profile-image" src={profile.picture} alt="" />}
            <span className="eyebrow">Signed in</span>
            <h2 id="welcome-heading">Welcome, {profile.name}.</h2>
            <p className="account-email">{profile.email}</p>
            <p className="next-step-note">{isLoading ? 'Preparing your Drive folder...' : status}</p>
            {driveFolder && (
              <p className="folder-detail">
                Folder: {driveFolder.name}<br />Status: {driveFolder.status}
              </p>
            )}
            {logSheet && (
              <p className="folder-detail">
                Log sheet: {logSheet.name}<br />Status: {logSheet.status}
              </p>
            )}
            {driveFolder && (
              <div className="upload-panel">
                <span className="eyebrow">Add a document</span>
                <label className="upload-button">
                  <span>{isUploading ? 'Uploading...' : 'Choose or take a photo'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/heic,image/webp"
                    capture="environment"
                    onChange={uploadPhoto}
                    disabled={isUploading}
                  />
                </label>
                {uploadedPhoto && uploadedPhotoMetadata && (
                  <div className="upload-success">
                    <p>Uploaded: {uploadedPhoto.name}</p>
                    <p>GPS: {uploadedPhotoMetadata.latitude !== null && uploadedPhotoMetadata.longitude !== null
                      ? `${uploadedPhotoMetadata.latitude}, ${uploadedPhotoMetadata.longitude}`
                      : 'Unavailable'}</p>
                    <p>Captured: {uploadedPhotoMetadata.captureTimestamp ?? 'Unavailable'}</p>
                  </div>
                )}
                {logStatus && <p className="upload-success">{logStatus}</p>}
                {uploadError && <p className="status-message" role="alert">{uploadError}</p>}
              </div>
            )}
            {driveFolder && logSheet && (
              <section className="gallery-panel" aria-labelledby="gallery-heading">
                <div className="gallery-heading">
                  <span className="eyebrow">Your uploads</span>
                  <h3 id="gallery-heading">Gallery</h3>
                </div>
                {isGalleryLoading && <p className="gallery-empty">Loading photos...</p>}
                {galleryError && <p className="status-message" role="alert">{galleryError}</p>}
                {!isGalleryLoading && !galleryItems.length && <p className="gallery-empty">No photos uploaded yet.</p>}
                <div className="gallery-grid">
                  {galleryItems.map((item) => {
                    const hasLocation = item.log && item.log.latitude !== null && item.log.latitude !== undefined && item.log.longitude !== null && item.log.longitude !== undefined
                    return (
                      <div className={`gallery-item${selectedPhotoId === item.photo.id ? ' selected' : ''}`} key={item.photo.id}>
                        <button
                          type="button"
                          className="gallery-card-button"
                          onClick={() => setSelectedPhotoId(item.photo.id)}
                          aria-label={`Open map for ${item.photo.name}`}
                        >
                          {item.thumbnailUrl
                            ? <img src={item.thumbnailUrl} alt={item.photo.name} />
                            : <div className="gallery-placeholder">Preview unavailable</div>}
                          <p className="gallery-name">{item.photo.name}</p>
                          <p className="gallery-location">
                            {hasLocation ? `${item.log!.latitude}, ${item.log!.longitude}` : 'GPS unavailable'}
                          </p>
                        </button>
                        <div className="share-row">
                          <input
                            type="email"
                            value={shareEmailByPhotoId[item.photo.id] ?? ''}
                            placeholder="name@example.com"
                            onChange={(event) => setShareEmailByPhotoId((current) => ({
                              ...current,
                              [item.photo.id]: event.target.value,
                            }))}
                            aria-label={`Share ${item.photo.name} with a Google account`}
                          />
                          <button type="button" className="share-button" onClick={() => sharePhoto(item.photo.id)}>
                            Share
                          </button>
                        </div>
                        {shareStatusByPhotoId[item.photo.id] && (
                          <p className="share-status success">{shareStatusByPhotoId[item.photo.id]}</p>
                        )}
                        {shareErrorByPhotoId[item.photo.id] && (
                          <p className="share-status error">{shareErrorByPhotoId[item.photo.id]}</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {mapItems.length > 0 && selectedMapItem && selectedMapPosition && (
                  <div className="map-panel" aria-label="Photo location map">
                    <div className="gallery-heading">
                      <span className="eyebrow">Map view</span>
                      <h3>Location</h3>
                    </div>
                    <MapContainer
                      key={selectedMapItem.photo.id}
                      center={selectedMapPosition}
                      zoom={13}
                      scrollWheelZoom
                      className="photo-map"
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      {mapItems.map((item) => {
                        const isSelectedMarker = item.photo.id === selectedMapItem.photo.id
                        return (
                          <Marker
                            key={item.photo.id}
                            position={[item.log.latitude, item.log.longitude]}
                            icon={mapPinIcon(isSelectedMarker)}
                          >
                            <Popup>
                              <strong>{item.photo.name}</strong><br />
                              {item.log.latitude}, {item.log.longitude}
                            </Popup>
                          </Marker>
                        )
                      })}
                    </MapContainer>
                  </div>
                )}
              </section>
            )}
            {error && <p className="status-message" role="alert">{error}</p>}
            <button className="secondary-button" type="button" onClick={signOut}>Sign out</button>
          </div>
        ) : (
          <div className="signed-out-state">
            <span className="eyebrow">A private workspace</span>
            <h2 id="welcome-heading">Sign in to begin.</h2>
            <p>Use your Google account to keep your captured documents in your own Drive.</p>
            <div className={`google-button${clientId ? '' : ' unavailable'}`} ref={buttonContainerRef}>
              {!clientId && <button type="button" disabled>Sign in with Google</button>}
            </div>
            {status && <p className="status-message" role="status">{status}</p>}
            {error && <p className="status-message" role="alert">{error}</p>}
            <small>Project X never makes your files public.</small>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
