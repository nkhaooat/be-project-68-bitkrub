const fs = require('fs');
const path = require('path');

function addEntries(csv, entries) {
  const lines = csv.trimEnd().split(/\r?\n/);
  const header = lines[0];
  const body = lines.slice(1);
  for (const e of entries) {
    const row = [
      e.idx,
      e.district,
      `"${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}"`,
      `"${e.roads || ''}"`,
      `"${e.landmarks || ''}"`
    ].join(',');
    body.push(row);
  }
  return [header, ...body].join('\n') + '\n';
}

if (require.main === module) {
  const csvPath = path.join(__dirname, 'geo_anchors.csv');
  const orig = fs.readFileSync(csvPath, 'utf8');
  const next = addEntries(orig, [
    { idx: 51, district: 'Ari', lat: 13.7795, lng: 100.5443, roads: 'Phahonyothin, Ari Soi', landmarks: 'อารีย์, BTS Ari' },
    { idx: 52, district: 'Victory Monument', lat: 13.7620, lng: 100.5371, roads: 'Phaya Thai, Ratchawithi', landmarks: 'อนุสาวรีย์ชัยสมรภูมิ, BTS Victory Monument' },
    { idx: 53, district: 'Mo Chit', lat: 13.8034, lng: 100.5539, roads: 'Phahonyothin', landmarks: 'หมอชิต, BTS Mo Chit, Chatuchak Park' }
  ]);
  fs.writeFileSync(csvPath, next, 'utf8');
}

module.exports = { addEntries };