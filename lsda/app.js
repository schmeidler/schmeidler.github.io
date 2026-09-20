'use strict';

const $ = id => document.getElementById(id);
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isDE = document.documentElement.lang.toLowerCase().startsWith('de');
const locale = isDE ? 'de-AT' : 'en-GB';
const numberFormatter = new Intl.NumberFormat(locale);
const fmt = value => numberFormatter.format(value);
const fmt1 = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt3 = new Intl.NumberFormat(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const t = isDE ? {
  represented: 'im Modell dargestellte Erkrankungen',
  opened: name => `${name} wurde als Zentrum des Netzwerks geöffnet.`,
  openNode: name => `${name} als neues Zentrum öffnen`,
  graphLabel: name => `Netzwerk von Erkrankungen, die mit ${name} verwandt sind`,
  noneFound: 'Keine dargestellte Erkrankung gefunden. Versuche einen englischen Krankheitsnamen oder eine MONDO-ID.',
  data: 'Daten',
  relations: (rows, sourceDiseases, modeled) => `${rows} Beziehungen aus <b>kg.csv - PrimeKG</b>, mit ${sourceDiseases} Erkrankungen im Quellkatalog und ${modeled} Erkrankungen, die in diesem Modell dargestellt sind.`,
  phenotype: 'Phänotyp-Merkmale',
  gene: 'Gen-/Protein-Merkmale',
  pathway: 'Pathway-Merkmale',
  model: 'Modell',
  modelText: (algorithm, hidden, epochs) => `${algorithm}, ${hidden} verborgene Einheiten und ${epochs} Epochen. Die Ähnlichkeit wird aus mittelwertzentrierten, L2-normalisierten Hidden-Logits mittels Kosinus-Ähnlichkeit berechnet.`,
  modelCaveat: 'Verbindungen stellen Ähnlichkeit innerhalb dieses Modells dar. Sie sind keine Wahrscheinlichkeiten, Diagnosen oder Nachweise für Kausalität. Die Knotenpositionen dienen ausschließlich der Lesbarkeit des Netzwerks.',
  diagnostic: 'Technische Diagnostik',
  diagnosticText: (rbm, base) => `Recall@20 in der dokumentierten In-Sample-Diagnostik: RBM ${rbm} %, Prävalenz-Baseline ${base} %. 20 % der positiven Merkmale wurden nach dem Training maskiert; dies ist eine In-Sample-Diagnostik und kein unabhängiger Test.`,
  loadError: status => `Der Datensatz konnte nicht geladen werden (${status}).`,
  invalidData: 'Ungültiger Modelldatensatz.',
  unavailable: 'Modell nicht verfügbar',
  localServer: 'Bitte öffne die App über einen lokalen Webserver.',
  edgeDetails: 'Kantendetails',
  similarity: 'Ähnlichkeit',
  sharedEvidence: 'Gemeinsame Evidenz',
  topShared: 'Top 5 gemeinsame Merkmale',
  contribution: 'Beitrag',
  phenotypeShort: 'Phänotypen',
  geneShort: 'Gene / Proteine',
  pathwayShort: 'Pathways',
  phenotypeOne: 'Phänotyp',
  geneOne: 'Gen / Protein',
  pathwayOne: 'Pathway',
  noShared: 'Keine gemeinsamen ausgewählten Merkmale.',
  contributionNote: 'Contribution = relativer Anteil der blockweisen Jaccard-Überlappung; keine Attribution der RBM-Similarity.',
  closeEdge: 'Kantendetails schließen',
  openEdge: (a, b) => `Details zur Verbindung zwischen ${a} und ${b} öffnen`
} : {
  represented: 'diseases represented in the model',
  opened: name => `${name} opened as the centre of the network.`,
  openNode: name => `Open ${name} as the new centre`,
  graphLabel: name => `Network of diseases related to ${name}`,
  noneFound: 'No represented disease found. Try an English disease name or MONDO ID.',
  data: 'Data',
  relations: (rows, sourceDiseases, modeled) => `${rows} relationships from <b>kg.csv - PrimeKG</b>, with ${sourceDiseases} diseases in the source catalogue and ${modeled} diseases represented in this model.`,
  phenotype: 'Phenotype features',
  gene: 'Gene / protein features',
  pathway: 'Pathway features',
  model: 'Model',
  modelText: (algorithm, hidden, epochs) => `${algorithm}, ${hidden} hidden units and ${epochs} epochs. Similarity is calculated from mean-centred, L2-normalised hidden logits using cosine similarity.`,
  modelCaveat: 'Connections represent similarity within this model. They are not probabilities, diagnoses or evidence of causality. Node positions are used only to keep the network readable.',
  diagnostic: 'Technical diagnostic',
  diagnosticText: (rbm, base, description) => `Recall@20 in the documented in-sample diagnostic: RBM ${rbm}%, prevalence baseline ${base}%. ${description}`,
  loadError: status => `The data set could not be loaded (${status}).`,
  invalidData: 'Invalid model data set.',
  unavailable: 'Model unavailable',
  localServer: 'Please open the app through a local web server.',
  edgeDetails: 'Edge details',
  similarity: 'Similarity',
  sharedEvidence: 'Shared evidence',
  topShared: 'Top 5 shared features',
  contribution: 'Contribution',
  phenotypeShort: 'Phenotypes',
  geneShort: 'Genes / proteins',
  pathwayShort: 'Pathways',
  phenotypeOne: 'Phenotype',
  geneOne: 'Gene / protein',
  pathwayOne: 'Pathway',
  noShared: 'No shared selected features.',
  contributionNote: 'Contribution = relative share of block-wise Jaccard overlap; not an attribution of RBM similarity.',
  closeEdge: 'Close edge details',
  openEdge: (a, b) => `Open details for the connection between ${a} and ${b}`
};

let data;
let center = -1;
let catalogByIndex = [];
let featureDf = [];

function cosine(a, b){
  let dot = 0, na = 0, nb = 0;
  for(let i = 0; i < a.length; i++){
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? Math.max(-1, Math.min(1, dot / Math.sqrt(na * nb))) : 0;
}

function rank(index, count){
  return data.embeddings
    .map((embedding, i) => ({i, score: cosine(data.embeddings[index], embedding)}))
    .filter(x => x.i !== index)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, count);
}

function wrap(text, max = 24, maxLines = 2){
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for(const word of words){
    const candidate = (line + ' ' + word).trim();
    if(candidate.length > max && line){
      lines.push(line);
      line = word;
    }else{
      line = candidate;
    }
  }
  if(line) lines.push(line);
  if(lines.length > maxLines){
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, Math.max(1, max - 1)) + '…';
  }
  return lines;
}

