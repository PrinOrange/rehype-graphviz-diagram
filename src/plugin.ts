import {instance} from '@viz-js/viz';
import type {ElementContent, Properties, Root, Element} from 'hast';
import type {Plugin} from 'unified';
import {visit} from 'unist-util-visit';
import {fromHtmlIsomorphic} from 'hast-util-from-html-isomorphic';

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

const errorBlock = (msg:string) => {
  return `
<div>
  <b>Rehype Graphviz Diagram Render Error:</b>
  <p>${msg}</p>
</div>
`
}

export const rehypeGraphvizDiagram: Plugin<[RehypeGraphvizDiagramOption?], Root> = (
  options = defaultOptions,
) => {
  const mergedOptions: Required<RehypeGraphvizDiagramOption> = {
    containerTagName: options?.containerTagName ?? defaultOptions.containerTagName,
    containerTagProps: options?.containerTagProps ?? defaultOptions.containerTagProps,
    postProcess: options?.postProcess ?? defaultOptions.postProcess,
  };

  let graphviz: any;
  const languageGraphvizRegex = /^language-graphviz-(\S+)$/i;

  return async (tree) => {
    if (!graphviz) {
      graphviz = await instance();
    }

    const promises: Promise<any>[] = [];

    visit(tree, 'element', (node, index, pre) => {
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

      if (node.children.length === 0 || node.children[0].type !== 'text') {
        return;
      }

      const graphvizCode = node.children[0].value;

      async function applySVG(parent: Element, index: number) {
        try {
          const svg = await graphviz.renderString(graphvizCode, {engine, format: 'svg'});
          const processedSvg = mergedOptions.postProcess(svg);
          const svgHast = fromHtmlIsomorphic(processedSvg, {
            fragment: true,
          });

          parent.tagName = mergedOptions.containerTagName;
          parent.properties = mergedOptions.containerTagProps;
          parent.children = svgHast.children as ElementContent[];

          return index + 1;
        } catch (e: any) {
          const errorBlockHast = fromHtmlIsomorphic(e);
          parent.children = errorBlockHast.children as ElementContent[];
          console.error('Error processing Graphviz code:', e.message);
          return;
        }
      }

      promises.push(applySVG(pre, index));
    });
    await Promise.all(promises);
  };
};
