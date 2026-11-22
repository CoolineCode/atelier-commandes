"""Assemble une démo en un seul fichier HTML (CSS, JS et logo intégrés).
Usage : python3 build_demo.py  ->  dist/demo.html
La démo force le mode "demo" (données dans le navigateur)."""
import base64, io, pathlib, re
from PIL import Image

root = pathlib.Path(__file__).parent
html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "style.css").read_text(encoding="utf-8")
js = (root / "script.js").read_text(encoding="utf-8")

img = Image.open(root / "assets" / "logo.png").resize((280, 280), Image.LANCZOS)
buf = io.BytesIO(); img.save(buf, "WEBP", quality=90, method=6)
logo = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()

config = "window.APP_CONFIG = { MODE: 'demo', NOM_BOUTIQUE: \"L'Atelier des Rêves\" };"
assert "</script" not in js.lower()

html = re.sub(r'(style\.css|config\.js|script\.js)\?v=[^"]*', r'\1', html)
html = html.replace('<link rel="stylesheet" href="style.css">', "<style>\n" + css + "\n</style>")
html = re.sub(r'\s*<link rel="manifest"[^>]*>', "", html)
html = html.replace("assets/logo.png", logo).replace("assets/icon-192.png", logo)
html = html.replace('<script src="config.js"></script>', "<script>" + config + "</script>")
html = html.replace('<script src="script.js"></script>', "<script>\n" + js + "\n</script>")

out = root / "dist"; out.mkdir(exist_ok=True)
(out / "demo.html").write_text(html, encoding="utf-8")
print("dist/demo.html", len(html) // 1024, "Ko")
