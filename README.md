# ACP terminal-response reproduction

With `@mastra/acp` 0.4.2 and `@mastra/core` 1.78.0, a terminal `max_tokens` response produces an unhandled rejection outside the caller's `try/catch`. Node exits with code 1. With an observer installed to keep Node alive, the generation is still pending at 1,000 ms after it starts.

The local peer uses JSON-RPC over stdio. It answers `initialize`, `session/new`, one text notification (`hello`), then the chosen terminal response. It makes no model or network requests.

## Install and run

Node 24.19.0 and npm 11.17.0 were used. No build step or API key is needed.

```sh
npm ci --ignore-scripts
node repro.mjs max_tokens
```

The manifest was created with:

```sh
npm install --ignore-scripts --save-exact @mastra/core@1.78.0 @mastra/acp@0.4.2
```

Expected: the terminal error reaches the caller, which prints:

```json
{"outcome":"caught","message":"ACP prompt stopped before completing: max_tokens"}
```

Actual: the caller's catch is bypassed and Node exits 1:

```text
Error: ACP prompt stopped before completing: max_tokens
    at ACPConnection.throwIfPromptDidNotComplete (.../node_modules/@mastra/acp/dist/index.js:229:9)
    at .../node_modules/@mastra/acp/dist/index.js:116:9
```

## Control

Change only the response argument:

```sh
node repro.mjs end_turn
```

Actual and expected, exit 0:

```json
{"outcome":"resolved","text":"hello"}
```

A JSON-RPC error is another passing control:

```sh
node repro.mjs rpc_error
```

It exits 0 and prints `{"outcome":"caught","message":"peer failed"}`.

## Cancellation and pending-state observation

```sh
node repro.mjs cancel_requested
node observe.mjs max_tokens
```

The first command uses `connection.cancel()` after the text notification, without an AbortSignal. The peer waits for that real `session/cancel` notification before replying with `cancelled`. It also crashes outside the caller's catch. The `cancelled` argument alone is available to check handling of an unsolicited terminal reply, but `cancel_requested` follows the protocol's cancellation sequence.

`observe.mjs` installs an `unhandledRejection` listener so Node stays alive long enough to inspect the generation. It initializes the session before the 1,000 ms observation window and aborts only after printing the observation, to release the pending call and peer. This listener changes Node's crash policy; it does not settle the generation. Current output:

```json
{"stopReason":"max_tokens","observation":{"state":"pending"},"unhandled":["ACP prompt stopped before completing: max_tokens"]}
```

## Environment

Recorded with `npx --ignore-scripts --yes envinfo@7.21.0 --system --binaries --npmPackages`. The runtime probes used only PATH and `MASTRA_TELEMETRY_DISABLED=1` in their process environment. The lockfile also pins the transitive ACP SDK to 0.21.1.

```shell
  System:
    OS: macOS 27.0
    CPU: (18) arm64 Apple M5 Max
    Memory: 3.17 GB / 128.00 GB
    Shell: Unknown
  Binaries:
    Node: 24.19.0 - ~/.local/share/mise/installs/node/24.19.0/bin/node
    Yarn: 1.22.22 - ~/.local/share/mise/installs/node/24.19.0/bin/yarn
    npm: 11.17.0 - ~/.local/share/mise/installs/node/24.19.0/bin/npm
    pnpm: 11.21.0 - ~/.local/share/mise/installs/node/24.19.0/bin/pnpm
    bun: 1.4.2 - ~/.bun/bin/bun
  npmPackages:
    @mastra/acp: 0.4.2 => 0.4.2 
    @mastra/core: 1.78.0 => 1.78.0 
```

LLM provider: none (local scripted ACP peer). Browser: not applicable.
