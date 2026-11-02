"""Genera le icone PNG dell'app (campo da calcio stilizzato) senza dipendenze esterne."""
import math
import struct
import sys
import zlib
from pathlib import Path

VERDE = (31, 111, 71)
BIANCO = (255, 255, 255)


def png(percorso, w, h, pixel):
    righe = b''.join(b'\x00' + bytes(pixel[y * w * 3:(y + 1) * w * 3]) for y in range(h))
    def blocco(tipo, dati):
        return struct.pack('>I', len(dati)) + tipo + dati + struct.pack('>I', zlib.crc32(tipo + dati) & 0xffffffff)
    contenuto = (b'\x89PNG\r\n\x1a\n'
                 + blocco(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
                 + blocco(b'IDAT', zlib.compress(righe, 9))
                 + blocco(b'IEND', b''))
    Path(percorso).write_bytes(contenuto)


def icona(n):
    # Coordinate normalizzate 0..1; campo verticale centrato nella zona sicura delle icone maskable.
    sx, sy, ex, ey = 0.30, 0.22, 0.70, 0.78   # rettangolo del campo
    spessore = 0.022
    raggio = 0.085
    pixel = bytearray(n * n * 3)
    for y in range(n):
        for x in range(n):
            px, py = (x + 0.5) / n, (y + 0.5) / n
            # distanza dal bordo del rettangolo
            dx = max(sx - px, 0, px - ex)
            dy = max(sy - py, 0, py - ey)
            fuori = math.hypot(dx, dy)
            dentro = min(px - sx, ex - px, py - sy, ey - py)
            d_rett = fuori if fuori > 0 else abs(dentro)
            d_meta = abs(py - 0.5) if sx <= px <= ex else 1
            d_cerchio = abs(math.hypot(px - 0.5, py - 0.5) - raggio)
            d_punto = math.hypot(px - 0.5, py - 0.5) - spessore
            # aree di rigore
            ax0, ax1 = 0.41, 0.59
            d_area = 1
            for (ay0, ay1) in ((sy, sy + 0.09), (ey - 0.09, ey)):
                ddx = max(ax0 - px, 0, px - ax1)
                ddy = max(ay0 - py, 0, py - ay1)
                f = math.hypot(ddx, ddy)
                i = min(px - ax0, ax1 - px, py - ay0, ay1 - py)
                d_area = min(d_area, f if f > 0 else abs(i))
            d = min(d_rett, d_meta, d_cerchio, d_area) - spessore / 2
            d = min(d, d_punto)
            a = max(0.0, min(1.0, 0.5 - d * n))  # copertura con bordo morbido di un pixel
            k = (y * n + x) * 3
            for c in range(3):
                pixel[k + c] = round(VERDE[c] * (1 - a) + BIANCO[c] * a)
    return pixel


def main(cartella):
    cartella = Path(cartella)
    cartella.mkdir(parents=True, exist_ok=True)
    for nome, n in (('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)):
        png(cartella / nome, n, n, icona(n))
        print('scritto', cartella / nome)


if __name__ == '__main__':
    main(sys.argv[1])
