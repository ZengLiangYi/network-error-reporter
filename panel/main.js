import {
  buildMarkdownReport,
  formatDateTime,
  formatDuration,
  formatResourceLabel,
  normalizeEntry,
  SENSITIVE_PATTERNS
} from "./report.js";

const state = {
  requests: [],
  resourceFilter: "fetch-xhr",
  impactScope: "",
  frequency: "",
  selectedId: null,
  latestReport: "",
  lastGeneratedFromId: null
};

const elements = {
  requestList: document.querySelector("#requestList"),
  requestTemplate: document.querySelector("#requestItemTemplate"),
  resourceFilters: [...document.querySelectorAll(".filter-chip")],
  refreshHarButton: document.querySelector("#refreshHarButton"),
  copyButton: document.querySelector("#copyButton"),
  showAllToggle: document.querySelector("#showAllToggle"),
  reportPreview: document.querySelector("#reportPreview"),
  emptyState: document.querySelector("#emptyState"),
  selectionBadge: document.querySelector("#selectionBadge"),
  sensitiveBadge: document.querySelector("#sensitiveBadge"),
  warningBanner: document.querySelector("#warningBanner"),
  copyStatus: document.querySelector("#copyStatus"),
  pillOptions: [...document.querySelectorAll(".pill-option")],
  includeRequestHeaders: document.querySelector("#includeRequestHeaders"),
  includeQueryParams: document.querySelector("#includeQueryParams"),
  includeRequestPayload: document.querySelector("#includeRequestPayload"),
  includeResponseHeaders: document.querySelector("#includeResponseHeaders"),
  includeResponseBody: document.querySelector("#includeResponseBody"),
  reproSteps: document.querySelector("#reproSteps"),
  expectedResult: document.querySelector("#expectedResult"),
  actualResult: document.querySelector("#actualResult"),
  remarks: document.querySelector("#remarks")
};

boot();

function boot() {
  attachEvents();
  renderFilterState();
  renderPillState();
  loadHarEntries();
  chrome.devtools.network.onRequestFinished.addListener(handleRequestFinished);
}

function attachEvents() {
  elements.refreshHarButton.addEventListener("click", loadHarEntries);
  elements.copyButton.addEventListener("click", copyMarkdown);
  elements.showAllToggle.addEventListener("change", renderRequestList);

  elements.pillOptions.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.target;
      const value = button.dataset.value || "";
      if (target === "impact") {
        state.impactScope = state.impactScope === value ? "" : value;
      } else if (target === "frequency") {
        state.frequency = state.frequency === value ? "" : value;
      }
      renderPillState();
      regeneratePreviewIfNeeded();
    });
  });

  elements.resourceFilters.forEach((button) => {
    button.addEventListener("click", () => {
      state.resourceFilter = button.dataset.filter || "fetch-xhr";
      renderFilterState();
      renderRequestList();
    });
  });

  [
    elements.includeRequestHeaders,
    elements.includeQueryParams,
    elements.includeRequestPayload,
    elements.includeResponseHeaders,
    elements.includeResponseBody,
    elements.reproSteps,
    elements.expectedResult,
    elements.actualResult,
    elements.remarks
  ].forEach((input) => {
    input.addEventListener("input", regeneratePreviewIfNeeded);
    input.addEventListener("change", regeneratePreviewIfNeeded);
  });
}

function loadHarEntries() {
  chrome.devtools.network.getHAR((harLog) => {
    const entries = Array.isArray(harLog?.entries) ? harLog.entries : [];
    entries.forEach(upsertRequest);
    renderRequestList();
  });
}

function handleRequestFinished(entry) {
  upsertRequest(entry);
  renderRequestList();
}

function upsertRequest(entry) {
  const normalized = normalizeEntry(entry);
  const index = state.requests.findIndex((item) => item.id === normalized.id);

  if (index >= 0) {
    state.requests[index] = normalized;
  } else {
    state.requests.unshift(normalized);
  }

  state.requests = state.requests
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    .slice(0, 200);

  if (!state.selectedId && state.requests.length > 0) {
    const firstFailed = state.requests.find((item) => item.isFailure) ?? state.requests[0];
    state.selectedId = firstFailed.id;
  }
}

