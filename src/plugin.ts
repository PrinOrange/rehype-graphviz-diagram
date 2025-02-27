import {instance} from '@viz-js/viz';
import type {ElementContent, Properties, Root} from 'hast';
import type {Plugin} from 'unified';
import {visit} from 'unist-util-visit';
import {fromHtmlIsomorphic} from 'hast-util-from-html-isomorphic';

interface RehypeGraphvizDiagramOption {
  containerTagName: string;
  containerTagProperties?: Properties;
  containerTagClassName?: string;
  postProcess: (svg: string) => string;
}

export const defaultOptions: RehypeGraphvizDiagramOption = {
  containerTagName: 'div',
  postProcess: (svg: string) => svg,
};

export const rehypeGraphvizDiagram: Plugin<[RehypeGraphvizDiagramOption?], Root> = (
  options = defaultOptions,
) => {
  const mergedOptions: RehypeGraphvizDiagramOption = {
    ...defaultOptions,
    ...options,
  };

  let graphviz: any; // Cache the graphviz instance in closure.
  const languageGraphvizRegex = /^language-graphviz-(\S+)$/i; // Cache the regex

  return async (tree) => {
    if (!graphviz) {
      graphviz = await instance(); // Only instantiate once
    }

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
      const lang = className[0].toString();
      const match = lang.match(languageGraphvizRegex);
      if (!match) return;
      const engine = match[1] || 'dot';

      // If there's no content in the code block, skip it
      if (node.children.length === 0 || node.children[0].type !== 'text') {
        return;
      }

      const graphvizCode = node.children[0].value;

      // Generate SVG from Graphviz code
      const svg = mergedOptions.postProcess(
        graphviz.renderString(graphvizCode, {engine, format: 'svg'}),
      );
      const svgHast = fromHtmlIsomorphic(svg, {
        fragment: true,
      });

      // update the node to be a generated SVG
      pre.tagName = mergedOptions.containerTagName;
      pre.children = svgHast.children as ElementContent[];

      // Skip the next index since we're replacing the original code block with the SVG
      index += 1;

      return index;
    });
  };
};
