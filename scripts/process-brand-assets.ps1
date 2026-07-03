# Verarbeitet die vom Nutzer gelieferten Brand-Bilder (Icon + Wordmark-Logo)
# zu App-Assets. Weiss -> transparent nur per Flood-Fill vom Rand, damit
# innenliegende weisse Flaechen (Fussball!) erhalten bleiben.
param(
  [string]$IconSrc = "C:\Users\nilto\Downloads\ChatGPT Image 3_07_2026, 12_22_56.png",
  [string]$LogoSrc = "C:\Users\nilto\Downloads\ChatGPT Image 3. Juli 2026, 12_16_21.png",
  [string]$OutDir = "C:\Users\nilto\ownproj\Geo-Kick\assets"
)

Add-Type -AssemblyName System.Drawing

$code = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class BrandTool {
  static byte[] GetArgb(Bitmap bmp, out int stride) {
    var rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
    var data = bmp.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    stride = data.Stride;
    var bytes = new byte[Math.Abs(data.Stride) * bmp.Height];
    Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
    bmp.UnlockBits(data);
    return bytes;
  }

  static void SetArgb(Bitmap bmp, byte[] bytes) {
    var rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
    var data = bmp.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
    Marshal.Copy(bytes, 0, data.Scan0, bytes.Length);
    bmp.UnlockBits(data);
  }

  static bool NearWhite(byte[] px, int idx, int threshold) {
    // BGRA-Layout
    return px[idx] >= threshold && px[idx + 1] >= threshold && px[idx + 2] >= threshold;
  }

  // Flood-Fill vom Bildrand: nur aussen zusammenhaengendes Weiss wird transparent.
  public static Bitmap OuterWhiteToTransparent(Bitmap src, int threshold) {
    var bmp = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(bmp)) g.DrawImage(src, 0, 0, src.Width, src.Height);
    int stride;
    var px = GetArgb(bmp, out stride);
    int w = bmp.Width, h = bmp.Height;
    var outside = new bool[w * h];
    var queue = new Queue<int>();

    Action<int, int> tryEnqueue = (x, y) => {
      int i = y * w + x;
      if (outside[i]) return;
      int idx = y * stride + x * 4;
      if (NearWhite(px, idx, threshold)) { outside[i] = true; queue.Enqueue(i); }
    };

    for (int x = 0; x < w; x++) { tryEnqueue(x, 0); tryEnqueue(x, h - 1); }
    for (int y = 0; y < h; y++) { tryEnqueue(0, y); tryEnqueue(w - 1, y); }

    while (queue.Count > 0) {
      int i = queue.Dequeue();
      int x = i % w, y = i / w;
      if (x > 0) tryEnqueue(x - 1, y);
      if (x < w - 1) tryEnqueue(x + 1, y);
      if (y > 0) tryEnqueue(x, y - 1);
      if (y < h - 1) tryEnqueue(x, y + 1);
    }

    // Transparenz setzen + 1px-Feder an der Kante gegen weisse Saeume
    for (int y = 0; y < h; y++) {
      for (int x = 0; x < w; x++) {
        int i = y * w + x;
        int idx = y * stride + x * 4;
        if (outside[i]) { px[idx + 3] = 0; continue; }
        bool edge =
          (x > 0 && outside[i - 1]) || (x < w - 1 && outside[i + 1]) ||
          (y > 0 && outside[i - w]) || (y < h - 1 && outside[i + w]);
        if (edge) {
          int m = Math.Min(px[idx], Math.Min(px[idx + 1], px[idx + 2]));
          if (m >= 200) px[idx + 3] = (byte)(255 - (m - 200) * 255 / 55);
        }
      }
    }
    SetArgb(bmp, px);
    return bmp;
  }

  // Bounding-Box der nicht-transparenten Pixel, mit relativem Padding.
  public static Bitmap CropToContent(Bitmap src, double padFrac) {
    int stride;
    var px = GetArgb(src, out stride);
    int w = src.Width, h = src.Height;
    int minX = w, minY = h, maxX = -1, maxY = -1;
    for (int y = 0; y < h; y++)
      for (int x = 0; x < w; x++)
        if (px[y * stride + x * 4 + 3] > 8) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
    if (maxX < 0) return new Bitmap(src);
    int padX = (int)((maxX - minX) * padFrac), padY = (int)((maxY - minY) * padFrac);
    minX = Math.Max(0, minX - padX); maxX = Math.Min(w - 1, maxX + padX);
    minY = Math.Max(0, minY - padY); maxY = Math.Min(h - 1, maxY + padY);
    var rect = new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
    return src.Clone(rect, PixelFormat.Format32bppArgb);
  }

  // Zeichnet src zentriert und skaliert auf eine quadratische Leinwand.
  public static Bitmap Canvas(Bitmap src, int size, double contentScale, bool whiteBg) {
    var bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(bmp)) {
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      g.SmoothingMode = SmoothingMode.HighQuality;
      if (whiteBg) g.Clear(Color.White);
      double target = size * contentScale;
      double scale = Math.Min(target / src.Width, target / src.Height);
      int dw = (int)(src.Width * scale), dh = (int)(src.Height * scale);
      g.DrawImage(src, (size - dw) / 2, (size - dh) / 2, dw, dh);
    }
    return bmp;
  }
}
'@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

New-Item -ItemType Directory -Force "$OutDir\images" | Out-Null

$icon = [System.Drawing.Bitmap]::FromFile($IconSrc)
$logo = [System.Drawing.Bitmap]::FromFile($LogoSrc)

# 1) App-Icon 1024x1024, weisser Hintergrund
$iconMain = [BrandTool]::Canvas($icon, 1024, 1.0, $true)
$iconMain.Save("$OutDir\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# 2) Adaptive-Icon-Foreground: transparent, Inhalt in der sicheren Zone (~62%)
$iconT = [BrandTool]::OuterWhiteToTransparent($icon, 240)
$iconCropped = [BrandTool]::CropToContent($iconT, 0.02)
$fg = [BrandTool]::Canvas($iconCropped, 1024, 0.62, $false)
$fg.Save("$OutDir\android-icon-foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)

# 3) Splash-Icon (weisser Hintergrund)
$splash = [BrandTool]::Canvas($icon, 1024, 0.85, $true)
$splash.Save("$OutDir\splash-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# 4) Icon transparent (Loading-Screen)
$iconOverlay = [BrandTool]::Canvas($iconCropped, 512, 1.0, $false)
$iconOverlay.Save("$OutDir\images\icon-transparent.png", [System.Drawing.Imaging.ImageFormat]::Png)

# 5) Wordmark-Logo transparent + beschnitten (Start-Screen)
$logoT = [BrandTool]::OuterWhiteToTransparent($logo, 240)
$logoCropped = [BrandTool]::CropToContent($logoT, 0.04)
$logoCropped.Save("$OutDir\images\logo-wordmark.png", [System.Drawing.Imaging.ImageFormat]::Png)
"logo-wordmark: $($logoCropped.Width)x$($logoCropped.Height)"

$icon.Dispose(); $logo.Dispose(); $iconMain.Dispose(); $iconT.Dispose()
$iconCropped.Dispose(); $fg.Dispose(); $splash.Dispose(); $iconOverlay.Dispose()
$logoT.Dispose(); $logoCropped.Dispose()
"done"
