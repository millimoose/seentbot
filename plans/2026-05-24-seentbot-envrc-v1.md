# Direnv configuration with Pulumi ESC integration
# https://direnv.net/

# Load Pulumi ESC environment variables
# Requires: pulumi login (for millimoose org), esc CLI
eval "$(esc run --env millimoose/seentbot/dev --print-dotenv 2>/dev/null)"

# Local overrides (not committed to git)
source_env_if_exists .envrc.local