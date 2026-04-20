const fs = require('fs');
const path = require('path');

// Basic normalizer for matching (lowercase, trim, collapse spaces)
function norm(s) {
  return (s || '').toString().toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function parseLatLng(s) {
  if (!s) return null;
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
}

// Expand simple alias lists from district + landmarks + common spellings
function expandAliases(row) {
  const names = [];
  const district = row['District (Khet)'] || row.District || row.Khet || '';
  if (district) names.push(district);
  const landmarks = row['Notable Landmarks / Places'] || row.Landmarks || '';
  if (landmarks) names.push(...landmarks.split(',').map(s => s.trim()));

  // Thai/EN common variants for frequent hotspots (add more as needed)
  const specials = {
    'Phaya Thai': ['phaya thai', 'phyathai', 'payathai', 'พญาไท', 'bts พญาไท', 'arl พญาไท', 'bts phaya thai', 'arl phaya thai'],
    'Ratchathewi': ['ratchathewi', 'ราชเทวี', 'victory monument', 'อนุสาวรีย์ชัยสมรภูมิ'],
    'Pathum Wan': ['pathum wan', 'ปทุมวัน', 'siam', 'siam square', 'สยาม', 'สยามสแควร์'],
    'Watthana': ['watthana', 'วัฒนา', 'thong lo', 'ทองหล่อ', 'ekkamai', 'เอกมัย', 'asok', 'อโศก']
  };

  const out = new Set();
  for (const n of names) out.add(norm(n));
  for (const k in specials) {
    if (out.has(norm(k))) {
      for (const v of specials[k]) out.add(norm(v));
    }
  }
  return Array.from(out);
}

function loadAnchors(csvPath) {
  const abs = path.resolve(csvPath);
  const text = fs.readFileSync(abs, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
    const row = {};
    for (let j = 0; j < header.length; j++) row[header[j]] = cols[j] || '';
    rows.push(row);
  }

  const anchors = [];
  for (const row of rows) {
    const ll = parseLatLng(row['Coordinates']);
    if (!ll) continue;
    const labels = expandAliases(row);
    if (!labels.length) continue;
    anchors.push({ labels, lat: ll.lat, lng: ll.lng, raw: row });
  }
  return anchors;
}

module.exports = { loadAnchors, norm };
