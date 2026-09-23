from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw
import piexif

output_dir = Path(__file__).resolve().parent.parent / 'public'
output_dir.mkdir(parents=True, exist_ok=True)


def gps_tuple(decimal_degrees: float):
    sign = 1 if decimal_degrees >= 0 else -1
    decimal_degrees = abs(decimal_degrees)
    degrees_int = int(decimal_degrees)
    minutes_float = (decimal_degrees - degrees_int) * 60
    minutes_int = int(minutes_float)
    seconds_float = (minutes_float - minutes_int) * 60
    return ((degrees_int, 1), (minutes_int, 1), (int(seconds_float * 1000000), 1000000))

coords = [
    (43.46744833333334, 11.885126666663888, 'gps-a.jpg', 'GPS Test A'),
    (48.8566, 2.3522, 'gps-b.jpg', 'GPS Test B'),
    (51.5074, -0.1278, 'gps-c.jpg', 'GPS Test C'),
]

for lat, lon, filename, label in coords:
    image = Image.new('RGB', (1200, 800), 'white')
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((80, 120, 1120, 260), radius=18, fill=(245, 245, 245), outline=(30, 30, 30), width=3)
    draw.text((110, 160), label, fill=(20, 20, 20))
    draw.text((110, 300), f'Lat: {lat}', fill=(20, 20, 20))
    draw.text((110, 350), f'Lon: {lon}', fill=(20, 20, 20))
    image_path = output_dir / filename
    image.save(image_path)

    exif_dict = {
        '0th': {},
        'Exif': {},
        'GPS': {
            piexif.GPSIFD.GPSLatitudeRef: b'N' if lat >= 0 else b'S',
            piexif.GPSIFD.GPSLatitude: gps_tuple(lat),
            piexif.GPSIFD.GPSLongitudeRef: b'E' if lon >= 0 else b'W',
            piexif.GPSIFD.GPSLongitude: gps_tuple(lon),
            piexif.GPSIFD.GPSAltitudeRef: 0,
            piexif.GPSIFD.GPSAltitude: ((100, 1),),
            piexif.GPSIFD.GPSTimeStamp: ((12, 1), (30, 1), (0, 1)),
            piexif.GPSIFD.GPSDateStamp: datetime.now(timezone.utc).strftime('%Y:%m:%d').encode('utf-8'),
        },
        '1st': {},
        'thumbnail': None,
    }
    piexif.insert(piexif.dump(exif_dict), str(image_path))

no_gps = Image.new('RGB', (1200, 800), 'white')
draw = ImageDraw.Draw(no_gps)
draw.rounded_rectangle((80, 120, 1120, 260), radius=18, fill=(245, 245, 245), outline=(30, 30, 30), width=3)
draw.text((110, 160), 'GPS unavailable', fill=(20, 20, 20))
no_gps.save(output_dir / 'no-gps.jpg')

print("Generated:\n- gps-a.jpg\n- gps-b.jpg\n- gps-c.jpg\n- no-gps.jpg")
