<!-- MD_HOPPER: ID: md-hopper -->
<!-- MD_HOPPER: TITLE: MD HOPPER -->
<!-- MD_HOPPER: OUTPUT: README.md -->
<!-- MD_HOPPER: CONFIG: -->

# MD HOPPER

md-hopper is a tool that recursively processes README.md files, starting from a specified README.md file and adding links to other README.md files nested within its directories to the parent README.md file.
This helps consolidate dispersed README files into a single, easily manageable document.

## Installation

```bash
$ npm i -g md-hopper
```

or

```bash
$ npm i md-hopper
```

## Commands

<!-- MD_HOPPER: BEGIN_LINKS:
all: true
linked: true
child: true
grandChild: false
parallel: false
-->
[LINK COMMAND][md_hopper:md-hopper-link]

<!-- MD_HOPPER: END_LINKS: --><!-- MD_HOPPER: BEGIN_DEFINE_LINKS: -->
[md_hopper:main]: ../../README.md 'MyPackages'
[md_hopper:inquirer-plugins]: ../inquirer-plugins/README.md 'inquirer-plugins'
[md_hopper:inquirer-plugins-table]: ../inquirer-plugins/src/lib/_internal/plugins/table/README.md 'TABLE PLUGIN'
[md_hopper:md-hopper-link]: ./src/lib/cli/commands/link/README.md 'LINK COMMAND'
[md_hopper:my-gadgetry]: ../my-gadgetry/README.md 'my gadgetry'
[md_hopper:my-gadgetry-dev-ops]: ../my-gadgetry/src/lib/_internal/dev-ops/README.md 'Dev Ops'
[md_hopper:test]: ../test/README.md 'test'
[md_hopper:plugins-builder]: ../../plugins/builder/README.md 'builder'
<!-- MD_HOPPER: END_DEFINE_LINKS: -->
