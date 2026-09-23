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
import type {Element, Root} from 'hast';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Run an html fixture in `cases/<name>/input.html` through the plugin and parse the result. */
const renderHtmlCase = async (name: string) => {
  const input = await fs.readFileSync(
    path.resolve(__dirname, `./cases/${name}/input.html`),
    'utf-8',
  );
  const output = (
    await unified()
      .use(rehypeParse, {fragment: true})
      .use(rehypeGraphvizDiagram)
      .use(rehypeStringify)
      .process(input)
  ).toString();

  return new JSDOM(output).window.document;
};

/** True when a graphviz diagram was rendered into the document. */
const hasDiagram = (document: Document) => document.querySelector('figure > svg') != null;

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

test('MDC / Nuxt Content Structure', async (t) => {
  // `@nuxtjs/mdc` puts the language on the `pre` and leaves the `code` bare
  const document = await renderHtmlCase('mdc-structure');

  assert.ok(hasDiagram(document));

  // The code block attributes must not survive as attributes on the container
  const figure = document.querySelector('figure');
  assert.equal(figure?.getAttribute('code'), null);
  assert.equal(figure?.getAttribute('language'), null);
  assert.equal(figure?.getAttribute('meta'), null);
});

test('MDC Code Property Fallback', async (t) => {
  // No `code` element at all, so the source has to come from `pre.properties.code`
  const document = await renderHtmlCase('mdc-code-property');

  assert.ok(hasDiagram(document));
});

test('Highlighted Code Block', async (t) => {
  // A highlighter has already wrapped the source in spans, and the `pre` carries
  // a space separated class string instead of the token array `remark-rehype` builds
  const document = await renderHtmlCase('highlighted');

  assert.ok(hasDiagram(document));
});

test('Language On Pre Element Only', async (t) => {
  const document = await renderHtmlCase('pre-class-only');

  assert.ok(hasDiagram(document));
});

test('Unsupported Language Is Left Alone', async (t) => {
  const document = await renderHtmlCase('unsupported-language');

  assert.equal(hasDiagram(document), false);
  const pre = document.querySelector('pre');
  assert.ok(pre != null);
  assert.ok(pre.querySelector('code') != null);
});

test('ClassName Given As A String', async (t) => {
  // Cannot be built through `rehype-parse`, which always produces a token array
  const tree: Root = {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'pre',
        properties: {className: 'language-dot shiki'},
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: {},
            children: [{type: 'text', value: 'digraph { a; b }'}],
          },
        ],
      },
    ],
  };

  await unified().use(rehypeGraphvizDiagram).run(tree);

  const [figure] = tree.children as Element[];
  assert.equal(figure.tagName, 'figure');
  assert.ok(
    figure.children.some((child) => child.type === 'element' && child.tagName === 'svg'),
  );
});

test('Invalid Graphviz Code', async (t) => {
  const document = await renderHtmlCase('invalid-dot');

  const error = document.querySelector('div > div > b');
  assert.equal(error?.textContent, 'Error:');

  // The failing source must not leak onto the error container as an attribute
  const container = document.querySelector('div');
  assert.equal(container?.getAttribute('code'), null);
  assert.equal(container?.getAttribute('language'), null);
});
