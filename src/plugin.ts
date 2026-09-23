import {instance} from '@viz-js/viz';
import type {Element, ElementContent, Properties, Root} from 'hast';
import type {Plugin} from 'unified';
import {SKIP, visit} from 'unist-util-visit';
import {fromHtmlIsomorphic} from 'hast-util-from-html-isomorphic';
import {toString} from 'hast-util-to-string';
import {h} from 'hastscript';

interface RehypeGraphvizDiagramOption {
  containerTagName?: string;
  containerTagProps?: Properties;
  postProcess?: (svg: string) => string;
}

const defaultOptions: Required<RehypeGraphvizDiagramOption> = {
  containerTagName: 'figure',
  containerTagProps: {},
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

export const rehypeGraphvizDiagram: Plugin<[RehypeGraphvizDiagramOption?], Root> =
  function (options = defaultOptions) {
    const mergedOptions: Required<RehypeGraphvizDiagramOption> = {
      containerTagName: options?.containerTagName ?? defaultOptions.containerTagName,
      containerTagProps: options?.containerTagProps ?? defaultOptions.containerTagProps,
      postProcess: options?.postProcess ?? defaultOptions.postProcess,
    };

    return (tree) => {
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
        const graphvizCode = resolveSource(node, code);
        if (graphvizCode === undefined) return;

        // Generate SVG from Graphviz code
        try {
          const svg = mergedOptions.postProcess(
            graphvizInstance.renderString(graphvizCode, {engine, format: 'svg'}),
          );
          const svgHast = fromHtmlIsomorphic(svg, {
            fragment: true,
          });

          // update the node to be a generated SVG
          node.tagName = mergedOptions.containerTagName;
          node.properties = mergedOptions.containerTagProps;
          node.children = svgHast.children as ElementContent[];
        } catch (e: any) {
          // The code block properties are dropped too: on the `@nuxtjs/mdc` shape
          // they carry the whole graphviz source, which must not leak as an attribute.
          node.tagName = 'div';
          node.properties = {};
          node.children = [h('div', [h('b', 'Error:'), h('p', e.message)])];
        }

        // Skip the generated SVG subtree, there's nothing left to transform in it
        return SKIP;
      });
    };
  };
