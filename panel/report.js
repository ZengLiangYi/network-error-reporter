export const TRACE_HEADER_NAMES = [
  "x-request-id",
  "request-id",
  "trace-id",
  "x-trace-id",
  "traceparent",
  "x-b3-traceid",
  "x-correlation-id"
];

export const SENSITIVE_PATTERNS = [
  /authorization/i,
  /cookie/i,
  /set-cookie/i,
  /token/i,
  /bearer\s+[a-z0-9\-_.]+/i,
  /\b1[3-9]\d{9}\b/,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
];

export function normalizeEntry(entry) {
  const request = entry.request ?? {};
  const response = entry.response ?? {};
  const status = Number(response.status ?? 0);
  const startedAt = entry.startedDateTime || new Date().toISOString();
  const requestHeaders = normalizeHeaders(request.headers);
  const responseHeaders = normalizeHeaders(response.headers);
  const method = request.method || "GET";
  const url = request.url || "";

  return {
    id: [method, url, startedAt, entry.time ?? 0].join("::"),
    raw: entry,
    startedAt,
    method,
    url,
    path: safePathname(url),
    status,
    statusText: response.statusText || (status === 0 ? "Network Error" : ""),
    timeMs: Number(entry.time ?? 0),
    requestHeaders,
    responseHeaders,
    queryString: Array.isArray(request.queryString) ? request.queryString : [],
    requestBody: request.postData?.text || "",
    mimeType: response.content?.mimeType || "",
    pageUrl: entry.pageref || "",
    requestId: findTraceLikeValue(responseHeaders) || findTraceLikeValue(requestHeaders) || "",
    resourceType: normalizeResourceType(entry, response.content?.mimeType || "", url),
    isFailure: status >= 400 || status === 0
  };
}

export async function buildMarkdownReport({ request, formState, pageUrl, responseBody }) {
  const browserInfo = detectBrowser(request.requestHeaders);
  const requestId = request.requestId || "未提供";
  const traceId = extractTraceId(request) || "未提供";
  const requestHeaderGroups = splitHeaderGroups(request.requestHeaders, "request");
  const responseHeaderGroups = splitHeaderGroups(request.responseHeaders, "response");
  const requestTraceHeaders = formatHeaders(requestHeaderGroups.trace);
  const requestBusinessHeaders = formatHeaders(requestHeaderGroups.business);
  const responseTraceHeaders = formatHeaders(responseHeaderGroups.trace);
  const responseBusinessHeaders = formatHeaders(responseHeaderGroups.business);
  const requestPayload = request.requestBody ? fenceBlock(request.requestBody) : "无";
  const responseBodySection = formatResponseSummary(responseBody, request.mimeType);
  const queryParams = formatQueryParams(request.queryString);

  const sensitiveHits = collectSensitiveHits([
    requestTraceHeaders,
    requestBusinessHeaders,
    responseTraceHeaders,
    responseBusinessHeaders,
    request.requestBody,
    responseBody
  ]);

  const warningLines = [];
  if (!request.isFailure) {
    warningLines.push("当前请求不是失败请求，请确认是否仍需上报。");
  }
  if (sensitiveHits.length > 0) {
    warningLines.push(`检测到 ${sensitiveHits.length} 类敏感信息，请确认发送范围。`);
  }

  const detailLines = [];
  if (formState.includeRequestHeaders) {
    detailLines.push(`- Request 鉴权/链路头：\n${requestTraceHeaders}`);
    detailLines.push(`- Request 业务自定义头：\n${requestBusinessHeaders}`);
  }
  if (formState.includeResponseHeaders) {
    detailLines.push(`- Response 鉴权/链路头：\n${responseTraceHeaders}`);
    detailLines.push(`- Response 业务自定义头：\n${responseBusinessHeaders}`);
  }
  if (formState.includeQueryParams && request.queryString.length > 0) {
    detailLines.push(`- Query Params：\n${queryParams}`);
  }
  if (formState.includeRequestPayload && request.requestBody.trim()) {
    detailLines.push(`- Request Payload：\n${requestPayload}`);
  }
  if (formState.includeResponseBody) {
    detailLines.push(`- 响应结果：\n${responseBodySection}`);
  }

  const pageSource = request.pageUrl || getHeaderValue(request.requestHeaders, "referer") || pageUrl || "未获取到";
  const environmentItems = [
    ["浏览器", browserInfo.browser],
    ["操作系统", browserInfo.os],
    ["发生时间", formatDateTime(request.startedAt)],
    ["当前页面", pageUrl || "未获取到"],
    ["来源页面", pageSource]
  ];
  const detailRows = [
    ["Request URL", request.url || "未获取到"],
    ["Method", request.method],
    ["Status Code", formatStatus(request)],
    ["Response Time", formatDuration(request.timeMs)],
    ["Request ID", requestId],
    ["Trace ID", traceId]
  ];
  const detailSections = detailLines.map((line) => {
    const [labelPart, ...rest] = line.replace(/^- /, "").split("：\n");
    return {
      label: labelPart,
      value: rest.join("：\n") || "无"
    };
  });
  const impactItems = [
    ["影响范围", formState.impactScope || "待补充"],
    ["错误频率", formState.frequency || "待补充"]
  ];
  const reproItems = [
    ["复现步骤", normalizeMultilineInput(formState.reproSteps)],
    ["预期结果", normalizeMultilineInput(formState.expectedResult)],
    ["实际结果", normalizeMultilineInput(formState.actualResult)],
    ["备注", normalizeMultilineInput(formState.remarks)]
  ];
  const markdown = [
    "## 网络错误报告",
    "",
    "### 环境信息",
    `- 浏览器：${browserInfo.browser}`,
    `- 操作系统：${browserInfo.os}`,
    `- 发生时间：${formatDateTime(request.startedAt)}`,
    `- 当前页面：\`${pageUrl || "未获取到"}\``,
    `- 来源页面：\`${pageSource}\``,
    "",
    "### 错误详情",
    "| 字段 | 值 |",
    "|------|-----|",
    `| Request URL | \`${request.url || "未获取到"}\` |`,
    `| Method | \`${request.method}\` |`,
    `| Status Code | \`${formatStatus(request)}\` |`,
    `| Response Time | \`${formatDuration(request.timeMs)}\` |`,
    `| Request ID | \`${requestId}\` |`,
    `| Trace ID | \`${traceId}\` |`,
    "",
    "### 请求与响应明细",
    ...(detailLines.length ? detailLines : ["- 当前未勾选额外字段"]),
    "",
    "### 影响评估",
    `- 影响范围：${formState.impactScope || "待补充"}`,
    `- 错误频率：${formState.frequency || "待补充"}`,
    "",
    "### 复现说明",
    `- 复现步骤：${normalizeMultilineInput(formState.reproSteps)}`,
    `- 预期结果：${normalizeMultilineInput(formState.expectedResult)}`,
    `- 实际结果：${normalizeMultilineInput(formState.actualResult)}`,
    `- 备注：${normalizeMultilineInput(formState.remarks)}`,
    "",
    "### 补充附件",
    "- cURL：如需后端复现，请在 Chrome Network 面板使用原生 Copy as cURL"
  ].join("\n");

  return {
    markdown,
    sensitiveHits,
    warningMessage: warningLines.join(" "),
    preview: {
      title: "网络错误报告",
      environmentItems,
      detailRows,
      detailSections: detailSections.length ? detailSections : [{ label: "请求与响应明细", value: "当前未勾选额外字段" }],
      impactItems,
      reproItems,
      attachmentText: "cURL：如需后端复现，请在 Chrome Network 面板使用原生 Copy as cURL"
    }
  };
}

