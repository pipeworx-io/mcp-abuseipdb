# AbuseIPDB — IP Reputation and Threat Intelligence

AbuseIPDB is a community-curated database of IPs reported for malicious activity (brute force, DDoS, web spam, credential stuffing, etc.). ~150M+ historical reports across millions of IPs. Each IP gets a confidence score (0-100) based on report volume, recency, and reporter trust. Used by sysadmins, security teams, and AI agents doing threat intelligence.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Why this matters for AI agents

For security analysis — investigating a suspicious IP in logs, scoring inbound traffic, building blocklists — AbuseIPDB is the canonical free reputation source. Pair with [NVD](/docs/reference/nvd) for vulnerability research and [Shodan / PhishTank / URLhaus](/docs/reference) for adjacent threat intel.

Common flows:

- **IP check.** "What's the reputation of 1.2.3.4?" → confidence score, recent reports, abuse categories.
- **Blacklist pull.** "Get a list of IPs flagged as DDoS sources in the last 90 days" → filtered blacklist export.
- **Report submission.** If you have evidence of abuse from an IP, you can submit a report (counts toward the reporter's trust score).

## Auth

AbuseIPDB requires a free API key from https://www.abuseipdb.com/account/api. Free tier: 1,000 requests/day. Pass via `_apiKey`.

## Confidence score interpretation

| Score | Meaning |
|---|---|
| 0 | Never reported (or fully whitelisted) |
| 1-25 | Few reports, low confidence |
| 26-75 | Moderate concern; multiple reports across time |
| 76-100 | High confidence; active or recent malicious activity |

For automated blocking, 75+ is the conservative threshold. For alerting/triage, 25+ catches more activity.

## Abuse categories

Each report tags categories (multiple per report):

| Category ID | Activity |
|---|---|
| 3 | Fraud Orders |
| 4 | DDoS Attack |
| 5 | FTP Brute-Force |
| 9 | Open Proxy |
| 10 | Web Spam |
| 11 | Email Spam |
| 14 | Port Scan |
| 15 | Hacking |
| 18 | Brute-Force |
| 19 | Bad Web Bot |
| 21 | Web App Attack |
| 22 | SSH Brute-Force |

For agent-driven triage, category-aware filtering catches false positives (an IP flagged only as "Web Spam" is different from one flagged as "Hacking").

## Common pitfalls

- **Score is reporter-weighted.** A handful of trusted reporters carries more weight than many anonymous ones. Don't assume "reported by 100 sources" means 100 separate organizations — could be one researcher's 100 honeypots.
- **NAT and shared IPs.** Carrier-grade NAT, AWS / GCP exit IPs, and Tor exit nodes get flagged constantly. A high score for a known shared IP doesn't necessarily implicate any single user.
- **Historical decay.** Recent reports weight more than older ones. An IP that was malicious in 2019 but clean since may have a residual score that's no longer accurate.
- **Self-reporting bias.** People report what they detect; sophisticated attacks (low-and-slow, residential proxies) underreport.
- **False positives from scanning.** Legitimate vulnerability scanners (Shodan, Censys) get reported as abuse by uninformed sysadmins. Their IPs are well-known; whitelist them client-side.
- **Rate limiting on free tier.** 1,000/day may not be enough for production — consider commercial tier or aggregate at the agent level via [memory](/docs/concepts/memory).

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "abuseipdb": {
      "url": "https://gateway.pipeworx.io/abuseipdb/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Abuseipdb data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
