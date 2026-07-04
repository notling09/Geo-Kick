# Stellt das Globus-Artwork aus einem Bild mit BLAUEM Gradient-Hintergrund
# frei: Flood-Fill vom Rand ueber "reines Blau" (R sehr niedrig, B hoch).
# Der Globus-Ozean ist zwar auch blau, hat aber einen helleren Rand/Glow,
# der den Fill stoppen sollte - Ergebnis unbedingt visuell pruefen!
param(
  [string]$Src = "C:\Users\nilto\Downloads\ChatGPT Image 4_07_2026, 15_11_09.png",
  [string]$OutPath = "C:\Users\nilto\ownproj\Geo-Kick\assets\images\artwork-noswoosh.png",
  [int]$MaxR = 50,
  [int]$MinB = 120
)

Add-Type -AssemblyName System.Drawing

$code = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class BlueTool {
  // Alles pfadbasiert, damit keine Bitmap-Objekte die PS/C#-Grenze kreuzen
  public static string Run(string srcPath, string outPath, int maxR, int minB, double padFrac) {
    using (var src = new Bitmap(srcPath))
    using (var extracted = Extract(src, maxR, minB))
    using (var cropped = CropToContent(extracted, padFrac)) {
      cropped.Save(outPath, ImageFormat.Png);
      return cropped.Width + "x" + cropped.Height;
    }
  }

  public static Bitmap Extract(Bitmap src, int maxR, int minB) {
    var bmp = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(bmp)) g.DrawImage(src, 0, 0, src.Width, src.Height);
    var rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
    var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int stride = data.Stride;
    var px = new byte[Math.Abs(stride) * bmp.Height];
    Marshal.Copy(data.Scan0, px, 0, px.Length);
    int w = bmp.Width, h = bmp.Height;
    var outside = new bool[w * h];
    var queue = new Queue<int>();

    // BGRA: px[idx]=B, +1=G, +2=R
    Func<int, int, bool> isBg = (x, y) => {
      int idx = y * stride + x * 4;
      int b = px[idx], g2 = px[idx + 1], r = px[idx + 2];
      return r <= maxR && b >= minB && g2 <= (int)(0.78 * b);
    };
    Action<int, int> tryEnqueue = (x, y) => {
      int i = y * w + x;
      if (outside[i]) return;
      if (isBg(x, y)) { outside[i] = true; queue.Enqueue(i); }
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
      for (int x = 0; x < w; x++)
        if (outside[y * w + x]) px[y * stride + x * 4 + 3] = 0;
    Marshal.Copy(px, 0, data.Scan0, px.Length);
    bmp.UnlockBits(data);
    return bmp;
  }

  public static Bitmap CropToContent(Bitmap src, double padFrac) {
    var rect = new Rectangle(0, 0, src.Width, src.Height);
    var data = src.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    int stride = data.Stride;
    var px = new byte[Math.Abs(stride) * src.Height];
    Marshal.Copy(data.Scan0, px, 0, px.Length);
    src.UnlockBits(data);
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
    return src.Clone(new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1), PixelFormat.Format32bppArgb);
  }
}
'@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$dims = [BlueTool]::Run($Src, $OutPath, $MaxR, $MinB, 0.02)
"written: $OutPath ($dims)"
