import {instance} from '@viz-js/viz';
import type {ElementContent, Properties, Root} from 'hast';
import type {Plugin} from 'unified';
import {visit} from 'unist-util-visit';
import {fromHtmlIsomorphic} from 'hast-util-from-html-isomorphic';
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

export const rehypeGraphvizDiagram: Plugin<[RehypeGraphvizDiagramOption?], Root> =
  function (options = defaultOptions) {
    const mergedOptions: Required<RehypeGraphvizDiagramOption> = {
      containerTagName: options?.containerTagName ?? defaultOptions.containerTagName,
      containerTagProps: options?.containerTagProps ?? defaultOptions.containerTagProps,
      postProcess: options?.postProcess ?? defaultOptions.postProcess,
    };

    return (tree) => {
      visit(tree, 'element', (node, index, pre) => {
        // Ensure the current node is a 'pre' block containing a 'code' element
        if (
          node.tagName !== 'code' ||
          pre?.type !== 'element' ||
          pre.tagName !== 'pre' ||
          index === undefined
        ) {
          return;
        }

        const className = node.properties.className;
        if (!Array.isArray(className) || className.length === 0) return;
        const lang = className[0].toString().replace(/^language-/, '');
        let engine: string;

        if (layoutEngines.includes(lang)) {
          engine = lang;
        } else if (lang === 'graphviz') {
          engine = 'dot';
        } else if (lang.match(/^graphviz-.+$/i)) {
          engine = lang.split('-')[1];
        } else {
          return;
        }

        // If there's no content in the code block, skip it
        if (node.children.length === 0 || node.children[0].type !== 'text') {
          return;
        }

        const graphvizCode = node.children[0].value;

        // Generate SVG from Graphviz code
        try {
          const svg = mergedOptions.postProcess(
            graphvizInstance.renderString(graphvizCode, {engine, format: 'svg'}),
          );
          const svgHast = fromHtmlIsomorphic(svg, {
            fragment: true,
          });

          // update the node to be a generated SVG
          pre.tagName = mergedOptions.containerTagName;
          pre.properties = mergedOptions.containerTagProps;
          pre.children = svgHast.children as ElementContent[];
        } catch (e: any) {
          pre.tagName = 'div';
          pre.children = [h('div', [h('b', 'Error:'), h('p', e.message)])];
        }

        // Skip the next index since we're replacing the original code block with the SVG
        index += 1;

        return index;
      });
    };
  };
