// Regenerates docs/api-structure.png from the mermaid block in api-structure.md.
// Run after editing that diagram:  node docs/render-diagram.js
// Rendering is remote (mermaid.ink), so this needs network but no local puppeteer.
const fs = require('fs');
const path = require('path');

const FENCE = '```';
const root = path.join(__dirname, '..');
const source = path.join(root, 'api-structure.md');
const target = path.join(__dirname, 'api-structure.png');

const text = fs.readFileSync(source, 'utf8');
const start = text.indexOf(`${FENCE}mermaid`);
if (start === -1) throw new Error('no mermaid block found in api-structure.md');

const bodyStart = text.indexOf('\n', start) + 1;
const code = text
    .slice(bodyStart, text.indexOf(FENCE, bodyStart))
    .replace(/\r\n/g, '\n')
    .trim();

const encoded = Buffer.from(code, 'utf8').toString('base64url');
const url = `https://mermaid.ink/img/${encoded}?type=png&theme=dark&bgColor=0d1117`;

(async () => {
    const res = await fetch(url);
    if (!res.ok) {
        // mermaid.ink answers 400 with the parse error, which is also our syntax check
        console.error(`render failed ${res.status}:`, (await res.text()).slice(0, 800));
        process.exit(1);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(target, buf);
    console.log(`wrote ${path.relative(root, target)} — ${buf.length} bytes`);
})();
