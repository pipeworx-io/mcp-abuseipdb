interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * AbuseIPDB MCP — wraps AbuseIPDB v2 API (api.abuseipdb.com/api/v2)
 *
 * BYO key: requires an AbuseIPDB API key from https://www.abuseipdb.com/account/api
 * Passed via _apiKey parameter.
 *
 * Tools:
 * - check_ip: check an IP address for abuse reports
 * - report_ip: report an abusive IP address
 * - get_blacklist: get the AbuseIPDB blacklist of most-reported IPs
 */


const BASE_URL = 'https://api.abuseipdb.com/api/v2';

// ── Helpers ───────────────────────────────────────────────────────────

function extractKey(args: Record<string, unknown>): string {
  const key = args._apiKey as string;
  delete args._apiKey;
  if (!key) throw new Error('AbuseIPDB API key required. Get one at https://www.abuseipdb.com/account/api and pass via _apiKey.');
  return key;
}

async function apiGet(apiKey: string, path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Key: apiKey,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AbuseIPDB API error (${res.status}): ${text}`);
  }
  return res.json();
}

async function apiPost(apiKey: string, path: string, body: Record<string, string>): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Key: apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AbuseIPDB API error (${res.status}): ${text}`);
  }
  return res.json();
}

// ── Tool definitions ──────────────────────────────────────────────────

const tools: McpToolExport['tools'] = [
  {
    name: 'check_ip',
    description:
      'Check an IP address against the AbuseIPDB database. Returns abuse confidence score (0-100), ISP, usage type, country, number of reports, and last reported date. Example: check_ip("8.8.8.8").',
    inputSchema: {
      type: 'object' as const,
      properties: {
        _apiKey: { type: 'string', description: 'AbuseIPDB API key' },
        ip: {
          type: 'string',
          description: 'IPv4 or IPv6 address to check (e.g., "118.25.6.39")',
        },
      },
      required: ['_apiKey', 'ip'],
    },
  },
  {
    name: 'report_ip',
    description:
      'Report an abusive IP address to AbuseIPDB. Requires category IDs (e.g., "18,22" for DDoS + SSH brute force). Returns the updated abuse confidence score.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        _apiKey: { type: 'string', description: 'AbuseIPDB API key' },
        ip: {
          type: 'string',
          description: 'IPv4 or IPv6 address to report (e.g., "118.25.6.39")',
        },
        categories: {
          type: 'string',
          description: 'Comma-separated category IDs (e.g., "18,22"). Common: 3=Fraud, 4=DDoS, 14=Port Scan, 18=Brute Force, 22=SSH, 23=Telnet',
        },
        comment: {
          type: 'string',
          description: 'Description of the abuse (e.g., "SSH brute force attack from this IP")',
        },
      },
      required: ['_apiKey', 'ip', 'categories', 'comment'],
    },
  },
  {
    name: 'get_blacklist',
    description:
      'Get the AbuseIPDB blacklist of the most-reported IP addresses. Returns IPs with their abuse confidence scores. Useful for building blocklists.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        _apiKey: { type: 'string', description: 'AbuseIPDB API key' },
        limit: {
          type: 'number',
          description: 'Number of IPs to return (default 100, max 10000)',
        },
      },
      required: ['_apiKey'],
    },
  },
];

// ── Tool implementations ──────────────────────────────────────────────

async function checkIp(apiKey: string, ip: string) {
  const data = (await apiGet(apiKey, '/check', {
    ipAddress: ip,
    maxAgeInDays: '90',
    verbose: '',
  })) as {
    data: {
      ipAddress: string;
      isPublic: boolean;
      abuseConfidenceScore: number;
      countryCode: string;
      isp: string;
      usageType: string;
      domain: string;
      totalReports: number;
      lastReportedAt: string | null;
    };
  };

  const d = data.data;
  return {
    ip: d.ipAddress,
    is_public: d.isPublic,
    abuse_confidence_score: d.abuseConfidenceScore,
    country_code: d.countryCode,
    isp: d.isp,
    usage_type: d.usageType,
    domain: d.domain,
    total_reports: d.totalReports,
    last_reported_at: d.lastReportedAt,
  };
}

async function reportIp(apiKey: string, ip: string, categories: string, comment: string) {
  const data = (await apiPost(apiKey, '/report', {
    ip,
    categories,
    comment,
  })) as {
    data: {
      ipAddress: string;
      abuseConfidenceScore: number;
    };
  };

  return {
    ip: data.data.ipAddress,
    abuse_confidence_score: data.data.abuseConfidenceScore,
    reported: true,
  };
}

async function getBlacklist(apiKey: string, limit: number) {
  const data = (await apiGet(apiKey, '/blacklist', {
    limit: String(limit),
  })) as {
    data: Array<{
      ipAddress: string;
      abuseConfidenceScore: number;
    }>;
  };

  return {
    count: data.data.length,
    ips: data.data.map((entry) => ({
      ip: entry.ipAddress,
      abuse_confidence_score: entry.abuseConfidenceScore,
    })),
  };
}

// ── Router ────────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = extractKey(args);

  switch (name) {
    case 'check_ip':
      return checkIp(apiKey, args.ip as string);
    case 'report_ip':
      return reportIp(
        apiKey,
        args.ip as string,
        args.categories as string,
        args.comment as string,
      );
    case 'get_blacklist':
      return getBlacklist(apiKey, (args.limit as number) ?? 100);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 5 } } satisfies McpToolExport;
