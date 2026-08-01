Arca Majora 3 (Bold) is a commercial display font from OH no Type Co — it isn't on Google
Fonts, so it can't be auto-linked the way Open Sans is.

If you have a license (e.g. an Adobe Fonts / Typekit subscription or purchased desktop
license), export/convert the Bold weight to woff2 and drop it here as:

  ArcaMajora3-Bold.woff2

style.css already has an @font-face pointing at that exact path, so it'll pick it up
automatically once the file exists — no other changes needed. Until then, the "Robyn Luk"
logo falls back to Poppins / Open Sans.