function svgText(text, x, y, max = 24, className = 'node-label', maxLines = 2, gap = 15){
  const lines = wrap(text, max, maxLines);
  return `<text class="${className}" x="${x}" y="${y}" text-anchor="middle">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? gap : 0}">${escapeHtml(line)}</tspan>`).join('')}</text>`;
}

function nodeLabelGroup(text, x, y, max = 24, maxLines = 2, gap = 15, mobile = false, position = 'below', clearance = 0){
  const lines = wrap(text, max, maxLines);
  const longest = Math.max(...lines.map(line => line.length), 1);
  const charWidth = mobile ? 5.9 : 6.5;
  const width = Math.max(54, Math.min(mobile ? 150 : 210, longest * charWidth + 18));
  const height = 14 + (lines.length - 1) * gap + 12;
  let rectY;
  let textY;
  if(position === 'above'){
    const bottom = y - clearance;
    rectY = bottom - height;
    textY = rectY + 19;
  }else{
    const top = y - 14;
    rectY = top - 5;
    textY = y;
  }
  return `<g class="node-label-group" aria-hidden="true"><rect class="node-label-box" x="${(x - width / 2).toFixed(1)}" y="${rectY.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="8" ry="8"/>` +
    `<text class="node-label" x="${x}" y="${textY.toFixed(1)}" text-anchor="middle">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? gap : 0}">${escapeHtml(line)}</tspan>`).join('')}</text></g>`;
}

function selectDisease(record){
  if(!record || record.modelIndex < 0) return;
  center = record.modelIndex;
  $('search').value = record.name;
  $('searchResults').replaceChildren();
  $('diseaseName').textContent = record.name;
  $('diseaseMeta').textContent = `${record.source} · ${record.sourceId} · ${fmt(data.meta.modeledDiseases)} ${t.represented}`;
  renderGraph();
  $('status').textContent = t.opened(record.name);
}

function prepareFeatureStats(){
  featureDf = new Uint16Array(data.features.length);
  for(const disease of data.diseases){
    for(const block of disease.features){
      for(const featureIndex of block) featureDf[featureIndex] += 1;
    }
  }
}

function intersectFeatures(a, b){
  const setB = new Set(b);
  return a.filter(value => setB.has(value));
}

function contributionPercentages(scores){
  const total = scores.reduce((sum, value) => sum + value, 0);
  if(!total) return [0, 0, 0];
  const raw = scores.map(value => value / total * 100);
  const result = raw.map(Math.floor);
  let remaining = 100 - result.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({index, fraction: value - Math.floor(value)}))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for(let i = 0; i < remaining; i++) result[order[i % order.length].index] += 1;
  return result;
}

function explainEdge(aIndex, bIndex, score){
  const a = data.diseases[aIndex];
  const b = data.diseases[bIndex];
  const shared = a.features.map((block, index) => intersectFeatures(block, b.features[index]));
  const jaccard = shared.map((items, index) => {
    const union = new Set([...a.features[index], ...b.features[index]]).size;
    return union ? items.length / union : 0;
  });
  const contribution = contributionPercentages(jaccard);
  const allShared = [...new Set(shared.flat())];
  const ranked = allShared
    .map(featureIndex => {
      const feature = data.features[featureIndex];
      const idf = Math.log((data.diseases.length + 1) / ((featureDf[featureIndex] || 0) + 1)) + 1;
      return {featureIndex, feature, idf};
    })
    .sort((x, y) => y.idf - x.idf || x.feature.name.localeCompare(y.feature.name));
  const top = [];
  for(const kind of ['s', 'g', 'p']){
    const candidate = ranked.find(item => item.feature.kind === kind);
    if(candidate) top.push(candidate);
  }
  for(const candidate of ranked){
    if(top.length >= 5) break;
    if(!top.includes(candidate)) top.push(candidate);
  }
  return {score, shared, contribution, top};
}

function featureKindLabel(kind){
  if(kind === 's') return t.phenotypeOne;
  if(kind === 'g') return t.geneOne;
  return t.pathwayOne;
}

function edgeInspectorContent(aIndex, bIndex, score){
  const aName = catalogByIndex[aIndex].name;
  const bName = catalogByIndex[bIndex].name;
  const explanation = explainEdge(aIndex, bIndex, score);
  const labels = [t.phenotypeShort, t.geneShort, t.pathwayShort];
  const evidence = explanation.shared.map((items, index) => `
    <div class="edge-evidence-item"><strong>${fmt(items.length)}</strong><span>${labels[index]}</span></div>`).join('');
  const features = explanation.top.length
    ? explanation.top.map(({feature}) => `<li><span>${escapeHtml(feature.name)}</span><small>${escapeHtml(featureKindLabel(feature.kind))}</small></li>`).join('')
    : `<li class="edge-feature-empty">${t.noShared}</li>`;
  const contribution = explanation.contribution.map((value, index) => `
    <div class="edge-contribution-row">
      <span>${labels[index]}</span>
      <span class="edge-contribution-track" aria-hidden="true"><i style="width:${value}%"></i></span>
      <strong>${value}%</strong>
    </div>`).join('');
  return `
    <button class="edge-inspector-close" type="button" aria-label="${escapeHtml(t.closeEdge)}">×</button>
    <p class="edge-inspector-kicker">${t.edgeDetails}</p>
    <h3>${escapeHtml(aName)} <span aria-hidden="true">↔</span> ${escapeHtml(bName)}</h3>
    <div class="edge-similarity"><span>${t.similarity}</span><strong>${fmt3.format(score)}</strong></div>
    <section class="edge-inspector-section">
      <h4>${t.sharedEvidence}</h4>
      <div class="edge-evidence-grid">${evidence}</div>
    </section>
    <section class="edge-inspector-section">
      <h4>${t.topShared}</h4>
      <ol class="edge-feature-list">${features}</ol>
    </section>
    <section class="edge-inspector-section">
      <h4>${t.contribution}</h4>
      <div class="edge-contribution-list">${contribution}</div>
      <p class="edge-contribution-note">${t.contributionNote}</p>
    </section>`;
}

function edgeMarkup(aIndex, bIndex, score, x1, y1, x2, y2, className, strokeWidth){
  const aName = catalogByIndex[aIndex].name;
  const bName = catalogByIndex[bIndex].name;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return `<g class="edge-link" role="button" tabindex="0" data-a="${aIndex}" data-b="${bIndex}" data-score="${score}" data-mx="${mx}" data-my="${my}" aria-label="${escapeHtml(t.openEdge(aName, bName))}">
    <line class="edge-hit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
    <line class="edge-stroke ${className}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${strokeWidth.toFixed(2)}"/>
    <title>${escapeHtml(aName)} ↔ ${escapeHtml(bName)}</title>
  </g>`;
}

function openEdgeInspector(edge, graph, width, height){
  graph.querySelectorAll('.edge-link.is-selected').forEach(item => item.classList.remove('is-selected'));
  edge.classList.add('is-selected');
  const panel = graph.querySelector('.edge-inspector');
  const aIndex = Number(edge.dataset.a);
  const bIndex = Number(edge.dataset.b);
  const score = Number(edge.dataset.score);
  panel.innerHTML = edgeInspectorContent(aIndex, bIndex, score);
  panel.hidden = false;

  const mx = Number(edge.dataset.mx);
  const my = Number(edge.dataset.my);
  const mobile = width < 620;
  panel.classList.toggle('is-mobile', mobile);
  if(mobile){
    panel.style.left = '12px';
    panel.style.right = '12px';
    panel.style.top = 'auto';
    panel.style.bottom = '12px';
    panel.style.transform = 'none';
  }else{
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    requestAnimationFrame(() => {
      const panelWidth = panel.offsetWidth || 320;
      const panelHeight = panel.offsetHeight || 300;
      const x = Math.max(panelWidth / 2 + 16, Math.min(width - panelWidth / 2 - 16, mx));
      const placeAbove = my > panelHeight + 44;
      const y = placeAbove ? my - 14 : Math.min(height - panelHeight - 16, my + 14);
      panel.style.left = `${x}px`;
      panel.style.top = `${Math.max(16, y)}px`;
      panel.style.transform = placeAbove ? 'translate(-50%,-100%)' : 'translate(-50%,0)';
    });
  }

  panel.querySelector('.edge-inspector-close').addEventListener('click', event => {
    event.stopPropagation();
    panel.hidden = true;
    edge.classList.remove('is-selected');
  });
}

function buildPeerEdges(points){
  const candidates = [];
  const seen = new Set();
  for(const a of points){
    const local = points
      .filter(b => b.i !== a.i)
      .map(b => ({b, score: cosine(data.embeddings[a.i], data.embeddings[b.i])}))
      .sort((x, y) => y.score - x.score)
      .slice(0, 2);
    for(const {b, score} of local){
      const key = a.i < b.i ? `${a.i}:${b.i}` : `${b.i}:${a.i}`;
      if(seen.has(key)) continue;
      seen.add(key);
      candidates.push({a, b, score});
    }
  }
  return candidates.sort((x, y) => y.score - x.score).slice(0, Math.max(points.length + 2, 12));
}

function renderGraph(){
  if(center < 0 || !data) return;
  const graph = $('graph');
  const width = Math.max(320, graph.clientWidth || 900);
  const mobile = width < 620;
  const count = mobile ? 8 : 12;
  const height = mobile ? 530 : Math.min(720, Math.max(650, Math.round(width * 0.57)));
  const cx = width / 2;
  const cy = height / 2 - (mobile ? 8 : 0);
  const neighbors = rank(center, count);
  const ringX = Math.max(126, width * (mobile ? 0.34 : 0.36));
  const ringY = Math.max(168, height * (mobile ? 0.36 : 0.35));
  const points = neighbors.map((n, j) => {
    const angle = -Math.PI / 2 + j * 2 * Math.PI / neighbors.length;
    const alternating = j % 2 ? 0.92 : 1.03;
    return {...n, x: cx + Math.cos(angle) * ringX * alternating, y: cy + Math.sin(angle) * ringY * alternating, j};
  });

  const peerEdges = buildPeerEdges(points).map(({a, b, score}) => {
    const strokeWidth = 0.65 + Math.max(0, score) * 0.8;
    return edgeMarkup(a.i, b.i, score, a.x, a.y, b.x, b.y, 'peer-edge', strokeWidth);
  }).join('');

  const centerEdges = points.map(p => {
    const strokeWidth = 0.8 + Math.max(0, p.score) * 1.35;
    return edgeMarkup(center, p.i, p.score, cx, cy, p.x, p.y, 'center-edge', strokeWidth);
  }).join('');

  const nodeRadius = mobile ? 18 : 21;
  const labelGap = mobile ? 9 : 12;
  const nodes = points.map(p => {
    const name = catalogByIndex[p.i].name;
    const maxChars = mobile ? 15 : Math.max(18, Math.min(28, Math.floor(width / 42)));
    return `<g class="network-node" role="button" tabindex="0" data-index="${p.i}" aria-label="${escapeHtml(t.openNode(name))}">
      <circle class="node-disc" cx="${p.x}" cy="${p.y}" r="${nodeRadius}"/>
      <circle class="node-dot" cx="${p.x}" cy="${p.y}" r="${mobile ? 3.8 : 4.8}"/>
      ${nodeLabelGroup(name, p.x, p.y, maxChars, 2, mobile ? 13 : 15, mobile, 'above', nodeRadius + labelGap)}
      <title>${escapeHtml(name)}</title>
    </g>`;
  }).join('');

  const centerName = catalogByIndex[center].name;
  const centerMaxChars = mobile ? 18 : 27;
  const centerR = mobile ? 88 : 112;
  const centerLines = wrap(centerName, centerMaxChars, 3);
  const centerGap = mobile ? 15 : 18;
  const centerText = svgText(centerName, cx, cy - ((centerLines.length - 1) * centerGap) / 2 + (mobile ? 5 : 6), centerMaxChars, 'center-label', 3, centerGap);

  graph.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" aria-label="${escapeHtml(t.graphLabel(centerName))}">
    <g class="network-edges">${peerEdges}${centerEdges}</g>
    <circle class="center-disc" cx="${cx}" cy="${cy}" r="${centerR}"/>
    ${centerText}
    ${nodes}
  </svg>
  <aside class="edge-inspector" hidden></aside>`;
  graph.setAttribute('aria-busy', 'false');

  graph.querySelectorAll('.edge-link').forEach(edge => {
    const open = event => {
      event?.stopPropagation();
      openEdgeInspector(edge, graph, width, height);
    };
    edge.addEventListener('click', open);
    edge.addEventListener('keydown', event => {
      if(event.key === 'Enter' || event.key === ' '){ event.preventDefault(); open(event); }
    });
  });

  graph.querySelector('svg').addEventListener('click', event => {
    if(event.target.closest?.('.edge-link')) return;
    const panel = graph.querySelector('.edge-inspector');
    if(panel && !panel.hidden){
      panel.hidden = true;
      graph.querySelectorAll('.edge-link.is-selected').forEach(item => item.classList.remove('is-selected'));
    }
  });

  graph.querySelectorAll('.network-node').forEach(node => {
    const open = () => selectDisease(catalogByIndex[Number(node.dataset.index)]);
    node.addEventListener('click', open);
    node.addEventListener('keydown', event => {
      if(event.key === 'Enter' || event.key === ' '){ event.preventDefault(); open(); }
    });
  });
}

