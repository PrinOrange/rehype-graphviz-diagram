import fs from 'fs';
import assert from 'node:assert';
import path from 'node:path';
import {test} from 'node:test';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import {unified} from 'unified';
import rehypeGraphvizDiagram from '../src/index';
import {JSDOM} from 'jsdom';
import {fileURLToPath} from 'node:url';
import rehypeParse from 'rehype-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Basic Usage', async (t) => {
  const input = await fs.readFileSync(
    path.resolve(__dirname, './cases/basic-usage/input.html'),
    'utf-8',
  );
  const output = (
    await unified()
      .use(rehypeParse, {fragment: true})
      .use(rehypeGraphvizDiagram)
      .use(rehypeStringify)
      .process(input)
  ).toString();

  const dom = new JSDOM(output);
  const svg = dom.window.document.querySelector('figure > svg');

  assert.ok(svg != null);
});

test('Integrate Markdown', async (t) => {
  const input = await fs.readFileSync(
    path.resolve(__dirname, './cases/integrate-markdown/input.md'),
    'utf-8',
  );
  const output = (
    await unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeGraphvizDiagram)
      .use(rehypeStringify)
      .process(input)
  ).toString();

  const dom = new JSDOM(output);
  const svg = dom.window.document.querySelector('figure > svg');

  assert.ok(svg != null);
});
