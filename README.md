# mcp-0ne

**One MCP server to rule them all.**

A standalone MCP Gateway that multiplexes N backend MCP servers behind a single endpoint. Connect your MCP client once, manage backends dynamically at runtime.

```
MCP Client  ──(HTTP)──>  mcp-0ne (:8150)
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         (HTTP client)   (stdio spawn)   (stdio spawn)
              │               │               │
         HTTP MCP         stdio MCP       stdio MCP
         server           server          server
```

## Quickstart

```bash
# Install
pip install -e .

# Start with empty backends
python -m mcp_0ne.server

# Verify
curl http://127.0.0.1:8150/health
```

## Connect Claude Code

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "0ne": {
      "type": "http",
      "url": "http://127.0.0.1:8150/mcp"
    }
  }
}
```

## Add Backends

### Via MCP tool (from Claude Code)

Call `0ne__add`:
```json
{
  "id": "myapp",
  "type": "http",
  "prefix": "myapp",
  "url": "http://127.0.0.1:8100/mcp",
  "description": "My App MCP Server"
}
```

### Via REST API

```bash
curl -X POST http://127.0.0.1:8150/api/backends/myapp \
  -H "Content-Type: application/json" \
  -d '{"type":"http","prefix":"myapp","url":"http://127.0.0.1:8100/mcp"}'
```

### Via config file

Edit `backends.json`:

```json
{
  "backends": {
    "myapp": {
      "type": "http",
      "url": "http://127.0.0.1:8100/mcp",
      "prefix": "myapp",
      "enabled": true,
      "description": "My App MCP Server"
    }
  },
  "settings": {
    "separator": "__",
    "lazy_connect": true,
    "tool_cache_ttl": 60,
    "log_level": "info"
  }
}
```

## Backend Types

### HTTP

Connects to an existing MCP server over HTTP JSON-RPC 2.0.

| Field | Required | Description |
|-------|----------|-------------|
| `type` | yes | `"http"` |
| `prefix` | yes | Tool namespace prefix |
| `url` | yes | MCP endpoint URL |
| `health_url` | no | Health check URL |
| `timeout` | no | Request timeout (default: 30s) |
| `description` | no | Human-readable description |
| `enabled` | no | Auto-connect (default: true) |

### Stdio

Spawns a subprocess and communicates via MCP SDK stdio transport.

| Field | Required | Description |
|-------|----------|-------------|
| `type` | yes | `"stdio"` |
| `prefix` | yes | Tool namespace prefix |
| `command` | yes | Executable path |
| `args` | no | Command arguments |
| `env` | no | Environment variables |
| `timeout` | no | Operation timeout (default: 60s) |
| `description` | no | Human-readable description |
| `enabled` | no | Auto-connect (default: true) |

## Admin Tools

Available as MCP tools (prefix `0ne__`):

| Tool | Description |
|------|-------------|
| `0ne__discover` | List all backends with state and tool counts |
| `0ne__health` | Health check all backends with latency |
| `0ne__add` | Register a new backend at runtime |
| `0ne__remove` | Disconnect and unregister a backend |
| `0ne__enable` | Enable a disabled backend |
| `0ne__disable` | Disable a backend without removing it |
| `0ne__refresh` | Force reconnect and re-enumerate tools |

## REST API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/backends` | List all backends |
| `POST` | `/api/backends/{id}` | Add a new backend |
| `DELETE` | `/api/backends/{id}` | Remove a backend |
| `PATCH` | `/api/backends/{id}` | Update backend config |
| `POST` | `/api/backends/{id}/refresh` | Reconnect and refresh |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_0NE_HOST` | `127.0.0.1` | Server bind address |
| `MCP_0NE_PORT` | `8150` | Server port |
| `MCP_0NE_CONFIG` | `./backends.json` | Config file path |
| `MCP_0NE_LOG_LEVEL` | `info` | Log level |

## Tool Namespacing

Tools from backends are exposed with a namespace prefix:

```
{prefix}__{original_tool_name}
```

For example, a backend with prefix `myapp` exposing a tool `search` becomes `myapp__search`. The separator `__` is configurable in settings.