function renderRequestList() {
  const includeAll = elements.showAllToggle.checked;
  const requests = applyResourceFilter(includeAll
    ? state.requests
    : state.requests.filter((item) => item.isFailure));

  if (requests.length > 0 && !requests.some((item) => item.id === state.selectedId)) {
    state.selectedId = requests[0].id;
    if (state.lastGeneratedFromId) {
      queueMicrotask(() => generateReport());
    }
  }

  elements.requestList.innerHTML = "";

  if (requests.length === 0) {
    const empty = document.createElement("div");
    empty.className = "request-list-empty";
    empty.textContent = includeAll
      ? "当前没有符合筛选条件的请求。先触发一次请求，再回来刷新。"
      : "当前还没有采集到符合筛选条件的失败请求。";
    elements.requestList.appendChild(empty);
    return;
  }

  requests.forEach((item) => {
    const fragment = elements.requestTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".request-item");
    const method = fragment.querySelector(".request-method");
    const status = fragment.querySelector(".request-status");
    const path = fragment.querySelector(".request-path");
    const meta = fragment.querySelector(".request-meta");
    const type = document.createElement("div");

    button.dataset.id = item.id;
    if (item.id === state.selectedId) {
      button.classList.add("active");
    }

    method.textContent = item.method;
    status.textContent = item.status ? `${item.status} ${item.statusText}`.trim() : "status 0";
    status.classList.add(item.isFailure ? "status-error" : "status-ok");
    path.textContent = item.path;
    meta.textContent = `${formatDateTime(item.startedAt)} · ${formatDuration(item.timeMs)} · ${truncate(item.url, 58)}`;
    type.className = "request-type";
    type.textContent = formatResourceLabel(item.resourceType);

    button.addEventListener("click", () => {
      state.selectedId = item.id;
      elements.copyStatus.textContent = "";
      renderRequestList();
      updateSelectionBadge(item);
      generateReport();
    });

    button.appendChild(type);
    elements.requestList.appendChild(fragment);
  });

  updateSelectionBadge(getSelectedRequest());
}

async function generateReport() {
  const request = getSelectedRequest();
  if (!request) {
    setWarning("请先从左侧选择一条请求。");
    return;
  }

  const responseBody = await getResponseBody(request.raw);
  const pageUrl = await getInspectedPageUrl();
  const report = await buildMarkdownReport({
    request,
    pageUrl,
    responseBody,
    formState: readFormState()
  });

  state.latestReport = report.markdown;
  state.lastGeneratedFromId = request.id;
  renderPreviewDocument(report.preview);
  elements.reportPreview.classList.remove("hidden");
  elements.emptyState.classList.add("hidden");
  elements.copyButton.disabled = false;
  renderSensitiveState(report.sensitiveHits, request);
  setWarning(report.warningMessage);
}

function regeneratePreviewIfNeeded() {
  if (!state.lastGeneratedFromId || state.lastGeneratedFromId !== state.selectedId) {
    return;
  }
  generateReport();
}

function readFormState() {
  return {
    impactScope: state.impactScope,
    frequency: state.frequency,
    includeRequestHeaders: elements.includeRequestHeaders.checked,
    includeQueryParams: elements.includeQueryParams.checked,
    includeRequestPayload: elements.includeRequestPayload.checked,
    includeResponseHeaders: elements.includeResponseHeaders.checked,
    includeResponseBody: elements.includeResponseBody.checked,
    reproSteps: elements.reproSteps.value,
    expectedResult: elements.expectedResult.value,
    actualResult: elements.actualResult.value,
    remarks: elements.remarks.value
  };
}

function renderFilterState() {
  elements.resourceFilters.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.resourceFilter);
  });
}

function renderPillState() {
  elements.pillOptions.forEach((button) => {
    const target = button.dataset.target;
    const value = button.dataset.value || "";
    const active = (target === "impact" && state.impactScope === value)
      || (target === "frequency" && state.frequency === value);
    button.classList.toggle("active", active);
  });
}

function renderSensitiveState(sensitiveHits, request) {
  elements.sensitiveBadge.textContent = `敏感字段：${sensitiveHits.length}`;
  elements.sensitiveBadge.classList.toggle("badge-muted", sensitiveHits.length === 0);
  updateSelectionBadge(request);
}

function updateSelectionBadge(request) {
  if (!request) {
    elements.selectionBadge.textContent = "未选择请求";
    return;
  }
  elements.selectionBadge.textContent = request.status
    ? `${request.status} · ${request.method}`
    : `status 0 · ${request.method}`;
}

function setWarning(message) {
  if (!message) {
    elements.warningBanner.textContent = "";
    elements.warningBanner.classList.add("hidden");
    return;
  }
  elements.warningBanner.textContent = message;
  elements.warningBanner.classList.remove("hidden");
}

