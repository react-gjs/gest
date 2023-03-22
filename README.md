# gest

A simple testing framework for [Gnome Javascript](https://gitlab.gnome.org/GNOME/gjs).

## Usage

Run tests:

```sh
$ yarn gest
```

Run tests and show information on passed, skipped and failed tests:

```sh
$ yarn gest --verbose
```

Run tests that match the given filename pattern:

```sh
$ yarn gest --testPathPattern <regex>
```

Run tests that match the given test name pattern:

```sh
$ yarn gest --testNamePattern <regex>
```

Run tests in a specific file:

```sh
$ yarn gest --file <path>
```

### Example test file

```ts
// example.test.ts
import { describe, it, expect } from 'gest';

export default describe('Example test', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });

  it('should fail', () => {
    expect(true).toBe(false);
  });
});
```