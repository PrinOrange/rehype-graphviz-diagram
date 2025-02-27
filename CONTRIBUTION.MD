# Contributing Guidelines

- Be kind and understanding.
- It’s a good idea to create an issue before you start coding. This prevents disappointment if your
  pull request gets rejected.
- Adhere to coding standards.
- Keep commits small. Prevent making unrelated changes.

## Tests

I try to add tests and achieve 100% code coverage for all of my projects. Some projects are harder
to test than others. I’m always open to suggestions on how a project could be tested.

## Code Quality Tools

Most of my projects use linters and formatters to ensure a strict coding standard. Typically these
tools are [ESLint](https://eslint.org), [Prettier](https://prettier.io),
[remark](https://remark.js.org), and [TypeScript](https://typescriptlang.org), but they may vary per
project. GitHub actions are used to verify the code adheres to these tools.

## Gitignore

Please don’t commit files that are related to your local development environment such as editor or
operating system files. It is your responsibility to not commit them. It helps to
[configure a global gitignore](https://docs.github.com/en/get-started/getting-started-with-git/ignoring-files#configuring-ignored-files-for-all-repositories-on-your-computer).
For reference have a look at
[my global gitignore](https://github.com/prinorange/dotfiles/blob/main/.config/git/ignore).

## Commit Messages

I recommend to use an imperative commit message title starting with an upper case character and to
include a body, but I don’t enforce a commit message standard for my own projects.

## Financial Support

My open source work is 100% free. However, life is not. If you like my work, please consider
sponsoring me via [GitHub sponsors](https://github.com/sponsors/prinorange).
