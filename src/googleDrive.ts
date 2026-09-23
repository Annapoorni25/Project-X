const driveApiUrl = 'https://www.googleapis.com/drive/v3/files'

type DriveFile = {
  id: string
  name: string
  mimeType: string
  webViewLink?: string
}

export type UploadedDrivePhoto = DriveFile & {
  createdTime?: string
}

export type GalleryDrivePhoto = UploadedDrivePhoto & {
  webContentLink?: string
}

type DriveFileListResponse = {
  files: DriveFile[]
}

type GalleryDriveFileListResponse = {
  files: GalleryDrivePhoto[]
}

export type DriveFolderResult = {
  folder: DriveFile
  status: 'Created' | 'Reused'
}

const folderMimeType = 'application/vnd.google-apps.folder'
const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/webp'])

async function driveRequest<T>(accessToken: string, input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Google Drive request failed (${response.status}): ${details || response.statusText}`)
  }

  return response.json() as Promise<T>
}

export async function findOrCreateUserFolder(accessToken: string, folderName: string): Promise<DriveFolderResult> {
  const query = [
    `name = '${folderName.replace(/'/g, "\\'")}'`,
    `mimeType = '${folderMimeType}'`,
    'trashed = false',
  ].join(' and ')
  const params = new URLSearchParams({
    q: query,
    spaces: 'drive',
    fields: 'files(id,name,mimeType,webViewLink)',
    pageSize: '1',
  })
  const existing = await driveRequest<DriveFileListResponse>(accessToken, `${driveApiUrl}?${params}`)

  if (existing.files[0]) {
    return { folder: existing.files[0], status: 'Reused' }
  }

  const folder = await driveRequest<DriveFile>(accessToken, driveApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: folderName, mimeType: folderMimeType }),
  })

  return { folder, status: 'Created' }
}

export async function uploadPhotoToFolder(
  accessToken: string,
  folderId: string,
  photo: File,
): Promise<UploadedDrivePhoto> {
  if (!supportedImageTypes.has(photo.type.toLowerCase())) {
    throw new Error('Unsupported image format. Choose a JPEG, PNG, HEIC, or WebP image.')
  }

  const metadata = {
    name: photo.name,
    mimeType: photo.type,
    parents: [folderId],
  }
  const boundary = `project-x-${crypto.randomUUID()}`
  const multipartBody = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: ${photo.type}\r\n\r\n`,
    photo,
    `\r\n--${boundary}--`,
  ])
  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,createdTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    },
  )

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Photo upload failed (${response.status}): ${details || response.statusText}`)
  }

  return response.json() as Promise<UploadedDrivePhoto>
}

export async function listPhotosInFolder(accessToken: string, folderId: string): Promise<GalleryDrivePhoto[]> {
  const query = [
    `'${folderId}' in parents`,
    "mimeType contains 'image/'",
    'trashed = false',
  ].join(' and ')
  const params = new URLSearchParams({
    q: query,
    spaces: 'drive',
    orderBy: 'createdTime desc',
    fields: 'files(id,name,mimeType,webViewLink,webContentLink,createdTime)',
    pageSize: '100',
  })
  const result = await driveRequest<GalleryDriveFileListResponse>(accessToken, `${driveApiUrl}?${params}`)
  return result.files
}

export async function fetchPhotoThumbnail(accessToken: string, photoId: string): Promise<string> {
  const response = await fetch(`${driveApiUrl}/${photoId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Photo preview failed (${response.status}).`)
  }

  return URL.createObjectURL(await response.blob())
}

export async function sharePhotoWithUser(accessToken: string, photoId: string, emailAddress: string): Promise<void> {
  const trimmedEmail = emailAddress.trim()

  if (!trimmedEmail) {
    throw new Error('Enter a Google account email to share this photo.')
  }

  const response = await fetch(`${driveApiUrl}/${photoId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'user',
      emailAddress: trimmedEmail,
    }),
  })

  if (!response.ok) {
    const responseText = await response.text()
    let errorMessage = response.statusText || 'Google Drive rejected the share request.'

    if (responseText) {
      try {
        const payload = JSON.parse(responseText) as { error?: { message?: string } }
        if (payload.error?.message) {
          errorMessage = payload.error.message
        } else {
          errorMessage = responseText
        }
      } catch {
        errorMessage = responseText
      }
    }

    throw new Error(`Photo share failed (${response.status}): ${errorMessage}`)
  }

  const permission = await response.json().catch(() => null) as {
    id?: string
    role?: string
    type?: string
    emailAddress?: string
  } | null

  if (!permission || !permission.id || permission.type !== 'user' || permission.role !== 'reader') {
    throw new Error(`Google Drive did not confirm a valid private share for ${trimmedEmail}.`)
  }

  if (permission.emailAddress && permission.emailAddress !== trimmedEmail) {
    throw new Error(`Google Drive rejected the recipient email ${trimmedEmail}.`)
  }
}