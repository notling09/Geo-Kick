# Erzeugt das Adaptive-Icon-Foreground neu: transparentes Globus-Artwork
# (Flood-Fill vom Rand, Ball bleibt weiss) klein genug skaliert (52 %),
# dass keine Launcher-Maske etwas abschneidet. Hintergrundfarbe: app.json.
param(
  [string]$IconSrc = "C:\Users\nilto\Downloads\ChatGPT Image 3_07_2026, 12_22_56.png",
  [double]$Scale = 0.52,
  [string]$OutPath = "C:\Users\nilto\ownproj\Geo-Kick\assets\android-icon-foreground.png"
)

Add-Type -AssemblyName System.Drawing

$code = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class FgTool {
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
    return px[idx] >= threshold && px[idx + 1] >= threshold && px[idx + 2] >= threshold;
  }

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
    for (int y = 0; y < h; y++)
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
    SetArgb(bmp, px);
    return bmp;
  }

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

  public static Bitmap Canvas(Bitmap src, int size, double contentScale) {
    var bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(bmp)) {
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      double target = size * contentScale;
      double scale = Math.Min(target / src.Width, target / src.Height);
      int dw = (int)(src.Width * scale), dh = (int)(src.Height * scale);
      g.DrawImage(src, (size - dw) / 2, (size - dh) / 2, dw, dh);
    }
    return bmp;
  }

  // Box der "kraeftigen" Pixel (nicht fast-weiss): blasse Geisterreste
  // verschieben sonst das sichtbare Motiv aus der Mitte.
  public static Rectangle StrongBounds(Bitmap src) {
    var rect = new Rectangle(0, 0, src.Width, src.Height);
    var data = src.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    int stride = data.Stride;
    var px = new byte[Math.Abs(stride) * src.Height];
    Marshal.Copy(data.Scan0, px, 0, px.Length);
    src.UnlockBits(data);
    int w = src.Width, h = src.Height;
    int minX = w, minY = h, maxX = -1, maxY = -1;
    for (int y = 0; y < h; y++)
      for (int x = 0; x < w; x++) {
        int idx = y * stride + x * 4;
        if (px[idx + 3] <= 8) continue;
        int m = Math.Min(px[idx], Math.Min(px[idx + 1], px[idx + 2]));
        if (m >= 190) continue; // fast-weisse Pixel ignorieren
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    if (maxX < 0) return new Rectangle(0, 0, w, h);
    return new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
  }

  // Wie Canvas, aber zentriert auf die StrongBounds-Mitte und skaliert
  // relativ zur StrongBounds-Groesse (Ball/Outline bleiben erhalten).
  public static Bitmap CanvasCentered(Bitmap src, int size, double contentScale) {
    var strong = StrongBounds(src);
    var bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(bmp)) {
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      double target = size * contentScale;
      double scale = Math.Min(target / strong.Width, target / strong.Height);
      double cx = strong.X + strong.Width / 2.0, cy = strong.Y + strong.Height / 2.0;
      int dw = (int)(src.Width * scale), dh = (int)(src.Height * scale);
      int ox = (int)(size / 2.0 - cx * scale), oy = (int)(size / 2.0 - cy * scale);
      g.DrawImage(src, ox, oy, dw, dh);
    }
    return bmp;
  }
}
'@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$src = [System.Drawing.Bitmap]::FromFile($IconSrc)
$transparent = [FgTool]::OuterWhiteToTransparent($src, 240)
$cropped = [FgTool]::CropToContent($transparent, 0.02)
$fg = [FgTool]::CanvasCentered($cropped, 1024, $Scale)
$fg.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
"written: $OutPath (scale $Scale)"
$src.Dispose(); $transparent.Dispose(); $cropped.Dispose(); $fg.Dispose()
