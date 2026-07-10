# Erzeugt einfache Platzhalter-Sounds (WAV, 22050 Hz mono 16-bit) fuer die
# App, bis echte Sounddateien vorliegen. Einfach die Dateien in assets/sounds/
# durch gleichnamige echte Dateien ersetzen (Format egal: wav/mp3, dann
# require-Pfade in src/core/services/sound.ts anpassen).
#
# Aufruf:  powershell -ExecutionPolicy Bypass -File scripts/gen-placeholder-sounds.ps1

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO;

public static class ToneGen {
    const int RATE = 22050;
    static Random rng = new Random(42);

    public static List<short> NewBuf() { return new List<short>(); }

    // Sinuston mit Ausklingen (decay 0..1: Anteil exponentielles Abklingen)
    public static void Tone(List<short> buf, double freq, int ms, double amp, double decay) {
        int n = RATE * ms / 1000;
        for (int i = 0; i < n; i++) {
            double t = (double)i / RATE;
            double env = decay > 0 ? Math.Exp(-decay * 6.0 * i / n) : 1.0;
            double fadeIn = Math.Min(1.0, i / (RATE * 0.005));
            double v = Math.Sin(2 * Math.PI * freq * t) * amp * env * fadeIn;
            buf.Add((short)(v * 32000));
        }
    }

    // Zwei ueberlagerte Sinustoene (Akkord/Detune)
    public static void Duo(List<short> buf, double f1, double f2, int ms, double amp, double decay) {
        int n = RATE * ms / 1000;
        for (int i = 0; i < n; i++) {
            double t = (double)i / RATE;
            double env = Math.Exp(-decay * 6.0 * i / n);
            double v = (Math.Sin(2 * Math.PI * f1 * t) + Math.Sin(2 * Math.PI * f2 * t)) * 0.5 * amp * env;
            buf.Add((short)(v * 32000));
        }
    }

    // Frequenz-Sweep
    public static void Sweep(List<short> buf, double f1, double f2, int ms, double amp) {
        int n = RATE * ms / 1000;
        double phase = 0;
        for (int i = 0; i < n; i++) {
            double frac = (double)i / n;
            double f = f1 + (f2 - f1) * frac;
            phase += 2 * Math.PI * f / RATE;
            double fade = Math.Min(1.0, Math.Min(i / (RATE * 0.01), (n - i) / (RATE * 0.03)));
            buf.Add((short)(Math.Sin(phase) * amp * fade * 32000));
        }
    }

    // Rauschimpuls (Blitz/Knistern)
    public static void Noise(List<short> buf, int ms, double amp) {
        int n = RATE * ms / 1000;
        for (int i = 0; i < n; i++) {
            double env = Math.Exp(-8.0 * i / n);
            buf.Add((short)((rng.NextDouble() * 2 - 1) * amp * env * 32000));
        }
    }

    public static void Silence(List<short> buf, int ms) {
        int n = RATE * ms / 1000;
        for (int i = 0; i < n; i++) buf.Add(0);
    }

    public static void Write(string path, List<short> buf) {
        using (var fs = new FileStream(path, FileMode.Create))
        using (var w = new BinaryWriter(fs)) {
            int dataLen = buf.Count * 2;
            w.Write(System.Text.Encoding.ASCII.GetBytes("RIFF"));
            w.Write(36 + dataLen);
            w.Write(System.Text.Encoding.ASCII.GetBytes("WAVEfmt "));
            w.Write(16); w.Write((short)1); w.Write((short)1);
            w.Write(RATE); w.Write(RATE * 2); w.Write((short)2); w.Write((short)16);
            w.Write(System.Text.Encoding.ASCII.GetBytes("data"));
            w.Write(dataLen);
            foreach (short s in buf) w.Write(s);
        }
    }
}
'@

$outDir = Join-Path $PSScriptRoot '..\assets\sounds'
New-Item -ItemType Directory -Force $outDir | Out-Null

# Tor: aufsteigender Jubel-Sweep + heller Blip
$b = [ToneGen]::NewBuf()
[ToneGen]::Sweep($b, 400, 900, 300, 0.5)
[ToneGen]::Tone($b, 1100, 180, 0.45, 3)
[ToneGen]::Write((Join-Path $outDir 'goal.wav'), $b)

# Abpfiff: klassischer Dreifach-Pfiff (kurz, kurz, lang)
$b = [ToneGen]::NewBuf()
[ToneGen]::Tone($b, 2200, 120, 0.4, 1); [ToneGen]::Silence($b, 80)
[ToneGen]::Tone($b, 2200, 120, 0.4, 1); [ToneGen]::Silence($b, 80)
[ToneGen]::Tone($b, 2200, 450, 0.4, 2)
[ToneGen]::Write((Join-Path $outDir 'fulltime.wav'), $b)

# Meister-Feier: kleine Fanfare (C-E-G-C Arpeggio + Schlusston)
$b = [ToneGen]::NewBuf()
[ToneGen]::Tone($b, 523, 160, 0.45, 1)
[ToneGen]::Tone($b, 659, 160, 0.45, 1)
[ToneGen]::Tone($b, 784, 160, 0.45, 1)
[ToneGen]::Duo($b, 1046, 523, 600, 0.5, 3)
[ToneGen]::Write((Join-Path $outDir 'champion.wav'), $b)

# Pack oeffnen: Whoosh nach oben
$b = [ToneGen]::NewBuf()
[ToneGen]::Sweep($b, 180, 1400, 450, 0.4)
[ToneGen]::Write((Join-Path $outDir 'pack-open.wav'), $b)

# Reveal Silber: kurzer Blitz-Knack + Zap
$b = [ToneGen]::NewBuf()
[ToneGen]::Noise($b, 120, 0.5)
[ToneGen]::Tone($b, 1500, 100, 0.4, 4)
[ToneGen]::Write((Join-Path $outDir 'reveal-silver.wav'), $b)

# Reveal Gold: warmer Glocken-Akkord
$b = [ToneGen]::NewBuf()
[ToneGen]::Duo($b, 660, 990, 900, 0.5, 3)
[ToneGen]::Write((Join-Path $outDir 'reveal-gold.wav'), $b)

# Reveal Legendaer: tieferer, laengerer Glocken-Akkord
$b = [ToneGen]::NewBuf()
[ToneGen]::Duo($b, 440, 660, 700, 0.5, 2)
[ToneGen]::Duo($b, 550, 825, 900, 0.45, 3)
[ToneGen]::Write((Join-Path $outDir 'reveal-legendary.wav'), $b)

# Reveal ???: unheimliches Wabern + Absturz nach unten
$b = [ToneGen]::NewBuf()
[ToneGen]::Duo($b, 300, 307, 900, 0.45, 0.5)
[ToneGen]::Sweep($b, 500, 80, 600, 0.45)
[ToneGen]::Write((Join-Path $outDir 'reveal-mystery.wav'), $b)

Get-ChildItem $outDir | ForEach-Object { "{0}  {1} bytes" -f $_.Name, $_.Length }
