# OpenCode Antigravity CLI Auth Plugin (with Gemini Enterprise Support)

[![License](https://img.shields.io/github/license/ariffrahimin/opencode-agy-auth)](https://github.com/ariffrahimin/opencode-agy-auth/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/ariffrahimin/opencode-agy-auth?style=social)](https://github.com/ariffrahimin/opencode-agy-auth)

An [OpenCode](https://opencode.ai/) authentication plugin that enables seamless interaction with the Antigravity CLI (`agy`), with **full support for both Google Cloud Gemini Enterprise (`businessaicode.googleapis.com`) and consumer accounts (`cloudcode-pa.googleapis.com`)** — resolving Error `#3501` ("You do not have a valid license of this product").

## Features

- **Gemini Enterprise Support (`businessaicode.googleapis.com`)**: Automatically discovers your Gemini Enterprise Plus / Standard license via `:selfAssignLicense`, attaches your enterprise `entitlement` (`userTier`, `licenseLocation`), and routes requests to `businessaicode.googleapis.com/v1beta`.
- **Zero-Config `agy` CLI Project Detection**: Automatically reads `~/.gemini/antigravity-cli/settings.json` to detect your configured `gcp.project` and `gcp.location`.
- **OAuth 2.0 Integration**: Uses Antigravity's OAuth flows for authentication.
- **Enterprise & Consumer Models**: Supports `gemini-4-argon`, `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.1-pro`, `claude-opus-5-5`, and `claude-sonnet-5-5` across `low`, `medium`, and `high` reasoning tiers.
- **Dual OpenCode Compatibility**: Natively supports both OpenCode v2 and OpenCode v1 (>= 1.18.29) out of the box.

## Installation

Install directly from GitHub using the OpenCode CLI:

```bash
opencode plugin add github:ariffrahimin/opencode-agy-auth
```

## Configuration

Update your OpenCode configuration file (`~/.config/opencode/opencode.json`) to register the plugin and specify your Google Cloud Project ID:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:ariffrahimin/opencode-agy-auth"],
  "providers": {
    "google-agy": {
      "settings": {
        "projectId": "your-google-cloud-project-id"
      }
    }
  }
}
```

*(If you are already logged into `agy` CLI with a configured project in `~/.gemini/antigravity-cli/settings.json`, the plugin will detect your project ID automatically even without `providers.google-agy` configured!)*

By default, the plugin registers a specialized provider ID to interface with `agy`.
You can switch your active OpenCode provider to `agy` or let the plugin inject authentication into your existing sessions.

### Environment Variables

If you are running OpenCode in environments with specific requirements for Antigravity, you can use the following environment variables:

- `OPENCODE_AGY_PROJECT_ID`: Specify your Google Cloud Project ID manually.
- `OPENCODE_AGY_AUTH_PROXY`: Define a proxy if accessing authentication endpoints behind a corporate firewall.
- `OPENCODE_AGY_ENDPOINT`: Override the default internal `daily-cloudcode-pa.googleapis.com` API endpoint.
- `OPENCODE_AGY_VERBOSE_LOGS`: Set to `"1"` to enable verbose diagnostic logs for API calls and responses.

## Usage

Once installed and configured, OpenCode will automatically authenticate against Antigravity CLI when interacting with eligible models. If no active session exists, you will be prompted to complete an OAuth login.


### Disk Persistence

The plugin persists turn-state and retry-cooldown data to disk so that it survives OpenCode restarts. Files are stored under `~/.config/opencode/` (or `%APPDATA%\opencode\` on Windows):

- `antigravity-turn-states.json` - tracks thinking/reasoning state across request turns, with a 24-hour TTL and 5-second throttled writes using atomic tmp+rename.
- Retry cooldowns are persisted via `CooldownStore` with the same atomic-write pattern.

Both stores initialize lazily at runtime - no filesystem reads occur at import time.

#### `diskEnabled` Parameter

`TurnStateTracker` accepts a `diskEnabled` constructor parameter (defaults to `true`):

```ts
import { TurnStateTracker } from "@anthonyhaussman/opencode-agy-auth/sdk/request/turn-state-tracker";

// Disk persistence enabled (default)
const tracker = new TurnStateTracker(true);

// Memory-only mode - no filesystem reads or writes
const tracker = new TurnStateTracker(false);
```

When `diskEnabled` is `false`, the tracker operates entirely in memory. All state is lost when the process exits. This is useful in restricted environments (containers, read-only filesystems) where disk access is unavailable or undesirable.

If disk initialization fails at runtime (permission error, corrupt file, etc.), the plugin automatically falls back to memory-only mode and logs a warning. No configuration is needed for normal use - disk persistence works out of the box.

## Local Testing

To test and develop the plugin locally with OpenCode before publishing:

1. **Build the plugin locally**:
   Clone the repository, install dependencies, and build the source code:
   ```bash
   npm install
   npm run build
   ```

2. **Configure OpenCode to use the local build**:
   In the target project where you want to test the plugin, open your `opencode.json` (or `~/.config/opencode/opencode.json` for global testing) and add the absolute local path to the plugin:
   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "plugin": ["/absolute/path/to/opencode-agy-auth"]
   }
   ```
   *Note: OpenCode also supports dropping plugin files directly into the `.opencode/plugins/` folder in your project.*

3. **Verify the plugin**:
   Launch OpenCode in your target project. OpenCode will automatically resolve and load your local plugin directory. You can test your changes by running `npm run build` in the plugin directory and restarting your OpenCode session.

## OpenCode Runtime Compatibility

The plugin natively supports both OpenCode v1 (>= 1.18.29) and [OpenCode v2](https://opencode.ai/v2/docs) out of the box through a dual-compatibility architecture:

- **OpenCode v1**: Loaded via the `server(options)` hook with custom OAuth flow and provider setup.
- **OpenCode v2**: Loaded via `Plugin.define` / `setup(ctx)` with native catalog transformations, AI SDK hooks, session interception, and PKCE OAuth integration.

No special flags or configurations are required - the plugin detects runtime automatically.


## Star History & Support

If this plugin saved you time or made using Antigravity models in OpenCode smoother, consider giving the repository a star on [GitHub](https://github.com/ariffrahimin/opencode-agy-auth) - it helps others discover the project.
