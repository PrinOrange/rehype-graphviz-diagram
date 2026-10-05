import {instance} from '@viz-js/viz';
import type {Element, ElementContent, Properties, Root} from 'hast';
import {find, svg} from 'property-information';
import type {Plugin} from 'unified';
import {SKIP, visit} from 'unist-util-visit';
import {fromHtmlIsomorphic} from 'hast-util-from-html-isomorphic';
import {toString} from 'hast-util-to-string';
import {h} from 'hastscript';

interface RehypeGraphvizDiagramOption {
  containerTagName?: string;
  containerTagProps?: Properties;
  imageFormat?: 'svg' | 'png';
  postProcess?: (svg: string) => string;
}

const defaultOptions: Required<RehypeGraphvizDiagramOption> = {
  containerTagName: 'figure',
  containerTagProps: {},
  imageFormat: 'svg',
  postProcess: (svg: string) => svg,
};

const layoutEngines = [
  'dot',
  'neato',
  'fdp',
  'sfdp',
  'circo',
  'twopi',
  'nop',
  'nop2',
  'osage',
  'patchwork',
];
const graphvizInstance = await instance();

/**
 * Pick the first `language-*` entry out of a hast `className` property.
 *
 * The value is an array of tokens when it comes straight from `remark-rehype`,
 * but syntax highlighters (like the one in `@nuxtjs/mdc`) rewrite it into a
 * single space separated string, so both shapes have to be accepted.
 */
function languageFromClassName(className: unknown): string | undefined {
  const tokens = Array.isArray(className)
    ? className
    : typeof className === 'string'
      ? className.split(/\s+/)
      : [];

  for (const token of tokens) {
    const match = /^language-(.+)$/.exec(String(token));
    if (match) return match[1];
  }

  return undefined;
}

/**
 * Rename the properties of a generated SVG subtree to the SVG attribute names
 * they stand for.
 *
 * `hast-util-from-html-isomorphic` stores SVG attributes as camelCase *properties*
 * (`font-family` becomes `fontFamily`), which a hast consumer is supposed to map
 * back with the SVG schema. `@nuxtjs/mdc`, the renderer behind Nuxt Content,
 * maps them with the *HTML* schema instead, which knows nothing about SVG-only
 * presentation attributes like `font-family`, `font-size` or `text-anchor`. The
 * camelCase name then reaches the DOM untouched and SVG ignores it, so a diagram's
 * text inherits the page font and its labels lose their anchoring.
 *
 * The SVG schema is the only thing that can tell the two flavours of camelCase
 * apart — `fontFamily` stands for `font-family`, while `viewBox` really is
 * `viewBox` — so the name is resolved with `property-information` rather than by
 * hand. Names the schema doesn't know are returned unchanged.
 */
function useSvgAttributeNames(node: Root | Element, insideSvg = false): void {
  const inSvg = insideSvg || (node.type === 'element' && node.tagName === 'svg');

  if (node.type === 'element' && inSvg && node.properties) {
    node.properties = Object.fromEntries(
      Object.entries(node.properties).map(([name, value]) => [
        find(svg, name).attribute,
        value,
      ]),
    );
  }

  for (const child of node.children) {
    if (child.type === 'element') useSvgAttributeNames(child, inSvg);
  }
}

/** Read a `language` style attribute, which never carries more than one token. */
function languageFromInfo(info: unknown): string | undefined {
  if (typeof info !== 'string') return undefined;
  const [lang] = info.trim().split(/\s+/);
  return lang === '' ? undefined : lang;
}

/**
 * Resolve the language of a code block, looking at the places different
 * markdown pipelines put it.
 *
 * `remark-rehype` puts it on the `code` element:
 *   `<pre><code class="language-graphviz-dot">`
 *
 * `@nuxtjs/mdc` (Nuxt Content) puts it on the `pre` element instead and leaves
 * the inner `code` without any class at all:
 *   `<pre language="graphviz-dot" class="language-graphviz-dot"><code>`
 *
 * The `language` attribute survives syntax highlighting — MDC's highlighter only
 * appends classes to the `pre` — so this works whether the plugin runs before or
 * after one.
 */
function resolveLanguage(pre: Element, code: Element | undefined): string | undefined {
  return (
    languageFromClassName(code?.properties.className) ??
    languageFromInfo(pre.properties.language) ??
    languageFromClassName(pre.properties.className)
  );
}

