# Entfernt den dunkelgruenen Swoosh aus dem weissen Original-Icon:
# dunkelgruene Pixel in den Swoosh-Regionen (unterhalb/rechts des Globus)
# werden weiss uebermalt. Ergebnis dient als Quelle fuer die ueblichen
# Freistellungs-Skripte.
param(
  [string]$Src = "C:\Users\nilto\Downloads\ChatGPT Image 3_07_2026, 12_22_56.png",
  [string]$OutPath = "C:\Users\nilto\ownproj\Geo-Kick\assets\images\icon-source-noswoosh.png"
)

Add-Type -AssemblyName System.Drawing

$code = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class SwooshTool {
  public static string Run(string srcPath, string outPath) {
    using (var src = new Bitmap(srcPath))
    using (var bmp = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb)) {
      using (var g = Graphics.FromImage(bmp)) g.DrawImage(src, 0, 0, src.Width, src.Height);
      var rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
      var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
      int stride = data.Stride;
      var px = new byte[Math.Abs(stride) * bmp.Height];
      Marshal.Copy(data.Scan0, px, 0, px.Length);
      int w = bmp.Width, h = bmp.Height;
      int erased = 0;

      for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
          // Swoosh-Regionen (relativ zur Bildgroesse): unterhalb des Globus,
          // linker Auslauf und rechter Auslauf - der Globus selbst bleibt tabu
          double rx = (double)x / w, ry = (double)y / h;
          bool inRegion =
            ry > 0.655 ||                      // unterhalb des Globus
            (rx < 0.27 && ry > 0.58) ||        // linker Auslauf
            (rx > 0.73 && ry > 0.55) ||        // rechter Globusrand unten
            (rx > 0.76 && ry > 0.42);          // rechter Auslauf (entlang Globusrand)
          if (!inRegion) continue;

          int idx = y * stride + x * 4;
          int b = px[idx], g2 = px[idx + 1], r = px[idx + 2];
          // dunkles Gruen (Swoosh); helle Kontinent-Gruens bleiben unberuehrt
          bool darkGreen = g2 > r + 25 && g2 > b + 15 && g2 < 175;
          // sehr dunkle Gruenschatten des Verlaufs: nur SATTES Gruen
          // (die gruenlich-schwarze Spieler-Silhouette bleibt unberuehrt)
          bool shadowGreen = g2 >= 60 && g2 < 130 && g2 > r * 1.8 && g2 > b * 1.4;
          // blasse Geister-Konturen des Swoosh: nur GRUENSTICHIGE helle Toene
          // (neutrale Grautoene wie Schuh-Schattierungen bleiben unberuehrt)
          int min = Math.Min(b, Math.Min(g2, r)), max = Math.Max(b, Math.Max(g2, r));
          bool paleGhost = min >= 180 && (max - min) <= 45 && min < 255 && (g2 - r) >= 8;
          if (darkGreen || shadowGreen || paleGhost) {
            px[idx] = 255; px[idx + 1] = 255; px[idx + 2] = 255; px[idx + 3] = 255;
            erased++;
          }
        }
      }
      Marshal.Copy(px, 0, data.Scan0, px.Length);
      bmp.UnlockBits(data);
      bmp.Save(outPath, ImageFormat.Png);
      return erased.ToString();
    }
  }
}
'@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$count = [SwooshTool]::Run($Src, $OutPath)
"written: $OutPath (erased $count px)"
