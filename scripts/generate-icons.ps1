$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$iconsDir = Join-Path $projectRoot "icons"
New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null

$sizes = @(16, 48, 128)

foreach ($size in $sizes) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $radius = [Math]::Max([int]($size * 0.22), 3)
  $rect = New-Object System.Drawing.RectangleF 0, 0, ($size - 1), ($size - 1)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($rect.X, $rect.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()

  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF 0, 0),
    (New-Object System.Drawing.PointF $size, $size),
    ([System.Drawing.Color]::FromArgb(255, 242, 247, 255)),
    ([System.Drawing.Color]::FromArgb(255, 214, 228, 255))
  )
  $graphics.FillPath($bgBrush, $path)

  $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 108, 134, 178)), ([Math]::Max($size * 0.045, 1))
  $graphics.DrawPath($borderPen, $path)

  $nodeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 43, 68, 109))
  $linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 88, 112, 153)), ([Math]::Max($size * 0.07, 1.5))
  $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $cx = $size / 2
  $topY = $size * 0.28
  $midY = $size * 0.5
  $bottomY = $size * 0.72
  $leftX = $size * 0.28
  $rightX = $size * 0.72

  $graphics.DrawLine($linePen, $leftX, $midY, $cx, $topY)
  $graphics.DrawLine($linePen, $cx, $topY, $rightX, $midY)
  $graphics.DrawLine($linePen, $leftX, $midY, $rightX, $midY)
  $graphics.DrawLine($linePen, $leftX, $midY, $cx, $bottomY)
  $graphics.DrawLine($linePen, $rightX, $midY, $cx, $bottomY)

  $nodeSize = [Math]::Max($size * 0.14, 2)
  foreach ($point in @(
      @{ X = $cx; Y = $topY },
      @{ X = $leftX; Y = $midY },
      @{ X = $rightX; Y = $midY },
      @{ X = $cx; Y = $bottomY }
    )) {
    $graphics.FillEllipse($nodeBrush, $point.X - $nodeSize / 2, $point.Y - $nodeSize / 2, $nodeSize, $nodeSize)
  }

  $bitmap.Save((Join-Path $iconsDir "icon$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)

  $linePen.Dispose()
  $nodeBrush.Dispose()
  $borderPen.Dispose()
  $bgBrush.Dispose()
  $path.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Output "Generated icons in $iconsDir"