export function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short"
  }).format(date);
}

export function formatDuration(timeMs) {
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    return "未知";
  }
  if (timeMs >= 1000) {
    return `${(timeMs / 1000).toFixed(1)}s`;
  }
  return `${Math.round(timeMs)}ms`;
}

export function formatResourceLabel(type) {
  switch (type) {
    case "fetch-xhr":
      return "Fetch/XHR";
    case "document":
      return "Doc";
    case "asset":
      return "JS/CSS";
    case "media":
      return "Img/Media";
    default:
      return "Other";
  }
}

function normalizeHeaders(headers) {
  if (!Array.isArray(headers)) {
    return [];
  }
  return headers.map((header) => ({ name: header.name || "", value: header.value || "" }));
}

function safePathname(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return truncate(url, 68) || "未知请求";
  }
}

function normalizeResourceType(entry, mimeType, url) {
  const rawType = String(entry._resourceType || entry.resourceType || "").toLowerCase();
  if (rawType === "fetch" || rawType === "xhr") return "fetch-xhr";
  if (rawType === "document") return "document";
  if (rawType === "script" || rawType === "stylesheet") return "asset";
  if (rawType === "image" || rawType === "media" || rawType === "font") return "media";
  if (rawType) return "other";

  const lowerMime = String(mimeType).toLowerCase();
  const lowerUrl = String(url).toLowerCase();
  if (lowerMime.includes("json") || lowerMime.includes("xml") || /\.json($|\?)/.test(lowerUrl) || /\/api\//.test(lowerUrl)) {
    return "fetch-xhr";
  }
  if (lowerMime.includes("text/html")) return "document";
  if (lowerMime.includes("css") || lowerMime.includes("javascript")) return "asset";
  if (lowerMime.startsWith("image/") || lowerMime.startsWith("video/") || lowerMime.startsWith("audio/") || lowerMime.includes("font")) {
    return "media";
  }
  return "other";
}

