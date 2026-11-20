<p align="center"><img src="docs/logo.svg" width="120" alt=""></p>

# tiny-queue

[![npm](https://img.shields.io/npm/v/@acme/tiny-queue.svg)](https://npmjs.com/package/@acme/tiny-queue) [![CI](https://github.com/acme/tiny-queue/actions/workflows/ci.yml/badge.svg)](https://github.com/acme/tiny-queue/actions)

Run promises with a **concurrency limit**, in order, with backpressure. See the [guide](docs/guide.md) and the
[changelog](CHANGELOG.md).

Second paragraph, not part of the intro.

## Features

- **Tiny** — under 1 kB, no dependencies.
- **Ordered**: results come back in the order tasks were added.
- Backpressure: `add()` waits when the queue is full.
- Typed - ships its own TypeScript types.
- Works everywhere.
  Node, Deno, Bun and browsers.
  - a nested bullet that is not a feature
- [x] Cancellation

## Installation

```bash
$ npm install @acme/tiny-queue
```

## Usage

Create a queue and add tasks:

```js
import { Queue } from '@acme/tiny-queue';
const q = new Queue({ concurrency: 2 });
await q.add(() => fetch('/a'));
```

## License

Apache-2.0
