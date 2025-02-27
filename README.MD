# Rehype Graphviz Diagram

> 🚧 This documentation is under the construction.

This is the unified/rehype plugin that allows you transform graphviz codes into svg diagrams for html content.

## Usage

### Basic usage

### Integrate remark with markdown

### Related vscode extension

We set a distinguish language annotation from codeblock different for most of plugins and extensions on marketplace. \
For better preview of graphviz diagrams when you are editing markdown in vscode, we recommend the vscode extension [Visual Studio Code Extension: Markdown Graphviz Preview](https://marketplace.visualstudio.com/items?itemName=PrinOrange.markdown-graphviz-preview)

## API

### `Options?`

#### `containerTagName?: string`

Specify what tag will enclose the svg image as container. Default to `figure`, namely the tag `<figure>`, it will generate such code:

```html
<figure>
  <svg>
    <!-- SVG code-->
  </svg>
</figure>
```

#### `containerTagProps?: Properties`

Optional. Add properties for container tag, it could be `class`, `style` and other more. Supports all valid DOM properties. For example,

```typescript
await unified.use(rehypeGraphvizDiagram, {
  containerTagProps: {
    class: 'graphviz',
    alt: 'This is a graphviz diagram.'
    style: 'width:100px; hight:50px',
  },
}); // ...
```

It will generate:

```html
<figure
  class="graphviz"
  alt="This is a graphviz diagram."
  style="width:100px; hight:50px"
>
  <svg>
    <!-- SVG code-->
  </svg>
</figure>
```

#### `postProcess: (svg: string) => string`

Optional. Pass a function to specify how to process the generated SVG if you need, the input and output of this function is SVG code in string form. For example,

```typescript
await unified.use(rehypeGraphvizDiagram, {
  postProcess: (svg: string) => {
    return svg.replace(/<svg/, '<svg data-processed="true"')
  };
});
```

The svg output will be

```html
<figure>
  <svg data-processed="true">
    <!-- codes -->
    <svg>
      <figure></figure>
    </svg>
  </svg>
</figure>
```

## Reference

- [Visual Studio Code Extension: Markdown Graphviz Preview](https://marketplace.visualstudio.com/items?itemName=PrinOrange.markdown-graphviz-preview) Recommend to use, for better preview of graphviz diagrams when you are editing markdown in vscode.
- [Graphviz Project](https://graphviz.org/) The official project website.
- [Viz.js](https://github.com/mdaines/viz-js) The version of compiled graphviz for wasm package.

## License

MIT © [但为君故](https://github.com/PrinOrange)
