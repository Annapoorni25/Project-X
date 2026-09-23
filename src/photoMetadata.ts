import exifr from 'exifr'

export type PhotoMetadata = {
  latitude: number | null
  longitude: number | null
  captureTimestamp: string | null
}

type ExifData = {
  latitude?: number
  longitude?: number
  DateTimeOriginal?: Date | string
  CreateDate?: Date | string
}

export async function extractPhotoMetadata(photo: File): Promise<PhotoMetadata> {
  try {
    const exif = await exifr.parse(photo, {
      gps: true,
      tiff: true,
      exif: true,
    }) as ExifData | undefined

    const latitude = typeof exif?.latitude === 'number' ? exif.latitude : null
    const longitude = typeof exif?.longitude === 'number' ? exif.longitude : null
    const captureDate = exif?.DateTimeOriginal ?? exif?.CreateDate
    const captureTimestamp = captureDate
      ? captureDate instanceof Date
        ? captureDate.toISOString()
        : new Date(captureDate).toISOString()
      : null

    return {
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      captureTimestamp: captureTimestamp && !Number.isNaN(Date.parse(captureTimestamp))
        ? captureTimestamp
        : null,
    }
  } catch {
    return { latitude: null, longitude: null, captureTimestamp: null }
  }
}
