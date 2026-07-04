# Erzeugt die Rasen-Branding-Assets: Adaptive-Icon-Hintergrund (Rasenstreifen
# mit weissen Feldlinien) und das quadratische Basis-Icon (Rasen + Globus).
# Basisfarbe = Theme-Gruen #2E7D32 (wie PitchBackground 'day' und Splash).
Add-Type -AssemblyName System.Drawing

$size = 1024
$grass = [System.Drawing.ColorTranslator]::FromHtml("#2E7D32")
$stripe = [System.Drawing.ColorTranslator]::FromHtml("#3B8A40")
$lineColor = [System.Drawing.Color]::FromArgb(200, 255, 255, 255)

function New-PitchCanvas([int]$circleRadius) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear($grass)
  # Maeh-Streifen
  $stripeBrush = New-Object System.Drawing.SolidBrush($stripe)
  $stripeH = $size / 8
  for ($i = 0; $i -lt 8; $i += 2) {
    $g.FillRectangle($stripeBrush, 0, [int]($i * $stripeH), $size, [int]$stripeH)
  }
  # Mittellinie + Mittelkreis
  $pen = New-Object System.Drawing.Pen($lineColor, 12)
  $g.DrawLine($pen, 0, [int]($size / 2), $size, [int]($size / 2))
  $g.DrawEllipse($pen, [int]($size / 2 - $circleRadius), [int]($size / 2 - $circleRadius), [int]($circleRadius * 2), [int]($circleRadius * 2))
  $pen.Dispose(); $stripeBrush.Dispose()
  return @($bmp, $g)
}

# 1) Adaptive-Icon-Hintergrund: Mittelkreis so, dass er als Ring um den
#    Globus-Vordergrund (52 %) sichtbar bleibt
$r = New-PitchCanvas 300
$bg = $r[0]; $g = $r[1]
$g.Dispose()
$bg.Save("C:\Users\nilto\ownproj\Geo-Kick\assets\android-icon-background.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bg.Dispose()
"android-icon-background.png written"

# 2) Basis-Icon: Rasen + Globus (80 %), Mittelkreis als sichtbarer Ring
$art = [System.Drawing.Bitmap]::FromFile("C:\Users\nilto\ownproj\Geo-Kick\assets\images\icon-transparent.png")
$r = New-PitchCanvas 430
$icon = $r[0]; $g = $r[1]
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$artSize = [int]($size * 0.80)
$off = [int](($size - $artSize) / 2)
$g.DrawImage($art, $off, $off, $artSize, $artSize)
$g.Dispose()
$icon.Save("C:\Users\nilto\ownproj\Geo-Kick\assets\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$icon.Dispose(); $art.Dispose()
"icon.png written"
