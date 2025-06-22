# firebase-rules-bundler

## Description

This npm package is a CLI tool that generates a consolidated file from separated files for Firebase Firestore or Storage rules.

## installation

```bash
$ npm i firebase-rules-bundler
```

```bash
$ ts-node-esm node_modules/.bin/frb
# or
$ node --loader ts-node/esm node_modules/.bin/frb
```

or

```json
{
  "scripts": {
    "frb": "ts-node-esm node_modules/.bin/frb",
    "firebase-rules-bundler": "ts-node-esm node_modules/.bin/firebase-rules-bundler"
  }
}
```

then

```bash
$ npm run frb -- bundle
$ npm run frb -- bundle --only firestore
```

### set .frbrc.js

```js
export default {
  firestore: {
    doc: true,
    directoryPath: 'firestore',
    main: 'firestore.main.rules',
    output: 'firestore.rules',
  },
  storage: [
    {
      doc: true,
      directoryPath: 'storage',
      main: 'storage.main.rules',
      output: 'storage.rules',
    },
  ],
}
```

[example files](https://github.com/cilly-yllic/firebase-rules-bundler/tree/main/example)

```firebase_rules
rules_version = '2';

// @import ./functions/firestore.index.rules

service cloud.firestore {
  match /databases/{database}/documents {
    // @import ./hero/index.rules
  }
}
```
