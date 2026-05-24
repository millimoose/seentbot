# Agent Configuration Notes

## Proto and Tool Invocation

When executing code from a coding agent (like Forge), **always use `proto run <tool>`** rather than relying on the tool being in PATH.

### Rationale

Coding agents may have incomplete shell initialization, causing tools managed by proto to not be found in `$PATH`.

### How to Invoke

```bash
# Always use proto run to execute tools
proto run moon <args>

# Check moon version
proto run moon --version

# Run moon tasks
proto run moon run <project>:typecheck
```

### Common Commands

```bash
# Run moon tasks
proto run moon run <project>:task

# Install tools
proto install moon
proto install bun
proto install node
```

### Example Task Configuration

When running a moon task from an agent:

```bash
cd /path/to/project && proto run moon run <project>:typecheck
```

## Fallback

If proto is unavailable, check for system-wide installations:
- Homebrew: `brew list <package>`
- Volta: `volta --version`
- fnm: `fnm --version`