<!-- MD_HOPPER: ID: inquirer-plugins-table -->
<!-- MD_HOPPER: TITLE: TABLE PLUGIN -->
<!-- MD_HOPPER: OUTPUT: README.md -->

`Table Plugin` is based on the original [inquirer-table-input](https://github.com/edelciomolina/inquirer-table-input).
This plugin has been customized to support TypeScript and symbol input.

```ts
import chalk from 'chalk'
import { TablePlugin } from 'inquirer-plugins/table'

TablePlugin({
  title: 'settings',
  description: `You can edit data.`,
  colors: {
    selected: chalk.hex('#FFA500'),
    editable: chalk.green,
    editing: chalk.hex('#F577F5'),
  },
  columns: [
    { name: cyan.bold('ID'), value: 'id', type: 'input', disabled: true },
    {
      name: cyan.bold('filename'),
      value: 'filename',
      type: 'input',
      parser: (input: string, _inputs, _answers) => (/\.md$/.test(input) ? input : `${input}.md`),
    },
    {
      name: cyan.bold('count'),
      value: 'cnt',
      type: 'number',
      validate: (input: string, _inputs, _answers) => {
        const isValid = Number(input) > 0
        return {
          isValid,
          message: isValid ? '' : error('should be more than 0'),
        }
      },
    },
    { name: cyan.bold('IS LOCK'), value: 'lock', type: 'confirm' },
  ],
  rows: [
    [chalk.bold('ABCD'), 'hoge', 0, true],
    [chalk.bold('EFG'), 'foo', 1, false],
  ],
  validate: (raws, answers, config, memo) => {
    const isValid = answers.table.every(row =>
      Object.values(row).every(value => value === true || value > 0 || !!value.trim())
    )
    return {
      isValid,
      message: isValid ? '' : 'not allow empty input',
    }
  },
})
```

> In the [inquirer-table-input](https://github.com/edelciomolina/inquirer-table-input#usage), it was necessary to set validation to false, but this plugin makes it configurable by separating the validation and processing within Inquirer. Instead of using a boolean, changes have been made to pass isValid and message.

```json
{
  "status": "confirmed",
  "data": {
    "table": [
      {
        "id": "ABCD",
        "filename": "hoge.md",
        "cnt": 0,
        "lock": true
      },
      {
        "id": "EFG",
        "filename": "foo.md",
        "cnt": 1,
        "lock": false
      }
    ]
  }
}
```

## Params

- **title** [*required*]
- **description** [*optional*] (String | ChalkInstance)
- **escapeMessage** [*optional*] (String | ChalkInstance)
- **confirmMessage** [*optional*] (String | ChalkInstance)
- **colors** [*optional*]
  - _selected_ [*optional*] (ChalkInstance)
  - _editable_ [*optional*] (ChalkInstance)
  - _editing_ [*optional*] (ChalkInstance)
- **columns** [*required*]
- **rows** [*required*]
- **validate** [*optional*] (() => { isValid: boolean, message: string })
- **pageSize** [*optional*] number

## Column Params

- **name**: [*required*] (String | ChalkInstance) To show table header colum name.
- **value**: [*required*] (String) result param property name.
- **type**: [*required*] (String) `input`, `number`, `confirm`
- **parser**: [*optional*] (() => any) table view & result parser
- **validate**: [*optional*] (() => { isValid: boolean, message: string }) validate cell

## Raws (number | string | boolean)

<!-- MD_HOPPER: BEGIN_DEFINE_LINKS: -->

<!-- MD_HOPPER: END_DEFINE_LINKS: -->