function detectBrowser(headers = []) {
  const uaHeader = getHeaderValue(headers, "user-agent");
  const platformHeader = getHeaderValue(headers, "sec-ch-ua-platform");
  const ua = uaHeader || navigator.userAgent;
  const chromeMatch = ua.match(/Chrome\/([\d.]+)/);
  let os = "Unknown";

  if (platformHeader) {
    os = platformHeader.replace(/^"|"$/g, "");
  } else if (/Windows NT 10.0/i.test(ua)) {
    os = "Windows 10/11";
  } else if (/Mac OS X ([\d_]+)/i.test(ua)) {
    os = `macOS ${RegExp.$1.replaceAll("_", ".")}`;
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  return { browser: chromeMatch ? `Chrome ${chromeMatch[1]}` : ua, os };
}

function findTraceLikeValue(headers) {
  for (const headerName of TRACE_HEADER_NAMES) {
    const match = headers.find((header) => header.name.toLowerCase() === headerName);
    if (match?.value) return match.value;
  }
  return "";
}

function extractTraceId(request) {
  return findTraceLikeValue(request.responseHeaders) || findTraceLikeValue(request.requestHeaders) || "未提供";
}

function splitHeaderGroups(headers, side) {
  const excluded = new Set([
    "accept", "accept-encoding", "accept-language", "cache-control", "connection", "content-length",
    "content-type", "cookie", "host", "origin", "pragma", "referer", "sec-ch-ua", "sec-ch-ua-mobile",
    "sec-ch-ua-platform", "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site", "sec-fetch-user",
    "user-agent", "vary"
  ]);

  if (side === "response") {
    ["content-encoding", "content-type", "date", "server", "transfer-encoding"].forEach((name) => excluded.add(name));
  }

  const filtered = headers.filter((header) => {
    const name = header.name.toLowerCase();
    if (excluded.has(name)) return false;
    return name.startsWith("x-")
      || name.startsWith("trace")
      || name.startsWith("auth")
      || name.startsWith("request")
      || name.startsWith("response")
      || name.startsWith("tenant")
      || name.startsWith("client")
      || name.startsWith("gateway")
      || name.startsWith("cf-")
      || name.startsWith("x-b3-")
      || name.startsWith("x-amzn-")
      || name.startsWith("x-forwarded-");
  });

  return {
    trace: filtered.filter((header) => isTraceHeader(header.name)),
    business: filtered.filter((header) => !isTraceHeader(header.name))
  };
}

function isTraceHeader(name) {
  const lowerName = name.toLowerCase();
  return lowerName.startsWith("authorization")
    || lowerName.startsWith("auth")
    || lowerName.startsWith("x-auth")
    || lowerName.startsWith("trace")
    || lowerName.includes("request-id")
    || lowerName.includes("trace-id")
    || lowerName.startsWith("x-request")
    || lowerName.startsWith("x-b3-")
    || lowerName.startsWith("x-forwarded-")
    || lowerName.startsWith("cf-")
    || lowerName.startsWith("x-amzn-");
}

function getHeaderValue(headers, headerName) {
  const match = headers.find((header) => header.name.toLowerCase() === headerName.toLowerCase());
  return match?.value || "";
}

function formatHeaders(headers) {
  if (!headers.length) return "无额外关键信息";
  return fenceBlock(headers.map((header) => `${header.name}: ${header.value}`).join("\n"));
}

function formatQueryParams(params) {
  if (!params.length) return "无";
  return fenceBlock(params.map((param) => `${param.name}=${param.value}`).join("\n"));
}

function formatResponseSummary(body, mimeType) {
  if (!body || !body.trim()) return "空响应体 / 浏览器未提供";
  const trimmed = body.trim();
  const lowerMime = String(mimeType || "").toLowerCase();
  const looksJson = lowerMime.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[");

  if (looksJson) {
    try {
      return fenceBlock(summarizeJson(JSON.parse(trimmed)));
    } catch {
      return fenceBlock(truncateLargeBlock(trimmed));
    }
  }
  if (trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html")) {
    return "HTML 响应，建议仅在需要时查看原始内容";
  }
  return fenceBlock(truncateLargeBlock(trimmed));
}

function summarizeJson(value) {
  if (Array.isArray(value)) {
    const sample = value.length > 0 ? JSON.stringify(value[0], null, 2) : "[]";
    return `type: array\nlength: ${value.length}\nsample: ${truncateLargeBlock(sample)}`;
  }
  if (!value || typeof value !== "object") {
    return truncateLargeBlock(String(value));
  }

  const importantKeys = ["code", "status", "success", "message", "msg", "error", "errorCode", "errorMessage", "requestId", "traceId", "timestamp"];
  const picked = {};
  importantKeys.forEach((key) => {
    if (key in value) picked[key] = value[key];
  });
  if (Object.keys(picked).length === 0) {
    Object.keys(value).slice(0, 8).forEach((key) => {
      picked[key] = value[key];
    });
  }
  return truncateLargeBlock(JSON.stringify(picked, null, 2));
}

function formatStatus(request) {
  if (!request.status) return "status 0 / Network Error";
  return `${request.status} ${request.statusText}`.trim();
}

function fenceBlock(value) {
  return ["```text", value || "", "```"].join("\n");
}

function truncateLargeBlock(value) {
  const maxLength = 4000;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n... [truncated ${value.length - maxLength} chars]`;
}

function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function collectSensitiveHits(values) {
  const hits = new Set();
  const merged = values.filter(Boolean).join("\n");
  SENSITIVE_PATTERNS.forEach((pattern) => {
    if (pattern.test(merged)) hits.add(pattern.source);
  });
  return [...hits];
}

function normalizeMultilineInput(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "待补充";
  return trimmed.replace(/\n+/g, " / ");
}
