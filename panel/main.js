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
  latestPreview: null,
  lastGeneratedFromId: null
};

const elements = {
  requestList: document.querySelector("#requestList"),
  requestTemplate: document.querySelector("#requestItemTemplate"),
  resourceFilters: [...document.querySelectorAll(".filter-chip")],
  refreshHarButton: document.querySelector("#refreshHarButton"),
  copyPngButton: document.querySelector("#copyPngButton"),
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
  elements.copyPngButton.addEventListener("click", exportPreviewAsImage);
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
  state.latestPreview = report.preview;
  state.lastGeneratedFromId = request.id;
  renderPreviewDocument(report.preview);
  elements.reportPreview.classList.remove("hidden");
  elements.emptyState.classList.add("hidden");
  elements.copyPngButton.disabled = false;
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

async function exportPreviewAsImage() {
  if (!state.latestPreview) {
    elements.copyStatus.textContent = "当前没有可导出的报告预览。";
    return;
  }

  try {
    const blob = await renderPreviewToBlob(state.latestPreview);
    if (!blob) {
      throw new Error("empty-blob");
    }

    const copied = await tryCopyImageToClipboard(blob);
    if (copied) {
      elements.copyStatus.textContent = "已复制图片到剪贴板。";
      return;
    }

    downloadBlob(blob, buildExportFileName());
    elements.copyStatus.textContent = "当前浏览器不支持图片剪贴板，已自动下载报告图片。";
  } catch {
    elements.copyStatus.textContent = "导出图片失败，请重试。";
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

async function renderPreviewToBlob(node) {
  const metrics = measurePreviewLayout(node);
  const ratio = Math.max(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.width = metrics.width * ratio;
  canvas.height = metrics.height * ratio;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return null;
  }

  ctx.scale(ratio, ratio);
  drawPreviewCanvas(ctx, metrics);

  return await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

async function tryCopyImageToClipboard(blob) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    return false;
  }

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob
      })
    ]);
    return true;
  } catch {
    return false;
  }
}

function downloadBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function buildExportFileName() {
  const request = getSelectedRequest();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const pathName = request?.path
    ? request.path.replace(/[\\/:*?"<>|]+/g, "-").replace(/-+/g, "-").slice(0, 40)
    : "network-error-report";
  return `${pathName || "network-error-report"}-${stamp}.png`;
}

function measurePreviewLayout(preview) {
  const width = 1080;
  const outerPadding = 32;
  const sectionGap = 20;
  const sectionWidth = width - outerPadding * 2;
  const labelWidth = 148;
  const rowGap = 0;
  const blocks = [];
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");

  const listSection = (title, items) => {
    const titleHeight = 46;
    const rowHeights = items.map(([label, value]) => {
      const valueLines = measureWrappedLines(measureCtx, String(value), `${TEXT_SIZE}px "Segoe UI"`, sectionWidth - 24 - labelWidth - 12);
      return Math.max(38, valueLines.length * 18 + 18);
    });
    const rowsHeight = rowHeights.reduce((sum, height) => sum + height, 0);
    return { type: "list", title, items, titleHeight, rowHeights, height: titleHeight + rowsHeight };
  };

  const tableSection = () => {
    const titleHeight = 46;
    const headerHeight = 38;
    const valueWidth = sectionWidth - 24 - 176;
    const rowHeights = preview.detailRows.map(([label, value]) => {
      const valueLines = measureWrappedLines(measureCtx, String(value), `${MONO_TEXT_SIZE}px "Consolas"`, valueWidth);
      return Math.max(40, valueLines.length * 18 + 18);
    });
    const rowsHeight = rowHeights.reduce((sum, height) => sum + height, 0);
    return {
      type: "table",
      title: "错误详情",
      rows: preview.detailRows,
      titleHeight,
      headerHeight,
      rowHeights,
      height: titleHeight + headerHeight + rowsHeight
    };
  };

  const blockSection = () => {
    const titleHeight = 46;
    const stackPadding = 12;
    const blockGap = 12;
    const contentWidth = sectionWidth - stackPadding * 2 - 24;
    const blockHeights = preview.detailSections.map((block) => {
      const body = stripFence(block.value);
      const lines = measureWrappedLines(measureCtx, body, `${MONO_TEXT_SIZE}px "Consolas"`, contentWidth);
      return 38 + Math.max(56, lines.length * 18 + 20);
    });
    const bodyHeight = blockHeights.length
      ? stackPadding * 2 + blockHeights.reduce((sum, height) => sum + height, 0) + blockGap * (blockHeights.length - 1)
      : 0;
    return {
      type: "blocks",
      title: "请求与响应明细",
      blocks: preview.detailSections,
      titleHeight,
      blockHeights,
      height: titleHeight + bodyHeight
    };
  };

  const attachmentSection = () => {
    const titleHeight = 46;
    const lines = measureWrappedLines(measureCtx, String(preview.attachmentText), `${TEXT_SIZE}px "Segoe UI"`, sectionWidth - 24);
    return {
      type: "attachment",
      title: "补充附件",
      text: preview.attachmentText,
      titleHeight,
      textLines: lines,
      height: titleHeight + lines.length * 18 + 22
    };
  };

  blocks.push(listSection("环境信息", preview.environmentItems));
  blocks.push(tableSection());
  blocks.push(blockSection());
  blocks.push(listSection("影响评估", preview.impactItems));
  blocks.push(listSection("复现说明", preview.reproItems));
  blocks.push(attachmentSection());

  const height = outerPadding * 2 + blocks.reduce((sum, block) => sum + block.height, 0) + sectionGap * (blocks.length - 1);
  return { width, height, outerPadding, sectionGap, sectionWidth, labelWidth, blocks };
}

const TEXT_SIZE = 13;
const MONO_TEXT_SIZE = 12;

function drawPreviewCanvas(ctx, metrics) {
  const palette = {
    background: "#f7f2fa",
    section: "#fffafb",
    sectionBorder: "rgba(121, 116, 126, 0.16)",
    sectionTitleBg: "rgba(255,255,255,0.82)",
    sectionDivider: "rgba(121, 116, 126, 0.10)",
    text: "#1d1b20",
    muted: "#625b66",
    monoBg: "#f3edf7"
  };

  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, metrics.width, metrics.height);

  let y = metrics.outerPadding;
  metrics.blocks.forEach((block, index) => {
    drawSectionFrame(ctx, metrics.outerPadding, y, metrics.sectionWidth, block.height, block.title, palette);

    if (block.type === "list") {
      drawListSection(ctx, block, metrics, y, palette);
    } else if (block.type === "table") {
      drawTableSection(ctx, block, metrics, y, palette);
    } else if (block.type === "blocks") {
      drawBlocksSection(ctx, block, metrics, y, palette);
    } else if (block.type === "attachment") {
      drawAttachmentSection(ctx, block, metrics, y, palette);
    }

    y += block.height;
    if (index < metrics.blocks.length - 1) {
      y += metrics.sectionGap;
    }
  });
}

function drawSectionFrame(ctx, x, y, width, height, title, palette) {
  roundRect(ctx, x, y, width, height, 18);
  ctx.fillStyle = palette.section;
  ctx.fill();
  ctx.strokeStyle = palette.sectionBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.save();
  roundRect(ctx, x, y, width, 46, 18);
  ctx.clip();
  ctx.fillStyle = palette.sectionTitleBg;
  ctx.fillRect(x, y, width, 46);
  ctx.restore();

  ctx.strokeStyle = palette.sectionDivider;
  ctx.beginPath();
  ctx.moveTo(x, y + 46);
  ctx.lineTo(x + width, y + 46);
  ctx.stroke();

  ctx.fillStyle = palette.text;
  ctx.font = '600 13px "Segoe UI"';
  ctx.textBaseline = "middle";
  ctx.fillText(title, x + 14, y + 23);
}

function drawListSection(ctx, section, metrics, sectionY, palette) {
  let rowY = sectionY + section.titleHeight;
  section.items.forEach(([label, value], index) => {
    const rowHeight = section.rowHeights[index];
    if (index > 0) {
      drawDivider(ctx, metrics.outerPadding, rowY, metrics.sectionWidth, palette);
    }

    ctx.fillStyle = palette.muted;
    ctx.font = `${TEXT_SIZE}px "Segoe UI"`;
    ctx.textBaseline = "top";
    ctx.fillText(label, metrics.outerPadding + 14, rowY + 10);

    const lines = measureWrappedLines(ctx, String(value), `${TEXT_SIZE}px "Segoe UI"`, metrics.sectionWidth - 24 - metrics.labelWidth - 12);
    drawTextLines(ctx, lines, metrics.outerPadding + 14 + metrics.labelWidth + 12, rowY + 10, 18, palette.text, `${TEXT_SIZE}px "Segoe UI"`);

    rowY += rowHeight;
  });
}

function drawTableSection(ctx, section, metrics, sectionY, palette) {
  const x = metrics.outerPadding;
  const valueColumnX = x + 176;
  const tableWidth = metrics.sectionWidth;
  let y = sectionY + section.titleHeight;

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(x, y, tableWidth, section.headerHeight);
  ctx.fillStyle = palette.muted;
  ctx.font = '600 12px "Segoe UI"';
  ctx.textBaseline = "middle";
  ctx.fillText("字段", x + 14, y + section.headerHeight / 2);
  ctx.fillText("值", valueColumnX + 12, y + section.headerHeight / 2);
  y += section.headerHeight;

  section.rows.forEach(([label, value], index) => {
    const rowHeight = section.rowHeights[index];
    drawDivider(ctx, x, y, tableWidth, palette);

    ctx.fillStyle = palette.text;
    ctx.font = `${TEXT_SIZE}px "Segoe UI"`;
    ctx.textBaseline = "top";
    ctx.fillText(label, x + 14, y + 10);

    const lines = measureWrappedLines(ctx, String(value), `${MONO_TEXT_SIZE}px "Consolas"`, tableWidth - 176 - 24);
    drawCodeLines(ctx, lines, valueColumnX + 12, y + 10, 18, palette);
    y += rowHeight;
  });
}

function drawBlocksSection(ctx, section, metrics, sectionY, palette) {
  const x = metrics.outerPadding + 12;
  const width = metrics.sectionWidth - 24;
  let y = sectionY + section.titleHeight + 12;

  section.blocks.forEach((block, index) => {
    const height = section.blockHeights[index];
    roundRect(ctx, x, y, width, height, 12);
    ctx.fillStyle = "#f4eff7";
    ctx.fill();
    ctx.strokeStyle = "rgba(121, 116, 126, 0.12)";
    ctx.stroke();

    ctx.strokeStyle = "rgba(121, 116, 126, 0.10)";
    ctx.beginPath();
    ctx.moveTo(x, y + 38);
    ctx.lineTo(x + width, y + 38);
    ctx.stroke();

    ctx.fillStyle = palette.muted;
    ctx.font = `500 ${TEXT_SIZE}px "Segoe UI"`;
    ctx.textBaseline = "middle";
    ctx.fillText(block.label, x + 12, y + 19);

    const lines = measureWrappedLines(ctx, stripFence(block.value), `${MONO_TEXT_SIZE}px "Consolas"`, width - 24);
    drawCodeLines(ctx, lines, x + 12, y + 50, 18, palette);

    y += height + 12;
  });
}

function drawAttachmentSection(ctx, section, metrics, sectionY, palette) {
  drawTextLines(
    ctx,
    section.textLines,
    metrics.outerPadding + 14,
    sectionY + section.titleHeight + 12,
    18,
    palette.text,
    `${TEXT_SIZE}px "Segoe UI"`
  );
}

function drawDivider(ctx, x, y, width, palette) {
  ctx.strokeStyle = palette.sectionDivider;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
}

function drawTextLines(ctx, lines, x, y, lineHeight, color, font) {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
}

function drawCodeLines(ctx, lines, x, y, lineHeight, palette) {
  drawTextLines(ctx, lines, x, y, lineHeight, palette.text, `${MONO_TEXT_SIZE}px "Consolas"`);
}

function measureWrappedLines(ctx, text, font, maxWidth) {
  const normalized = String(text || "无").replace(/\r\n/g, "\n");
  const paragraphs = normalized.split("\n");
  const lines = [];
  ctx.font = font;

  paragraphs.forEach((paragraph) => {
    if (!paragraph) {
      lines.push("");
      return;
    }

    let current = "";
    for (const char of paragraph) {
      const candidate = current + char;
      if (!current || ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
        continue;
      }
      lines.push(current);
      current = char;
    }
    if (current) {
      lines.push(current);
    }
  });

  return lines.length ? lines : ["无"];
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
