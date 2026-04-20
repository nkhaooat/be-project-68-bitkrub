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

// Expand alias list for district rows (original format)
function expandDistrictAliases(row) {
  const names = [];
  const district = row['District (Khet)'] || row.District || row.Khet || '';
  if (district) names.push(district);
  const landmarks = row['Notable Landmarks / Places'] || row.Landmarks || '';
  if (landmarks) names.push(...landmarks.split(',').map(s => s.trim()));

  // Thai/EN common variants for frequent hotspots
  const specials = {
    'Phaya Thai': ['phaya thai', 'phyathai', 'payathai', 'พญาไท', 'bts พญาไท', 'arl พญาไท', 'bts phaya thai', 'arl phaya thai'],
    'Ratchathewi': ['ratchathewi', 'ราชเทวี', 'victory monument', 'อนุสาวรีย์ชัยสมรภูมิ'],
    'Pathum Wan': ['pathum wan', 'ปทุมวัน', 'siam', 'siam square', 'สยาม', 'สยามสแควร์'],
    'Watthana': ['watthana', 'วัฒนา', 'thong lo', 'ทองหล่อ', 'ekkamai', 'เอกมัย', 'asok', 'อโศก'],
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

// Expand alias list for transit station rows (name,lat,lng,aliases,type format)
function expandTransitAliases(row) {
  const out = new Set();
  if (row.name) out.add(norm(row.name));
  if (row.aliases) {
    for (const a of row.aliases.split(',')) {
      const t = a.trim();
      if (t) out.add(norm(t));
    }
  }
  // Thai alias map for major transit stations
  const thaiMap = {
    'siam':               ['สยาม', 'สยามสแควร์'],
    'asok':               ['อโศก', 'อโศกมนตรี'],
    'mo chit':            ['หมอชิต'],
    'victory monument':   ['อนุสาวรีย์ชัยสมรภูมิ', 'วิคตอรี่'],
    'phaya thai':         ['พญาไท'],
    'ari':                ['อารีย์'],
    'on nut':             ['อ่อนนุช'],
    'ekkamai':            ['เอกมัย'],
    'thong lo':           ['ทองหล่อ'],
    'nana':               ['นานา'],
    'sala daeng':         ['ศาลาแดง'],
    'chong nonsi':        ['ช่องนนทรี'],
    'saphan taksin':      ['สะพานตากสิน'],
    'bearing':            ['แบริ่ง'],
    'udom suk':           ['อุดมสุข'],
    'bang na':            ['บางนา'],
    'phrom phong':        ['พร้อมพงษ์'],
    'hua lamphong':       ['หัวลำโพง'],
    'chatuchak park':     ['ชตุจักร', 'จตุจักร'],
    'kamphaeng phet':     ['กำแพงเพชร'],
    'lat phrao':          ['ลาดพร้าว'],
    'makkasan':           ['มักกะสัน'],
    'suvarnabhumi':       ['สุวรรณภูมิ'],
  };
  for (const [en, thList] of Object.entries(thaiMap)) {
    if (out.has(norm(en))) {
      for (const th of thList) out.add(norm(th));
    }
  }
  return Array.from(out);
}

/**
 * Parse a CSV block given its header line and data lines.
 * Returns array of raw row objects.
 */
function parseBlock(headerLine, dataLines) {
  const header = splitCsvLine(headerLine);
  return dataLines
    .filter(l => l.trim())
    .map(l => {
      const cols = splitCsvLine(l);
      const row = {};
      for (let j = 0; j < header.length; j++) row[header[j]] = cols[j] || '';
      return row;
    });
}

/** CSV line splitter that handles quoted fields */
function splitCsvLine(line) {
  return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
}

function loadAnchors(csvPath) {
  const abs = path.resolve(csvPath);
  const text = fs.readFileSync(abs, 'utf8');
  const allLines = text.split(/\r?\n/);

  // Split into blocks by finding header lines
  // District block header: "#,District (Khet),..."
  // Transit block header:  "name,lat,lng,aliases,type"
  const blocks = [];
  let currentHeader = null;
  let currentData = [];
  for (const line of allLines) {
    if (!line.trim()) {
      if (currentHeader && currentData.length) {
        blocks.push({ header: currentHeader, data: [...currentData] });
        currentHeader = null;
        currentData = [];
      }
      continue;
    }
    // Detect header lines
    if (line.startsWith('#,District') || line.startsWith('name,lat,lng')) {
      if (currentHeader && currentData.length) {
        blocks.push({ header: currentHeader, data: [...currentData] });
      }
      currentHeader = line;
      currentData = [];
    } else if (currentHeader) {
      currentData.push(line);
    }
  }
  if (currentHeader && currentData.length) {
    blocks.push({ header: currentHeader, data: currentData });
  }

  const anchors = [];
  for (const block of blocks) {
    const isTransit = block.header.startsWith('name,lat,lng');
    const rows = parseBlock(block.header, block.data);

    for (const row of rows) {
      let ll, labels;
      if (isTransit) {
        // Transit row: lat and lng are separate columns
        const lat = parseFloat(row.lat);
        const lng = parseFloat(row.lng);
        if (isNaN(lat) || isNaN(lng)) continue;
        ll = { lat, lng };
        labels = expandTransitAliases(row);
      } else {
        // District row: coordinates in one "Coordinates" column
        ll = parseLatLng(row['Coordinates']);
        if (!ll) continue;
        labels = expandDistrictAliases(row);
      }
      if (!labels.length) continue;
      anchors.push({ labels, lat: ll.lat, lng: ll.lng, raw: row });
    }
  }

  return anchors;
}

module.exports = { loadAnchors, norm };