/** Map a language annotation to a layout engine, or `undefined` if it isn't graphviz. */
function resolveEngine(lang: string | undefined): string | undefined {
  if (lang === undefined) return undefined;

  if (layoutEngines.includes(lang)) {
    return lang;
  }
  if (lang === 'graphviz') {
    return 'dot';
  }
  if (lang.match(/^graphviz-.+$/i)) {
    return lang.split('-')[1];
  }

  return undefined;
}

/**
 * Read the graphviz source out of a code block.
 *
 * The `code` element is authoritative, and its text content is used rather than
 * only a direct text child so that a code block stays readable after a syntax
 * highlighter has wrapped the source in spans. `@nuxtjs/mdc` additionally keeps
 * a copy of the source on `pre.properties.code`.
 */
function resolveSource(pre: Element, code: Element | undefined): string | undefined {
  const fromChildren = code === undefined ? '' : toString(code);
  if (fromChildren !== '') return fromChildren;

  const fromProperty = pre.properties.code;
  return typeof fromProperty === 'string' && fromProperty !== ''
    ? fromProperty
    : undefined;
}

/**
 * Turn an SVG document into a `data:` URL holding a base64 encoded PNG.
 *
 * The Graphviz WASM build only emits vector/text formats, so the raster step is
 * delegated to `@resvg/resvg-js`. It is imported on demand: the package carries a
 * native binary that is not worth loading for the default SVG output.
 */
async function svgToPngDataUrl(svg: string): Promise<string> {
  const {Resvg} = await import('@resvg/resvg-js');
  const png = new Resvg(svg).render().asPng();
  return `data:image/png;base64,${png.toString('base64')}`;
}

/** A `<pre>` block recognised as a diagram, with the source and engine to render it. */
interface DiagramBlock {
  node: Element;
  engine: string;
  source: string;
}

export const rehypeGraphvizDiagram: Plugin<[RehypeGraphvizDiagramOption?], Root> =
  function (options = defaultOptions) {
    const mergedOptions: Required<RehypeGraphvizDiagramOption> = {
      containerTagName: options?.containerTagName ?? defaultOptions.containerTagName,
      containerTagProps: options?.containerTagProps ?? defaultOptions.containerTagProps,
      imageFormat: options?.imageFormat ?? defaultOptions.imageFormat,
      postProcess: options?.postProcess ?? defaultOptions.postProcess,
    };

    return async (tree) => {
      // The blocks are collected first and rendered afterwards, because turning an
      // SVG into a PNG is asynchronous and a `visit` callback cannot await.
      const blocks: DiagramBlock[] = [];

      visit(tree, 'element', (node) => {
        // Ensure the current node is a 'pre' block possibly containing a 'code' element
        if (node.tagName !== 'pre') return;

        const code = node.children.find(
          (child): child is Element =>
            child.type === 'element' && child.tagName === 'code',
        );

        const engine = resolveEngine(resolveLanguage(node, code));
        if (engine === undefined) return;

        // If there's no content in the code block, skip it
        const source = resolveSource(node, code);
        if (source === undefined) return;

        blocks.push({node, engine, source});

        // Nothing inside a recognized code block needs transforming
        return SKIP;
      });

      for (const {node, engine, source} of blocks) {
        try {
          // Generate SVG from Graphviz code
          const svg = mergedOptions.postProcess(
            graphvizInstance.renderString(source, {engine, format: 'svg'}),
          );

          node.tagName = mergedOptions.containerTagName;
          node.properties = mergedOptions.containerTagProps;

          if (mergedOptions.imageFormat === 'png') {
            // The rasterized diagram replaces the SVG subtree with a single image
            node.children = [h('img', {src: await svgToPngDataUrl(svg)})];
          } else {
            const svgHast = fromHtmlIsomorphic(svg, {
              fragment: true,
            });
            useSvgAttributeNames(svgHast);
            node.children = svgHast.children as ElementContent[];
          }
        } catch (e: any) {
          // The code block properties are dropped too: on the `@nuxtjs/mdc` shape
          // they carry the whole graphviz source, which must not leak as an attribute.
          node.tagName = 'div';
          node.properties = {};
          node.children = [h('div', [h('b', 'Error:'), h('p', e.message)])];
        }
      }
    };
  };