function search(){
  if(!data) return;
  const q = $('search').value.trim().toLowerCase();
  if(!q){ $('searchResults').replaceChildren(); return; }
  const found = data.catalog
    .filter(d => d.modelIndex >= 0 && (d.name.toLowerCase().includes(q) || d.sourceId.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 18);
  $('searchResults').innerHTML = found.length
    ? found.map(d => `<button type="button" data-id="${d.id}">${escapeHtml(d.name)}<small>${escapeHtml(d.source)} · ${escapeHtml(d.sourceId)}</small></button>`).join('')
    : `<p>${t.noneFound}</p>`;
  $('searchResults').querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => selectDisease(data.catalog.find(d => d.id === button.dataset.id)));
  });
}

function renderMethod(){
  const m = data.meta;
  const rbm = fmt1.format(m.diagnostic.rbmRecall20 * 100);
  const base = fmt1.format(m.diagnostic.prevalenceRecall20 * 100);
  $('methodContent').innerHTML = `
    <section class="method-section">
      <h3>${t.data}</h3>
      <p>${t.relations(fmt(m.sourceRows), fmt(m.sourceDiseases), fmt(m.modeledDiseases))}</p>
      <table class="method-table"><tbody>
        <tr><td>${t.phenotype}</td><td>${fmt(m.featureCounts.s)}</td></tr>
        <tr><td>${t.gene}</td><td>${fmt(m.featureCounts.g)}</td></tr>
        <tr><td>${t.pathway}</td><td>${fmt(m.featureCounts.p)}</td></tr>
      </tbody></table>
    </section>
    <section class="method-section">
      <h3>${t.model}</h3>
      <p>${escapeHtml(t.modelText(m.algorithm, m.hiddenUnits, m.epochs))}</p>
      <p>${t.modelCaveat}</p>
    </section>
    <section class="method-section">
      <h3>${t.diagnostic}</h3>
      <p>${escapeHtml(isDE ? t.diagnosticText(rbm, base) : t.diagnosticText(rbm, base, m.diagnostic.description))}</p>
    </section>`;
}

