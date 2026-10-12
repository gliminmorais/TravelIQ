import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseTicket } from '../src/lib/pdf/parser';
const fixtures = JSON.parse(readFileSync('public/samples/expected.json', 'utf8')) as {
  file: string;
  expected: Record<string, unknown>;
}[];
function flatten(value: unknown, prefix = ''): Record<string, unknown> {
  if (value !== null && typeof value === 'object')
    return Object.assign(
      {},
      ...Object.entries(value).map(([k, v]) => flatten(v, prefix ? prefix + '.' + k : k)),
    );
  return { [prefix]: value };
}
async function main() {
  const results = [];
  let matched = 0,
    total = 0;
  for (const fixture of fixtures) {
    const task = getDocument({
      data: new Uint8Array(readFileSync('public/samples/' + fixture.file)),
      useSystemFonts: true,
    });
    const pdf = await task.promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      for (const item of content.items)
        if ('str' in item) text += item.str + (item.hasEOL ? '\n' : ' ');
      text += '\n';
    }
    await task.destroy();
    const result = parseTicket(text),
      actual = flatten(result),
      expected = flatten(fixture.expected);
    const fields = Object.entries(expected).map(([field, value]) => ({
      field,
      correct: actual[field] === value,
    }));
    matched += fields.filter((f) => f.correct).length;
    total += fields.length;
    results.push({ file: fixture.file, parser: result.parser, fields });
  }
  const report = {
    dataset: 'Six generated fictional fixtures; not representative airline accuracy',
    documents: fixtures.length,
    fields: total,
    correct: matched,
    accuracy: matched / total,
    results,
  };
  mkdirSync('public/reports', { recursive: true });
  writeFileSync('public/reports/pdf-evaluation.json', JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      documents: fixtures.length,
      fields: total,
      correct: matched,
      accuracy: matched / total,
    }),
  );
  if (matched !== total) process.exitCode = 1;
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
