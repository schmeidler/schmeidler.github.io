# Disease Network

A simplified, graph-based interface for exploring the existing RBM disease model built from PrimeKG (`kg.csv`).

## Run locally

The app loads `data.json` with `fetch()`, so open it through a local web server rather than directly from the file system.

With Python:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Files

- `index.html` — English user interface
- `style.css` — responsive monochrome design with light and dark themes
- `app.js` — search, cosine similarity and interactive disease network
- `data.json` — prepared application data
- `model.npz` — model artefact
- `model-report.json` — model report
- `build_model.py` — model-building script

## Network

The selected disease is shown as the central node. Its nearest neighbours are arranged around it. Visible neighbouring diseases are also compared with one another, so the graph contains secondary connections instead of only spokes from the centre.

The graph deliberately does not display numeric similarity scores above nodes. Connections encode relative model similarity, while node positions are used only for visual layout.


## Languages

- `index.html` — English
- `index-de.html` — Deutsch

The language switch in the header links between the two pages.