function setTheme(theme){
  const resolved = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = resolved;
  $('themeToggle').setAttribute('aria-pressed', String(resolved === 'dark'));
  try{ localStorage.setItem('disease-network-theme', resolved); }catch{}
}

function initTheme(){
  setTheme(document.documentElement.dataset.theme || 'light');
  $('themeToggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
}

function initMenu(){
  const toggle = $('menuToggle');
  const nav = $('main-nav');
  const close = () => { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); };
  toggle.addEventListener('click', () => {
    const open = !nav.classList.contains('open');
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', close));
  window.addEventListener('resize', () => { if(window.innerWidth > 950) close(); });
  return close;
}

async function init(){
  try{
    const response = await fetch('data.json');
    if(!response.ok) throw new Error(t.loadError(response.status));
    data = await response.json();
    if(!data.embeddings?.length || data.embeddings.length !== data.diseases.length) throw new Error(t.invalidData);
    for(const disease of data.catalog){ if(disease.modelIndex >= 0) catalogByIndex[disease.modelIndex] = disease; }
    prepareFeatureStats();
    renderMethod();
    const first = data.catalog.find(d => d.modelIndex >= 0 && d.name.toLowerCase() === 'parkinson disease')
      || data.catalog.find(d => d.modelIndex >= 0 && d.name.toLowerCase().includes('parkinson'))
      || catalogByIndex[0];
    selectDisease(first);
  }catch(error){
    $('diseaseName').textContent = t.unavailable;
    $('diseaseMeta').textContent = '';
    $('graph').setAttribute('aria-busy', 'false');
    $('graph').innerHTML = `<div class="graph-empty">${escapeHtml(error.message)}<br>${t.localServer}</div>`;
    $('status').textContent = error.message;
  }
}

$('search').addEventListener('input', search);
$('search').addEventListener('keydown', event => {
  if(event.key === 'Enter') $('searchResults').querySelector('button')?.click();
  if(event.key === 'Escape') $('searchResults').replaceChildren();
});
const closeMenu = initMenu();
$('methodButton').addEventListener('click', () => { closeMenu(); $('methodDialog').showModal(); });
$('closeDialog').addEventListener('click', () => $('methodDialog').close());
$('methodDialog').addEventListener('click', event => { if(event.target === $('methodDialog')) $('methodDialog').close(); });
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderGraph, 140); });
initTheme();
init();