function renderPreviewDocument(preview) {
  elements.reportPreview.innerHTML = "";

  const root = document.createElement("div");
  root.className = "preview-doc";

  root.appendChild(buildSectionList("环境信息", preview.environmentItems));
  root.appendChild(buildDetailTable(preview.detailRows));
  root.appendChild(buildSectionBlocks("请求与响应明细", preview.detailSections));
  root.appendChild(buildSectionList("影响评估", preview.impactItems));
  root.appendChild(buildSectionList("复现说明", preview.reproItems));
  root.appendChild(buildAttachment(preview.attachmentText));

  elements.reportPreview.appendChild(root);
}

function buildSectionList(title, items) {
  const section = document.createElement("section");
  section.className = "preview-section";

  const heading = document.createElement("h3");
  heading.className = "preview-section-title";
  heading.textContent = title;
  section.appendChild(heading);

  const list = document.createElement("div");
  list.className = "preview-list";
  items.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "preview-list-row";
    row.innerHTML = `<span class="preview-list-label">${escapeHtml(label)}</span><span class="preview-list-value">${escapeHtml(value)}</span>`;
    list.appendChild(row);
  });
  section.appendChild(list);
  return section;
}

function buildDetailTable(rows) {
  const section = document.createElement("section");
  section.className = "preview-section";

  const heading = document.createElement("h3");
  heading.className = "preview-section-title";
  heading.textContent = "错误详情";
  section.appendChild(heading);

  const table = document.createElement("table");
  table.className = "preview-table";
  table.innerHTML = "<thead><tr><th>字段</th><th>值</th></tr></thead>";
  const body = document.createElement("tbody");
  rows.forEach(([label, value]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(label)}</td><td><code>${escapeHtml(value)}</code></td>`;
    body.appendChild(tr);
  });
  table.appendChild(body);
  section.appendChild(table);
  return section;
}

function buildSectionBlocks(title, blocks) {
  const section = document.createElement("section");
  section.className = "preview-section";

  const heading = document.createElement("h3");
  heading.className = "preview-section-title";
  heading.textContent = title;
  section.appendChild(heading);

  const stack = document.createElement("div");
  stack.className = "preview-block-stack";
  blocks.forEach((block) => {
    const item = document.createElement("div");
    item.className = "preview-block";
    item.innerHTML = `
      <div class="preview-block-label">${escapeHtml(block.label)}</div>
      <pre class="preview-code">${escapeHtml(stripFence(block.value))}</pre>
    `;
    stack.appendChild(item);
  });
  section.appendChild(stack);
  return section;
}

function buildAttachment(text) {
  const section = document.createElement("section");
  section.className = "preview-section";
  const heading = document.createElement("h3");
  heading.className = "preview-section-title";
  heading.textContent = "补充附件";
  section.appendChild(heading);

  const p = document.createElement("p");
  p.className = "preview-attachment";
  p.textContent = text;
  section.appendChild(p);
  return section;
}

function stripFence(value) {
  return value.replace(/^```text\n?/, "").replace(/\n```$/, "");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function copyMarkdown() {
  if (!state.latestReport) {
    return;
  }
  const hasSensitiveData = SENSITIVE_PATTERNS.some((pattern) => pattern.test(state.latestReport));
  if (hasSensitiveData) {
    const confirmed = window.confirm("报告中可能包含敏感字段，确认复制并发送给后端吗？");
    if (!confirmed) {
      return;
    }
  }

  try {
    await navigator.clipboard.writeText(state.latestReport);
    elements.copyStatus.textContent = "已复制到剪贴板。";
  } catch {
    elements.copyStatus.textContent = "复制失败，请检查扩展是否允许访问剪贴板。";
  }
}

function getSelectedRequest() {
  return state.requests.find((item) => item.id === state.selectedId) || null;
}

function applyResourceFilter(requests) {
  if (state.resourceFilter === "all") {
    return requests;
  }
  return requests.filter((item) => item.resourceType === state.resourceFilter);
}

function getInspectedPageUrl() {
  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval("location.href", (result, exceptionInfo) => {
      if (exceptionInfo?.isException) {
        resolve("");
        return;
      }
      resolve(typeof result === "string" ? result : "");
    });
  });
}

function getResponseBody(entry) {
  return new Promise((resolve) => {
    if (!entry || typeof entry.getContent !== "function") {
      resolve("");
      return;
    }
    entry.getContent((content) => resolve(content || ""));
  });
}

function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
}
