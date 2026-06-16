# Deploy script for Obsidian System Template GitHub Pages
# Run this script inside the html-export folder to publish updates to GitHub Pages.

$homeFile = "000-home-moc.html"
$indexFile = "index.html"

# 1. Copy the Home MOC to serve as index.html
if (Test-Path $homeFile) {
    Copy-Item $homeFile $indexFile -Force
    Write-Host "Success: Created index.html from 000-home-moc.html." -ForegroundColor Green
} else {
    Write-Error "Error: Could not find $homeFile. Make sure you run the HTML export in Obsidian first."
    Exit 1
}

# 2. Stage, commit, and push the exported files
git add -A
git commit -m "Deploy website update"
git push origin gh-pages

Write-Host "Success: Site deployed successfully to GitHub Pages!" -ForegroundColor Green
