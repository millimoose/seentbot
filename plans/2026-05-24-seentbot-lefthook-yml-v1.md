# Lefthook git hooks configuration
# https://lefthook.dev/

pre-commit:
  jobs:
    - name: typecheck
      run: moon run seentbot:typecheck

    - name: lint
      run: moon run seentbot:lint

pre-push:
  jobs:
    - name: test
      run: moon run seentbot:test