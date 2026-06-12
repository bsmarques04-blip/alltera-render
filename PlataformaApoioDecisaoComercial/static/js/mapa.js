// Centro inicial: Portugal (visão geral, sem zoom excessivo)
const defaultCenter = [39.5, -8.0];
const todayIso = new Date().toISOString().slice(0, 10);

/** Raio fixo para “mesmo dia” e plano de contactos (km). */
const DEFAULT_NEARBY_RADIUS_KM = 10;

/** Estados excluídos do plano de contactos do dia e da lista de próximas. */
const STATES_EXCLUDED_DAY_CONTACT = ["Já tratado / no CRM", "Sem interesse", "Reunião marcada", "Sem interesse definitivo", "Cliente existente"];

let allLeads = [];
let leadsById = new Map();
let visibleLeads = [];
let visibleLeadIds = new Set();
let nearbyLeads = [];
let nearbyLeadIds = new Set();
let selectedLead = null;
let markers = new Map();
let radiusCircle = null;
let currentPlanRows = [];
let heatLayer = null;
let planLine = null;
let orderMarkers = [];
let territoryLayer = null;
let smartRouteLine = null;
let smartRouteMarkers = [];
let mapInitialFitDone = false;
let nearbyRadiusKm = DEFAULT_NEARBY_RADIUS_KM;
let clusterLayer = null;
let selectedBulkIds = new Set();
let baseLayer = null;
let hoveredLeadId = null;
let leadListMode = "visible";
let currentRouteDay = [];
let markersRenderKey = "";
let heatmapScriptPromise = null;
let leadFetchController = null;
let leadSummaryController = null;
let lastLeadFetchKey = "";
const LEAD_LIST_RENDER_LIMIT = 160;
const initialUrlParams = new URLSearchParams(window.location.search);
const initialFocusLeadId = Number(initialUrlParams.get("lead_id")) || null;
let hasConsumedInitialFocus = !initialFocusLeadId;

document.body.classList.add("map-performance-mode");

const map = L.map("map", {
    zoomControl: true,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 90,
    closePopupOnClick: false,
}).setView(defaultCenter, 7);
map.getContainer().setAttribute("tabindex", "0");
function applyMapTiles() {
    if (baseLayer) baseLayer.remove();
    baseLayer = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        { attribution: "&copy; OpenStreetMap &copy; CARTO", maxZoom: 20 }
    ).addTo(map);
}
applyMapTiles();

const els = {
    searchInput: document.getElementById("searchInput"),
    localityFilter: document.getElementById("localityFilter"),
    typeFilter: document.getElementById("typeFilter"),
    assignmentScopeFilter: document.getElementById("assignmentScopeFilter"),
    commercialFilter: document.getElementById("commercialFilter"),
    stateFilter: document.getElementById("stateFilter"),
    heatFilter: document.getElementById("heatFilter"),
    classificationFilter: document.getElementById("classificationFilter"),
    scheduleFilter: document.getElementById("scheduleFilter"),
    tagFilter: document.getElementById("tagFilter"),
    insightFilter: document.getElementById("insightFilter"),
    historyFilter: document.getElementById("historyFilter"),
    heatmapToggle: document.getElementById("heatmapToggle"),
    territoryMode: document.getElementById("territoryMode"),
    resetFilters: document.getElementById("resetFilters"),
    selectedState: document.getElementById("selectedState"),
    leadDrawerTitle: document.getElementById("leadDrawerTitle"),
    leadDetails: document.getElementById("leadDetails"),
    leadHistory: document.getElementById("leadHistory"),
    leadNoteInput: document.getElementById("leadNoteInput"),
    addLeadNote: document.getElementById("addLeadNote"),
    tagSelect: document.getElementById("tagSelect"),
    addTag: document.getElementById("addTag"),
    tagList: document.getElementById("tagList"),
    nearbyCount: document.getElementById("nearbyCount"),
    nearbyList: document.getElementById("nearbyList"),
    planCommercial: document.getElementById("planCommercial"),
    planDate: document.getElementById("planDate"),
    planMax: document.getElementById("planMax"),
    generatePlan: document.getElementById("generatePlan"),
    exportPlan: document.getElementById("exportPlan"),
    planSummary: document.getElementById("planSummary"),
    visitPlan: document.getElementById("visitPlan"),
    leadsList: document.getElementById("leadsList"),
    listCount: document.getElementById("listCount"),
    editLeadLink: document.getElementById("editLeadLink"),
    leadDrawer: document.getElementById("leadDrawer"),
    drawerClose: document.getElementById("drawerClose"),
    drawerBackdrop: document.getElementById("drawerBackdrop"),
    dayContactPlan: document.getElementById("dayContactPlan"),
    nearbyRadius: document.getElementById("nearbyRadius"),
    nearbyRadiusValue: document.getElementById("nearbyRadiusValue"),
    nearbyRadiusText: document.getElementById("nearbyRadiusText"),
    nearbyTitle: document.getElementById("nearbyTitle"),
    recommendedZone: document.getElementById("recommendedZone"),
    forgottenAlert: document.getElementById("forgottenAlert"),
    operationalMode: document.getElementById("operationalMode"),
    presentationMode: document.getElementById("presentationMode"),
    metricTotal: document.getElementById("metricTotal"),
    metricActive: document.getElementById("metricActive"),
    metricCrm: document.getElementById("metricCrm"),
    metricPostponed: document.getElementById("metricPostponed"),
    mapBulkActions: document.getElementById("mapBulkActions"),
    bulkSelectedCount: document.getElementById("bulkSelectedCount"),
    bulkCommercial: document.getElementById("bulkCommercial"),
    bulkState: document.getElementById("bulkState"),
    bulkAssign: document.getElementById("bulkAssign"),
    bulkClearCommercial: document.getElementById("bulkClearCommercial"),
    bulkSetState: document.getElementById("bulkSetState"),
    bulkIgnore: document.getElementById("bulkIgnore"),
    bulkExport: document.getElementById("bulkExport"),
    bulkPlan: document.getElementById("bulkPlan"),
    nextLeadButton: document.getElementById("nextLeadButton"),
    mapGeoStats: document.getElementById("mapGeoStats"),
    mapLeadMiniCard: document.getElementById("mapLeadMiniCard"),
    mapLoading: document.getElementById("mapLoading"),
    leadListTabVisible: document.getElementById("leadListTabVisible"),
    leadListTabAll: document.getElementById("leadListTabAll"),
    openFullLead: document.getElementById("openFullLead"),
    focusSelectedLead: document.getElementById("focusSelectedLead"),
};

if (els.planDate) els.planDate.value = todayIso;

function setMapLoading(loading) {
    if (!els.mapLoading) return;
    els.mapLoading.hidden = !loading;
}

const INSIGHT_TAGS = [
    "VIP",
    "Difícil",
    "Só WhatsApp",
    "Prefere email",
    "Recuperar",
    "Sem resposta",
    "Gatekeeper",
];

function haversineKm(a, b) { /* unchanged */
    const earthRadiusKm = 6371;
    const dLat = toRadians(b.latitude - a.latitude);
    const dLon = toRadians(b.longitude - a.longitude);
    const lat1 = toRadians(a.latitude);
    const lat2 = toRadians(b.latitude);
    const value =
        Math.sin(dLat / 2) ** 2 +
        Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(value) {
    return (value * Math.PI) / 180;
}

function normalize(value) {
    return String(value || "").toLowerCase();
}

function normalizeSearch(text) {
    if (text === null || text === undefined) return "";
    return String(text)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}


function normalizeKey(value) {
    return normalize(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "");
}

function commercialKey(value) {
    const key = normalizeKey(value);
    if (!key || key === "outro" || key === "semcomercial" || key === "semcomercialatribuido") return "sem_comercial";
    if (key === "ines" || key === "ins") return "ines";
    if (key === "flavia" || key === "flvia") return "flavia";
    if (["bruno", "miriam", "setil"].includes(key)) return key;
    return key;
}

function leadCommercialKey(lead) {
    return lead.comercial_key || commercialKey(lead.comercial_responsavel);
}

function leadCommercialLabel(lead) {
    return leadCommercialKey(lead) === "sem_comercial" ? "Sem comercial" : (lead.comercial_responsavel || "Sem comercial");
}

function leadScore(lead) {
    return Number(lead.score ?? 0);
}

function scoreBand(lead) {
    return lead.heat_band || (leadScore(lead) >= 70 ? "hot" : leadScore(lead) >= 40 ? "warm" : "cold");
}

function scoreLabel(lead) {
    return `${leadScore(lead)}/100`;
}

function priorityLabel(lead) {
    return lead.heat_label || (scoreBand(lead) === "hot" ? "🔥 quente" : scoreBand(lead) === "warm" ? "🟡 morna" : "⚪ fria");
}

function commercialSuggestion(lead) {
    if (!lead || leadCommercialKey(lead) !== "sem_comercial" || !hasCoordinates(lead)) return null;
    const counts = new Map();
    allLeads.forEach((item) => {
        const key = leadCommercialKey(item);
        if (item.id === lead.id || key === "sem_comercial" || !hasCoordinates(item)) return;
        if (haversineKm(lead, item) <= 8) counts.set(key, (counts.get(key) || 0) + 1);
    });
    const best = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (!best || best[1] < 2) return null;
    const labels = { ines: "Inês", bruno: "Bruno", flavia: "Flávia", miriam: "Miriam", setil: "Setil" };
    return { key: best[0], label: labels[best[0]] || best[0], count: best[1] };
}

function hasCoordinates(lead) {
    if (!lead || lead.latitude === null || lead.latitude === undefined || lead.longitude === null || lead.longitude === undefined) {
        return false;
    }
    const lat = Number(lead.latitude);
    const lng = Number(lead.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng);
}

function leadName(lead) {
    if (!lead || typeof lead !== "object") return "Lead sem nome";
    const fields = [
        lead.nome,
        lead.name,
        lead.empresa,
        lead.company,
        lead.cliente,
        lead.designacao,
        lead.lead_nome,
        lead.nome_empresa,
        lead.nome_cliente,
    ];
    for (const value of fields) {
        const text = String(value ?? "").trim();
        if (text) return text;
    }
    return "Lead sem nome";
}

function isValidLeadId(lead) {
    return lead && Number.isFinite(lead.id) && lead.id > 0;
}

function leadCompany(lead) {
    return (
        lead?.empresa ||
        lead?.nome_empresa ||
        lead?.area_negocio ||
        "Sem empresa"
    );
}

function leadCityFallback(lead) {
    return lead?.cidade || lead?.localidade || "Sem cidade";
}

function leadStateFallback(lead) {
    // Regra do projeto: fallback do estado para "Por contactar"
    // (a regra original dizia: lead.estado -> Por contactar)
    return lead?.estado || "Por contactar";
}

function safeLeadForCluster(lead) {
    if (!lead || typeof lead !== "object") return null;
    if (!isValidLeadId(lead)) {
        return null;
    }
    return lead;
}


function leadArea(lead) {
    return lead.area_negocio || lead.tipo_cliente || "Outro";
}

function leadCity(lead) {
    return leadCityFallback(lead);
}


function slug(value) {
    return normalize(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "default";
}

function statusClass(status) {
    return `status-badge status-badge--${slug(status)}`;
}

function parseDate(value) {
    if (!value) return null;
    const date = new Date(String(value).replace(" ", "T"));
    return Number.isNaN(date.getTime()) ? null : date;
}

function lastContactInfo(lead) {
    const contactActions = ["Contactado", "Reunião marcada", "Adiar contacto", "Sem interesse definitivo", "Cliente existente", "Estado corrigido manualmente"];
    const dates = (lead.historico || [])
        .filter((item) => contactActions.some((action) => normalize(item.acao).includes(normalize(action))))
        .map((item) => parseDate(item.created_at))
        .filter(Boolean)
        .sort((a, b) => b - a);
    const latest = dates[0];
    if (!latest) return null;
    const days = Math.floor((Date.now() - latest.getTime()) / 86400000);
    if (days <= 0) return { days, label: "Contactada hoje", avoid: true };
    if (days <= 2) return { days, label: `Contactada há ${days} dias`, avoid: true };
    if (days <= 7) return { days, label: "Evitar novo contacto", avoid: true };
    return { days, label: `Último contacto há ${days} dias`, avoid: false };
}

function isForgotten(lead) {
    if (!isActive(lead)) return false;
    const info = lastContactInfo(lead);
    if (!info) return true;
    return info.days >= 30;
}

function isActive(lead) {
    return lead.ativa === true;
}

function excludedFromDayContact(lead) {
    return STATES_EXCLUDED_DAY_CONTACT.includes(lead.estado);
}

function eligibleForDayContactPlan(lead) {
    return lead && hasCoordinates(lead) && !excludedFromDayContact(lead);
}

function leadInsights(lead) {
    return lead?.insight_tags || [];
}

function hasInsights(lead) {
    return leadInsights(lead).length > 0 || Boolean(lead?.insight_note);
}

function insightSummary(lead) {
    const tags = leadInsights(lead).slice(0, 3).join(", ");
    const note = lead?.insight_note || "";
    return [tags, note].filter(Boolean).join(" · ");
}

function setDrawerOpen(open) {
    if (els.leadDrawer) {
        els.leadDrawer.classList.toggle("open", open);
        els.leadDrawer.classList.toggle("drawer-open", open);
        els.leadDrawer.setAttribute("aria-hidden", String(!open));
    }
    document.body.classList.toggle("map-drawer-open", open);
    if (open) requestAnimationFrame(() => els.drawerClose?.focus({ preventScroll: true }));
}

async function loadLeadSummary(leadId) {
    if (!leadId) return;
    const normalizedLeadId = Number(leadId);
    if (leadSummaryController) leadSummaryController.abort();
    leadSummaryController = new AbortController();
    try {
        const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}/resumo`, { signal: leadSummaryController.signal });
        if (!response.ok) return;
        const summary = await response.json();
        if (!selectedLead || Number(selectedLead.id) !== normalizedLeadId) return;
        selectedLead = { ...selectedLead, ...summary };
        leadsById.set(normalizedLeadId, selectedLead);
        allLeads = allLeads.map((lead) => (Number(lead.id) === normalizedLeadId ? selectedLead : lead));
        visibleLeads = visibleLeads.map((lead) => (Number(lead.id) === normalizedLeadId ? selectedLead : lead));
        renderDetails();
        renderMapMiniCard();
        markers.get(normalizedLeadId)?.setPopupContent(popupHtml(selectedLead));
    } catch (error) {
        if (error.name !== "AbortError") console.warn("Resumo da lead indisponível", error);
    }
}

function markerIcon(lead) {
    const classes = ["marker-pin", markerVisualClass(lead), `marker-pin--heat-${scoreBand(lead)}`];
    const isNearby = nearbyLeadIds.has(lead.id);
    if (!isActive(lead)) classes.push("inactive");
    if (selectedLead && lead.id === selectedLead.id) classes.push("selected");
    if (hoveredLeadId === lead.id) classes.push("hovered");
    else if (isNearby) classes.push("nearby");
    if (selectedLead && lead.id !== selectedLead.id && !isNearby) classes.push("out-of-focus");
    return L.divIcon({
        className: "",
        html: `<span class="${classes.join(" ")}" ${hasInsights(lead) ? `title="${insightSummary(lead)}"` : ""}><span class="marker-pin__core"></span>${hasInsights(lead) ? '<span class="marker-pin__insight">i</span>' : ""}</span>`,
        iconSize: [34, 42],
        iconAnchor: [17, 38],
        popupAnchor: [0, -34],
    });
}

function leadScheduleDate(lead) {
    return parseDate(lead.data_novo_contacto);
}

function isScheduledLead(lead) {
    if (!leadScheduleDate(lead)) return false;
    const state = normalizeKey(lead.estado);
    const text = normalizeSearch([
        lead.estado,
        lead.classificacao_observacao,
        lead.observacoes,
        lead.observacoes_contacto,
        lead.motivo_classificacao,
    ].join(" "));
    return (
        ["ligardevolta", "adiarcontacto", "seminteresse"].includes(state) ||
        ["voltar a ligar", "contactar mais tarde", "reagendada", "reagendar", "sem interesse para ja", "aguardar resposta", "ligar depois"].some((token) => text.includes(token))
    );
}

function isOverdueLead(lead) {
    const scheduleDate = leadScheduleDate(lead);
    if (!scheduleDate || !isScheduledLead(lead)) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    scheduleDate.setHours(0, 0, 0, 0);
    return scheduleDate < today;
}

function isFutureScheduledLead(lead) {
    const scheduleDate = leadScheduleDate(lead);
    if (!scheduleDate || !isScheduledLead(lead)) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    scheduleDate.setHours(0, 0, 0, 0);
    return scheduleDate > today;
}

function markerVisualClass(lead) {
    const state = normalizeKey(lead.estado);
    const recency = lastContactInfo(lead);
    if (state.includes("reuniao") || state.includes("crm") || state.includes("clienteexistente")) return "marker-pin--meeting";
    if (state.includes("ligardevolta") || state.includes("contactado") || normalizeSearch(lead.observacoes_contacto).includes("nao atendeu")) return "marker-pin--unanswered";
    if (recency?.avoid) return "marker-pin--forgotten";
    if (!isActive(lead)) return "marker-pin--inactive";
    return "marker-pin--active";
}

function popupHtml(lead) {
    const timelinePreview = renderTimelinePreview(lead, { limit: 3, compact: true });
    return `
        <div class="lead-popup">
            <div class="lead-popup__header">
                <strong>${leadName(lead)}</strong>
                <span class="priority-badge priority-badge--${scoreBand(lead)}">${priorityLabel(lead)} · ${scoreLabel(lead)}</span>
            </div>
            <span>${leadArea(lead)}</span>
            <span>${lead.telefone || "—"}</span>
            <span>${leadCity(lead)}</span>
            ${hasInsights(lead) ? `<span class="lead-popup__insight" title="${insightSummary(lead)}">Insights internos</span>` : ""}
            <small>${leadCommercialLabel(lead)} · ${lead.estado}</small>
            ${timelinePreview}
        </div>
    `;
}

function passesFilters(lead) {
    if (!els.scheduleFilter?.value && !passesClassificationFilter(lead)) return false;

    const rawSearch = els.searchInput?.value;
    const text = normalize(rawSearch);

    const searchable = normalizeSearch([
        lead.nome_cliente,
        lead.nome_empresa,
        lead.telefone,
        lead.cidade,
        lead.localidade,
        lead.tipo_cliente,
        lead.area_negocio,
        lead.comercial_responsavel,
    ].join(" "));


    const selectedCommercial = els.commercialFilter?.value || "";

    return (
        (!text || searchable.includes(text)) &&
        (!els.localityFilter?.value || leadCity(lead) === els.localityFilter.value) &&
        (!els.typeFilter?.value || leadArea(lead) === els.typeFilter.value) &&
        (!selectedCommercial || leadCommercialKey(lead) === selectedCommercial) &&
        (!els.stateFilter?.value || lead.estado === els.stateFilter.value) &&
        (!els.heatFilter?.value || scoreBand(lead) === els.heatFilter.value) &&
        passesScheduleFilter(lead) &&
        (!els.tagFilter?.value || (lead.tags || []).includes(els.tagFilter.value)) &&
        (!els.insightFilter?.value || leadInsights(lead).includes(els.insightFilter.value))
    );
}

function passesScheduleFilter(lead) {
    const value = els.scheduleFilter?.value || "";
    if (!value) return true;
    if (value === "now") return isActive(lead) && !isFutureScheduledLead(lead);
    if (value === "scheduled") return isScheduledLead(lead);
    if (value === "overdue") return isOverdueLead(lead);
    return true;
}

function passesClassificationFilter(lead) {
    const value = els.classificationFilter.value || "ativos";
    if (value === "ativos") {
        if (els.historyFilter.checked) {
            return !["Sem interesse", "Sem interesse definitivo"].includes(lead.estado);
        }
        return isActive(lead);
    }
    if (value === "por_contactar") return lead.estado === "Por contactar";
    if (value === "ligar_volta") return lead.estado === "Ligar de volta";
    if (value === "adiados") return lead.estado === "Adiar contacto";
    if (value === "com_observacoes") return Boolean(lead.observacoes || lead.observacoes_contacto);
    if (value === "contactados") return lead.estado === "Ligar de volta";
    if (value === "reuniao" || value === "crm") return ["Já tratado / no CRM", "Reunião marcada", "Cliente existente"].includes(lead.estado);
    if (value === "sem_interesse") return ["Sem interesse", "Sem interesse definitivo"].includes(lead.estado);
    return true;
}

function debounce(fn, delay = 200) {
    let timer = null;
    return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), delay);
    };
}

function currentBoundsParams() {
    const bounds = map.getBounds();
    if (!bounds?.isValid?.()) return {};
    return {
        north: bounds.getNorth().toFixed(6),
        south: bounds.getSouth().toFixed(6),
        east: bounds.getEast().toFixed(6),
        west: bounds.getWest().toFixed(6),
    };
}

function currentMarkersKey() {
    return visibleLeads
        .filter(hasCoordinates)
        .map((lead) => `${lead.id}:${lead.latitude}:${lead.longitude}`)
        .join("|");
}

function applyFilters() {
    visibleLeads = allLeads.filter(passesFilters);
    visibleLeadIds = new Set(visibleLeads.map((lead) => lead.id));
    if (selectedLead && !visibleLeadIds.has(selectedLead.id)) {
        selectLead(null);
        return;
    }
    updateNearby();
    renderMarkers();
    renderHeatmap();
    renderTerritories();
    renderLeadList();
    renderDetails();
    renderMetrics();
    renderMapGeoStats();
    renderMapMiniCard();
}

function renderMetrics() {
    const metrics = visibleLeads.reduce((acc, lead) => {
        if (isActive(lead)) acc.active += 1;
        if (normalizeKey(lead.estado) === "jatratadonocrm") acc.crm += 1;
        if (lead.estado === "Adiar contacto" && lead.data_novo_contacto) {
            const date = parseDate(lead.data_novo_contacto);
            if (date && date > new Date()) acc.postponed += 1;
        }
        return acc;
    }, { active: 0, crm: 0, postponed: 0 });
    if (els.metricTotal) els.metricTotal.textContent = visibleLeads.length;
    if (els.metricActive) els.metricActive.textContent = metrics.active;
    if (els.metricCrm) els.metricCrm.textContent = metrics.crm;
    if (els.metricPostponed) els.metricPostponed.textContent = metrics.postponed;
}

function renderMarkers({ force = false } = {}) {
    const nextKey = currentMarkersKey();
    if (!force && nextKey === markersRenderKey && markers.size > 0) {
        refreshMarkerState();
        return;
    }
    markersRenderKey = nextKey;
    markers.forEach((marker) => marker.remove());
    markers = new Map();
    if (clusterLayer) {
        clusterLayer.remove();
        clusterLayer = null;
    }
    const leadsWithCoordinates = visibleLeads.filter(hasCoordinates);
    const useClusters = window.L && L.markerClusterGroup && leadsWithCoordinates.length > 25;
    clusterLayer = useClusters ? L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: false,
        spiderfyOnMaxZoom: false,
        animate: false,
        animateAddingMarkers: false,
        chunkedLoading: true,
        chunkInterval: 80,
        chunkDelay: 30,
        maxClusterRadius: 46,
        iconCreateFunction: (cluster) => L.divIcon({
            html: `<span>${cluster.getChildCount()}</span>`,
            className: "alltera-cluster",
            iconSize: [34, 34],
        }),
    }).addTo(map) : null;
    if (clusterLayer) {
        clusterLayer.on("clusterclick", (event) => openClusterPopup(event.layer));
        clusterLayer.on("clusterdblclick", (event) => expandClusterArea(event.layer));
    }
    leadsWithCoordinates.forEach((lead) => {
        const zIndex =
            selectedLead && lead.id === selectedLead.id ? 900 : nearbyLeadIds.has(lead.id) ? 500 : 0;
        const marker = L.marker([lead.latitude, lead.longitude], { icon: markerIcon(lead), zIndexOffset: zIndex, lead });
        marker.on("click", () => {
            marker.bindPopup(popupHtml(lead), { maxWidth: 260 }).openPopup();
            openLeadDrawer(lead.id);
        });
        if (clusterLayer) clusterLayer.addLayer(marker);
        else marker.addTo(map);
        markers.set(lead.id, marker);
    });
    if (markers.size > 0 && !mapInitialFitDone && !(selectedLead && hasCoordinates(selectedLead))) {
        const group = L.featureGroup(Array.from(markers.values()));
        map.fitBounds(group.getBounds().pad(0.12), { maxZoom: 12 });
        mapInitialFitDone = true;
    }
}

function refreshMarkerState() {
    markers.forEach((marker, id) => {
        const lead = leadsById.get(id);
        if (!lead) return;
        const nearby = nearbyLeadIds.has(id);
        marker.setIcon(markerIcon(lead));
        marker.setZIndexOffset(selectedLead?.id === id ? 900 : nearby ? 500 : 0);
    });
}

function loadHeatmapScript() {
    if (L.heatLayer) return Promise.resolve();
    if (heatmapScriptPromise) return heatmapScriptPromise;
    heatmapScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet.heat/dist/leaflet-heat.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return heatmapScriptPromise;
}

async function renderHeatmap() {
    if (heatLayer) {
        heatLayer.remove();
        heatLayer = null;
    }
    if (!els.heatmapToggle.checked) return;
    try {
        await loadHeatmapScript();
    } catch {
        if (els.heatmapToggle) els.heatmapToggle.checked = false;
        return;
    }
    if (!els.heatmapToggle.checked) return;
    const points = visibleLeads
        .filter((lead) => isActive(lead) && hasCoordinates(lead))
        .map((lead) => [lead.latitude, lead.longitude, Math.max(0.25, leadScore(lead) / 100)]);
    heatLayer = L.heatLayer(points, {
        radius: 34,
        blur: 22,
        maxZoom: 13,
        minOpacity: 0.24,
        gradient: { 0.25: "#7dd3fc", 0.5: "#0f766e", 0.75: "#c47a2c", 1: "#b42318" },
    }).addTo(map);
}

function visibleInCurrentBounds() {
    const bounds = map.getBounds();
    return visibleLeads.filter((lead) => hasCoordinates(lead) && bounds.contains([lead.latitude, lead.longitude]));
}

function renderMapGeoStats() {
    // Removido: overlay de métricas no topo do mapa (Visíveis/Na zona/Reuniões/CRM/Follow-ups)
    if (!els.mapGeoStats) return;
    els.mapGeoStats.hidden = true;
    els.mapGeoStats.innerHTML = "";
}


function renderTerritories() {
    if (territoryLayer) {
        territoryLayer.remove();
        territoryLayer = null;
    }
    const mode = els.territoryMode?.value || "";
    if (!mode) return;
    const groups = new Map();
    visibleLeads.filter(hasCoordinates).forEach((lead) => {
        const key = mode === "cidade" ? leadCity(lead) : mode === "comercial" ? leadCommercialLabel(lead) : lead.estado;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(lead);
    });
    territoryLayer = L.layerGroup().addTo(map);
    Array.from(groups.entries()).forEach(([label, leads], index) => {
        const lat = leads.reduce((sum, lead) => sum + lead.latitude, 0) / leads.length;
        const lng = leads.reduce((sum, lead) => sum + lead.longitude, 0) / leads.length;
        const radius = Math.min(26000, Math.max(2500, Math.sqrt(leads.length) * 3300));
        const colors = ["#0f766e", "#2563eb", "#c47a2c", "#7c3aed", "#0891b2", "#b42318"];
        const color = colors[index % colors.length];
        L.circle([lat, lng], {
            radius,
            color,
            weight: 1.5,
            opacity: 0.34,
            fillColor: color,
            fillOpacity: 0.075,
            className: "territory-zone",
        }).bindTooltip(`<strong>${label}</strong><span>${leads.length} leads</span>`, {
            permanent: leads.length >= 6,
            direction: "center",
            className: "territory-label",
        }).addTo(territoryLayer);
    });
}

function renderLeadList() {
    const sourceLeads = leadListMode === "all" ? allLeads : visibleLeads;
    const renderedLeads = sourceLeads.slice(0, LEAD_LIST_RENDER_LIMIT);
    els.listCount.textContent = sourceLeads.length > renderedLeads.length ? `${renderedLeads.length}/${sourceLeads.length}` : sourceLeads.length;
    els.leadsList.innerHTML = renderedLeads.map((lead) => `
        <article class="lead-row lead-row--compact ${selectedLead?.id === lead.id ? "active" : ""} ${!isActive(lead) ? "inactive-row" : ""}" data-id="${lead.id}">
            <div class="row-top">
                <label class="bulk-check"><input type="checkbox" data-bulk-id="${lead.id}" ${selectedBulkIds.has(lead.id) ? "checked" : ""}></label>
                <strong>${leadName(lead)}</strong>
                <span class="tag ${statusClass(lead.estado)}">${lead.estado}</span>
            </div>
            <div class="row-top row-top--secondary">
                <span class="priority-badge priority-badge--${scoreBand(lead)}">${priorityLabel(lead)} · ${scoreLabel(lead)}</span>
                <span class="muted">${leadCommercialLabel(lead)}</span>
            </div>
            ${lastContactInfo(lead) ? `<span class="contact-recency ${lastContactInfo(lead).avoid ? "contact-recency--avoid" : ""}">${lastContactInfo(lead).label}</span>` : ""}
            <span class="muted">${leadArea(lead)} · ${lead.telefone || "—"} · ${leadCity(lead)}${hasCoordinates(lead) ? "" : " · sem coordenadas"}</span>
        </article>
    `).join("") + (sourceLeads.length > renderedLeads.length ? `<p class="lead-list-truncated">A mostrar ${renderedLeads.length} de ${sourceLeads.length} leads. Usa a pesquisa ou filtros para refinar.</p>` : "");
    renderBulkActions();
}

function updateLeadListSelection() {
    if (!els.leadsList) return;
    els.leadsList.querySelectorAll(".lead-row.active").forEach((row) => row.classList.remove("active"));
    if (!selectedLead) return;
    els.leadsList.querySelector(`.lead-row[data-id="${selectedLead.id}"]`)?.classList.add("active");
}

function setLeadListMode(mode) {
    leadListMode = mode === "all" ? "all" : "visible";
    if (els.leadListTabVisible) {
        const isVisible = leadListMode === "visible";
        els.leadListTabVisible.classList.toggle("is-active", isVisible);
        els.leadListTabVisible.setAttribute("aria-selected", String(isVisible));
    }
    if (els.leadListTabAll) {
        const isAll = leadListMode === "all";
        els.leadListTabAll.classList.toggle("is-active", isAll);
        els.leadListTabAll.setAttribute("aria-selected", String(isAll));
    }
    renderLeadList();
}

function renderBulkActions() {
    const count = selectedBulkIds.size;
    if (els.mapBulkActions) els.mapBulkActions.hidden = count === 0;
    if (els.bulkSelectedCount) els.bulkSelectedCount.textContent = count;
    renderRouteDayList();
}

function routeDaySelection() {
    return allLeads.filter((lead) => selectedBulkIds.has(lead.id) && hasCoordinates(lead));
}

function renderRouteDayList() {
    const selected = routeDaySelection();
    if (els.routeSelectedCount) els.routeSelectedCount.textContent = selected.length;
    if (els.drawRouteDay) els.drawRouteDay.disabled = selected.length < 2;
    if (els.openRouteMaps) els.openRouteMaps.disabled = currentRouteDay.length < 2;
    if (els.clearRouteDay) els.clearRouteDay.disabled = selected.length === 0 && currentRouteDay.length === 0;
    if (!els.routeDayList) return;
    const rows = (currentRouteDay.length ? currentRouteDay : selected);
    if (!rows.length) {
        els.routeDayList.classList.add("empty-state");
        els.routeDayList.innerHTML = "Seleciona leads proximas ou usa a lista da zona.";
        return;
    }
    els.routeDayList.classList.remove("empty-state");
    let total = 0;
    els.routeDayList.innerHTML = rows.map((lead, index) => {
        const leg = index === 0 ? 0 : haversineKm(rows[index - 1], lead);
        total += leg;
        return `
            <article class="route-day-row">
                <span>${index + 1}</span>
                <div><strong>${leadName(lead)}</strong><small>${leadCity(lead)} · ${leg.toFixed(1)} km</small></div>
                <button type="button" class="link-button route-remove" data-route-remove="${lead.id}">Remover</button>
            </article>
        `;
    }).join("") + `<div class="route-day-total"><strong>${total.toFixed(1)} km aprox.</strong></div>`;
    els.routeDayList.querySelectorAll("[data-route-remove]").forEach((button) => {
        button.addEventListener("click", () => {
            selectedBulkIds.delete(Number(button.dataset.routeRemove));
            currentRouteDay = currentRouteDay.filter((lead) => lead.id !== Number(button.dataset.routeRemove));
            clearSmartRoute();
            renderLeadList();
            renderRouteDayList();
        });
    });
}

function selectLead(id) {
    if (id == null || id === undefined) {
        selectedLead = null;
        currentPlanRows = [];
        els.exportPlan.disabled = true;
        nearbyLeads = [];
        nearbyLeadIds = new Set();
        if (leadSummaryController) leadSummaryController.abort();
        setDrawerOpen(false);
        drawRadius();
        refreshMarkerState();
        updateLeadListSelection();
        renderDetails();
        renderMapMiniCard();
        renderNearbyList();
        requestAnimationFrame(() => {
            map.invalidateSize();
            map.getContainer().focus({ preventScroll: true });
        });
        return;
    }
    selectedLead = leadsById.get(id) || null;
    currentPlanRows = [];
    els.exportPlan.disabled = true;
    setDrawerOpen(Boolean(selectedLead));
    updateNearby();
    refreshMarkerState();
    updateLeadListSelection();
    renderDetails();
    renderMapMiniCard();
    renderNearbyList();
    if (selectedLead) loadLeadSummary(selectedLead.id);
    if (selectedLead && hasCoordinates(selectedLead)) {
        const marker = markers.get(selectedLead.id);
        const markerLatLng = marker?.getLatLng?.();
        const target = markerLatLng ? [markerLatLng.lat, markerLatLng.lng] : [selectedLead.latitude, selectedLead.longitude];
        if (map.getZoom() < 10) {
            map.flyTo(target, 10, { animate: true, duration: 0.28, easeLinearity: 0.3 });
        } else {
            map.panTo(target, { animate: true, duration: 0.18, easeLinearity: 0.3 });
        }
        scrollLeadIntoView(selectedLead.id);
    }
    requestAnimationFrame(() => map.invalidateSize());
}

function openLeadDrawer(leadId) {
    selectLead(leadId);
}

window.openLeadDrawer = openLeadDrawer;

function consumeInitialFocus() {
    if (hasConsumedInitialFocus) return;
    hasConsumedInitialFocus = true;
    try {
        sessionStorage.removeItem("alltera.focusLead");
        sessionStorage.removeItem("alltera.selectedLead");
        sessionStorage.removeItem("alltera.openLead");
        localStorage.removeItem("alltera.focusLead");
        localStorage.removeItem("alltera.selectedLead");
        localStorage.removeItem("alltera.openLead");
    } catch {
        // Storage can be unavailable in restrictive browser modes.
    }
    const url = new URL(window.location.href);
    ["lead_id", "focusLead", "selectedLead", "openLead", "highlightLead", "lat", "lng"].forEach((key) => {
        url.searchParams.delete(key);
    });
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function clusterLeadFromMarker(marker) {
    if (marker?.lead && typeof marker.lead === "object") return marker.lead;
    if (marker?.options?.lead && typeof marker.options.lead === "object") return marker.options.lead;
    for (const [id, item] of markers.entries()) {
        if (item === marker) return leadsById.get(id);
    }
    return null;
}


function clusterPopupHtml(cluster) {
    const allChildMarkers = cluster.getAllChildMarkers();
    const total = cluster.getChildCount();

    const validLeads = allChildMarkers
        .map(clusterLeadFromMarker)
        .map((lead) => safeLeadForCluster(lead))
        .filter(Boolean)
        .map((lead) => ({
            id: lead.id || "",
            nome: leadName(lead),
        }));

    const visibleRows = validLeads.slice(0, 80);
    const rows = visibleRows
        .map(
            (lead) => `
        <button
            class="cluster-lead-item"
            type="button"
            data-cluster-lead-id="${lead.id}"
        >
            <strong>${lead.nome}</strong>
        </button>
    `
        )
        .join("");
    const remaining = Math.max(0, total - validLeads.length);

    return `
        <section class="cluster-popup">
            <header>
                <strong>${total} leads nesta zona</strong>
                ${remaining ? `<span>+${remaining} neste cluster</span>` : ""}
            </header>

            <div class="cluster-leads-list">
                ${rows}
            </div>

            <footer class="cluster-popup__footer">
                <button class="cluster-expand-button" type="button" data-cluster-expand>Ver zona no mapa</button>
            </footer>
        </section>
    `;
}





function tooltipHtml(lead) {
    const info = lastContactInfo(lead);
    return `
        <div class="lead-hover-preview">
            <strong>${leadName(lead)}</strong>
            <span>${leadCity(lead)} · ${lead.estado}</span>
            <small>${info ? info.label : "Sem interação recente"}</small>
        </div>
    `;
}

function openClusterPopup(cluster) {
    const popup = L.popup({
        closeButton: false,
        closeOnClick: true,
        autoClose: true,
        autoPan: true,
        autoPanPadding: [26, 26],
        className: "cluster-leads-popup",
        maxWidth: 340,
    })
        .setLatLng(cluster.getLatLng())
        .setContent(clusterPopupHtml(cluster))
        .openOn(map);

    requestAnimationFrame(() => {
        const container = popup.getElement();
        container?.querySelectorAll("[data-cluster-lead-id]").forEach((button) => {
            button.addEventListener("click", () => openLeadDrawer(Number(button.dataset.clusterLeadId)));
        });
        container?.querySelector("[data-cluster-expand]")?.addEventListener("click", () => expandClusterArea(cluster));
    });
}

function expandClusterArea(cluster) {
    const bounds = cluster.getBounds();
    if (!bounds || !bounds.isValid()) return;
    map.closePopup();
    map.flyToBounds(bounds.pad(0.22), {
        maxZoom: Math.min(map.getZoom() + 2, 15),
        duration: 0.3,
        easeLinearity: 0.25,
    });
}

function setLeadHover(id, active) {
    if (!id) return;
    hoveredLeadId = active ? id : hoveredLeadId === id ? null : hoveredLeadId;
    const row = document.querySelector(`.lead-row[data-id="${id}"]`);
    if (row) row.classList.toggle("is-map-hovered", active);
    const marker = markers.get(id);
    const element = marker?.getElement?.();
    const pin = element?.querySelector?.(".marker-pin");
    if (pin) pin.classList.toggle("hovered", active);
    if (marker) {
        const nearby = nearbyLeadIds.has(id);
        marker.setZIndexOffset(active ? 850 : selectedLead?.id === id ? 900 : nearby ? 500 : 0);
    }
}

function scrollLeadIntoView(id) {
    const row = document.querySelector(`.lead-row[data-id="${id}"]`);
    if (row) row.scrollIntoView({ block: "nearest", behavior: "auto" });
}

function updateNearby() {
    if (!selectedLead || !hasCoordinates(selectedLead)) {
        nearbyLeads = [];
        nearbyLeadIds = new Set();
        drawRadius();
        renderNearbyList();
        return;
    }
    nearbyLeads = visibleLeads
        .filter(
            (lead) =>
                lead.id !== selectedLead.id &&
                hasCoordinates(lead) &&
                isActive(lead) &&
                !excludedFromDayContact(lead)
        )
        .map((lead) => ({ ...lead, distanceKm: haversineKm(selectedLead, lead) }))
        .filter((lead) => lead.distanceKm <= nearbyRadiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    nearbyLeadIds = new Set(nearbyLeads.map((lead) => lead.id));
    drawRadius();
    renderNearbyList();
}

function drawRadius() {
    if (radiusCircle) radiusCircle.remove();
    radiusCircle = null;
    if (!selectedLead || !hasCoordinates(selectedLead)) return;
    radiusCircle = L.circle([selectedLead.latitude, selectedLead.longitude], {
        radius: nearbyRadiusKm * 1000,
        color: "#0f766e",
        weight: 2,
        fillColor: "#0f766e",
        fillOpacity: 0.075,
        className: "operational-radius-circle",
    }).addTo(map);
}

function renderDetails() {
    document.querySelectorAll("[data-action]").forEach((button) => {
        button.disabled = !selectedLead;
    });
    if (els.generatePlan) els.generatePlan.disabled = !selectedLead || !isActive(selectedLead) || !hasCoordinates(selectedLead);
    if (els.dayContactPlan) els.dayContactPlan.disabled = !selectedLead || !hasCoordinates(selectedLead);
    if (els.focusSelectedLead) els.focusSelectedLead.disabled = !selectedLead || !hasCoordinates(selectedLead);

    if (!selectedLead) {
        els.selectedState.textContent = "—";
        els.selectedState.className = "tag tag--estado";
        if (els.leadDrawerTitle) els.leadDrawerTitle.textContent = "Lead selecionada";
        const accEmpty = document.getElementById("actionsAccordion");
        if (accEmpty) accEmpty.open = false;
        els.leadDetails.innerHTML = `
            <section class="empty-lead-state">
                <div class="empty-lead-state__icon" aria-hidden="true"></div>
                <strong>Seleciona uma lead no mapa para ver contactos próximos.</strong>
                <p>Usa o raio operacional para encontrar leads na mesma zona.</p>
            </section>
        `;
        els.leadDetails.classList.add("empty-state");
        els.leadHistory.innerHTML = `<p class="lead-drawer-timeline-empty">Sem histórico.</p>`;
        els.tagList.innerHTML = "—";
        els.addTag.disabled = true;
        if (els.leadNoteInput) els.leadNoteInput.value = "";
        if (els.addLeadNote) els.addLeadNote.disabled = true;
        if (els.openFullLead) {
            els.openFullLead.href = "#";
            els.openFullLead.setAttribute("aria-disabled", "true");
        }
        if (els.editLeadLink) {
            els.editLeadLink.href = "#";
            els.editLeadLink.setAttribute("aria-disabled", "true");
        }
        return;
    }
    els.leadDetails.classList.remove("empty-state");
    els.addTag.disabled = false;
    if (els.addLeadNote) els.addLeadNote.disabled = false;
    if (els.openFullLead) {
        els.openFullLead.href = `/mapa?lead_id=${selectedLead.id}&history=1`;
        els.openFullLead.setAttribute("aria-disabled", "false");
    }
    if (els.editLeadLink) {
        els.editLeadLink.href = leadEditUrl(selectedLead);
        els.editLeadLink.setAttribute("aria-disabled", "false");
    }
    const acc = document.getElementById("actionsAccordion");
    if (acc) acc.open = Boolean(selectedLead);
    els.selectedState.textContent = selectedLead.estado;
    els.selectedState.className = `tag tag--estado ${statusClass(selectedLead.estado)}`;
    const suggestion = commercialSuggestion(selectedLead);
    const phone = selectedLead.telefone || selectedLead.contacto || "";
    const company = selectedLead.empresa || selectedLead.nome_empresa || "";
    const address = selectedLead.morada || "";
    const postalCode = selectedLead.codigo_postal || "";
    if (els.leadDrawerTitle) els.leadDrawerTitle.textContent = leadName(selectedLead);
    els.leadDetails.innerHTML = `
        <section class="lead-drawer-block">
            <div class="lead-drawer-block__head">
                <h4>Resumo</h4>
                <span class="priority-badge priority-badge--${scoreBand(selectedLead)}">${priorityLabel(selectedLead)} &middot; ${scoreLabel(selectedLead)}</span>
            </div>
            <dl class="lead-details-dl lead-details-dl--grid">
                ${detailLine("Nome cliente", leadName(selectedLead))}
                ${detailLine("Empresa", company)}
                ${detailLine("&Aacute;rea de neg&oacute;cio", leadArea(selectedLead))}
                ${detailLine("Cidade", leadCity(selectedLead))}
                ${detailLine("Telefone", phone)}
                ${detailLine("Email", selectedLead.email)}
                ${detailLine("Comercial", leadCommercialLabel(selectedLead))}
            </dl>
            ${lastContactInfo(selectedLead) ? `<span class="contact-recency ${lastContactInfo(selectedLead).avoid ? "contact-recency--avoid" : ""}">${lastContactInfo(selectedLead).label}</span>` : ""}
        </section>
        <section class="lead-drawer-block">
            <h4>Localiza&ccedil;&atilde;o</h4>
            <dl class="lead-details-dl lead-details-dl--grid">
                ${detailLine("Morada", address)}
                ${detailLine("C&oacute;digo postal", postalCode)}
            </dl>
        </section>
        ${observationBlock("Observa&ccedil;&otilde;es", selectedLead.observacoes, "Sem observa&ccedil;&otilde;es")}
        ${observationBlock("Observa&ccedil;&otilde;es do contacto", selectedLead.observacoes_contacto, "Sem observa&ccedil;&otilde;es de contacto")}
        ${renderOperationalSignals(selectedLead)}
        ${suggestion ? `<section class="commercial-suggestion">
            <strong>Esta lead está próxima de várias leads da ${suggestion.label}.</strong>
            <button class="button secondary" id="assignSuggestedCommercial" type="button">Atribuir à ${suggestion.label}</button>
        </section>` : ""}
    `;
    if (suggestion) {
        document.getElementById("assignSuggestedCommercial")?.addEventListener("click", () => {
            bulkAction("assign_commercial", { ids: [selectedLead.id], comercial: suggestion.key });
        });
    }
    const timeline = leadTimelineItems(selectedLead);
    els.leadHistory.innerHTML = timeline.length
        ? timeline.map(renderTimelineItem).join("")
        : `<p class="lead-drawer-timeline-empty">Sem histórico.</p>`;
    els.tagList.innerHTML = selectedLead.tags?.length
        ? selectedLead.tags.map((tag) => `<span class="tag removable-tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)} &times;</span>`).join("")
        : "Sem tags.";
    document.querySelectorAll(".removable-tag").forEach((tag) => {
        tag.addEventListener("click", () => tagAction("remove_tag", tag.dataset.tag));
    });
    document.querySelectorAll("[data-insight-tag]").forEach((button) => {
        button.addEventListener("click", () => button.classList.toggle("is-active"));
    });
    document.getElementById("saveInternalInsights")?.addEventListener("click", saveInternalInsights);
}

function renderMapMiniCard() {
    if (!els.mapLeadMiniCard) return;
    if (!selectedLead) {
        els.mapLeadMiniCard.hidden = true;
        els.mapLeadMiniCard.innerHTML = "";
        return;
    }
    els.mapLeadMiniCard.hidden = false;
    const timelinePreview = renderTimelinePreview(selectedLead, { limit: 3, compact: true });
    els.mapLeadMiniCard.innerHTML = `
        <div class="map-mini-card__header">
            <div>
                <strong>${leadName(selectedLead)}</strong>
                <span>${leadCity(selectedLead)} · ${selectedLead.estado}</span>
            </div>
            <button type="button" class="map-mini-card__close" aria-label="Fechar">×</button>
        </div>
        ${timelinePreview}
        <div class="map-mini-card__actions">
            <a class="link-button" href="${selectedLead.telefone ? `tel:${selectedLead.telefone}` : "#"}">Ligar</a>
            <button class="link-button" type="button" data-mini-action="adiar">Reagendar</button>
            <button class="link-button" type="button" data-mini-action="crm">Reunião/CRM</button>
            <button class="link-button" type="button" data-mini-action="details">Detalhes</button>
        </div>
    `;
    els.mapLeadMiniCard.querySelector(".map-mini-card__close")?.addEventListener("click", () => selectLead(null));
    els.mapLeadMiniCard.querySelectorAll("[data-mini-action]").forEach((button) => {
        button.addEventListener("click", () => {
            const action = button.dataset.miniAction;
            if (action === "details") {
                setDrawerOpen(true);
                return;
            }
            performAction(action);
        });
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function displayValue(value, fallback = "-") {
    const text = String(value ?? "").trim();
    return text ? escapeHtml(text) : fallback;
}

function timelineDateParts(value) {
    const text = String(value || "").trim();
    if (!text) return { date: "-", time: "-" };
    const [date = "-", time = "-"] = text.split(/\s+/);
    return { date, time: time || "-" };
}

function timelineActionLabel(item) {
    const raw = String(item.tipo_acao || item.acao || item.titulo || "atividade");
    const key = normalize(raw);
    if (key.includes("import") || key.includes("criada")) return "Lead criada";
    if (key.includes("contact")) return "Contacto efetuado";
    if (key.includes("reuniao") || key.includes("crm")) return "Reunião marcada";
    if (key.includes("followup") || key.includes("adiar") || key.includes("reagend")) return "Follow-up reagendado";
    if (key.includes("estado")) return "Estado alterado";
    return raw;
}

function timelineActionKind(item) {
    const key = normalize([item.tipo_acao, item.acao, item.titulo].filter(Boolean).join(" "));
    if (key.includes("import") || key.includes("criada")) return "created";
    if (key.includes("contact")) return "contact";
    if (key.includes("reuniao") || key.includes("crm")) return "meeting";
    if (key.includes("followup") || key.includes("adiar") || key.includes("reagend")) return "followup";
    if (key.includes("estado")) return "state";
    return "default";
}

function leadTimelineItems(lead) {
    if (Array.isArray(lead?.timeline) && lead.timeline.length) return lead.timeline;
    if (Array.isArray(lead?.historico) && lead.historico.length) return lead.historico;
    return [];
}

function renderTimelineItem(item) {
    const { date, time } = timelineDateParts(item.created_at);
    const action = timelineActionLabel(item);
    const user = item.utilizador || item.user || "Sem utilizador";
    const observation = item.descricao || item.observacao || item.resultado || "Sem observação";
    return `<article class="lead-drawer-timeline-item lead-drawer-timeline-item--${timelineActionKind(item)}">
        <div class="lead-drawer-timeline-head">
            <strong>${displayValue(action)}</strong>
            <span class="lead-drawer-timeline-type">${displayValue(item.tipo_acao || item.acao || "atividade")}</span>
        </div>
        <div class="lead-drawer-timeline-meta">
            <span class="lead-drawer-timeline-date">${displayValue(date)} · ${displayValue(time)}</span>
            <span class="lead-drawer-timeline-user">${displayValue(user)}</span>
        </div>
        <p>${displayValue(observation, "Sem observação")}</p>
    </article>`;
}

function renderTimelinePreview(lead, { limit = 3, compact = false } = {}) {
    const items = leadTimelineItems(lead).slice(0, limit);
    if (!items.length) return "";
    return `
        <section class="map-timeline-preview ${compact ? "map-timeline-preview--compact" : ""}">
            <h4>Últimos eventos</h4>
            <div>
                ${items.map(renderTimelineItem).join("")}
            </div>
        </section>
    `;
}

function leadEditUrl(lead) {
    if (!lead?.id) return "#";
    const params = new URLSearchParams({
        lead_id: lead.id,
        next: window.location.pathname,
        nome_cliente: lead.nome_cliente || "",
        empresa: lead.empresa || lead.nome_empresa || "",
        nome_empresa: lead.nome_empresa || "",
        cidade: lead.cidade || lead.localidade || "",
        localidade: lead.localidade || lead.cidade || "",
        morada: lead.morada || "",
        codigo_postal: lead.codigo_postal || "",
        telefone: lead.telefone || "",
        email: lead.email || "",
        area_negocio: lead.area_negocio || lead.tipo_cliente || "",
        tipo_cliente: lead.tipo_cliente || lead.area_negocio || "",
        comercial_responsavel: lead.comercial_responsavel || "",
        observacoes: lead.observacoes || "",
        observacoes_contacto: lead.observacoes_contacto || "",
    });
    return `/leads/nova?${params}`;
}

function detailLine(label, value) {
    return `<div class="detail-line"><dt>${label}</dt><dd>${displayValue(value)}</dd></div>`;
}

function observationBlock(title, value, emptyText) {
    const text = String(value ?? "").trim();
    return `
        <section class="lead-drawer-block lead-observation-block ${text ? "" : "lead-observation-block--empty"}">
            <h4>${title}</h4>
            <p>${text ? escapeHtml(text) : emptyText}</p>
        </section>
    `;
}

function renderOperationalSignals(lead) {
    const tags = Array.isArray(lead.tags) ? lead.tags.filter(Boolean) : [];
    const insights = leadInsights(lead).filter(Boolean);
    return `
        <section class="lead-drawer-block lead-signal-block">
            <h4>Tags</h4>
            ${tags.length ? `<div class="lead-chip-row">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : `<p class="lead-muted-copy">Sem tags</p>`}
            ${insights.length ? `<div class="lead-chip-row lead-chip-row--insights">${insights.map((tag) => `<span class="insight-pill">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
            ${lead.insight_note ? `<p>${escapeHtml(lead.insight_note)}</p>` : ""}
        </section>
    `;
}

function renderInsightPanel(lead) {
    const tags = leadInsights(lead);
    const chips = INSIGHT_TAGS.map((tag) => `
        <button type="button" class="insight-chip ${tags.includes(tag) ? "is-active" : ""}" data-insight-tag="${tag}">${tag}</button>
    `).join("");
    return `
        <section class="internal-insights-panel">
            <div class="internal-insights-panel__head">
                <h3>Insights Internos</h3>
                <span>${hasInsights(lead) ? "Atualizado" : "Sem insights"}</span>
            </div>
            <div class="insight-chip-list">${chips}</div>
            <textarea id="internalInsightNote" rows="2" maxlength="280" placeholder="Adicionar insight interno...">${displayValue(lead.insight_note, "")}</textarea>
            <div class="internal-insights-panel__footer">
                <small>Último update: ${lead.updated_at ? new Date(lead.updated_at).toLocaleDateString("pt-PT") : "—"}</small>
                <button class="button secondary" id="saveInternalInsights" type="button">Guardar</button>
            </div>
        </section>
    `;
}

function renderNearbyList() {
    els.nearbyCount.textContent = nearbyLeads.length;
    if (!selectedLead) {
        els.nearbyList.innerHTML = "Selecione uma lead com localização no mapa.";
        els.nearbyList.classList.add("empty-state");
        return;
    }
    if (!hasCoordinates(selectedLead)) {
        els.nearbyList.innerHTML = "Esta lead não tem coordenadas — não é possível calcular proximidades.";
        els.nearbyList.classList.add("empty-state");
        return;
    }
    els.nearbyList.classList.remove("empty-state");
    if (nearbyLeads.length === 0) {
        els.nearbyList.innerHTML = `
            <section class="empty-nearby-state">
                <strong>Sem leads próximas neste raio.</strong>
                <p>Experimenta aumentar para ${Math.min(50, Math.max(20, nearbyRadiusKm + 5))} km.</p>
            </section>
        `;
        return;
    }
    els.nearbyList.innerHTML = nearbyLeads.map((lead) => `
        <article class="nearby-row nearby-row--compact">
            <div class="row-top">
                <strong>${leadName(lead)}</strong>
                <span class="tag distance-badge">${lead.distanceKm.toFixed(1)} km</span>
            </div>
            <div class="nearby-meta">
                <span>${leadArea(lead)}</span>
                <span>${lead.telefone || "—"}</span>
                <span>${leadCity(lead)}</span>
            </div>
        </article>
    `).join("");
}

function updateRadiusUi() {
    if (els.nearbyRadius) els.nearbyRadius.value = nearbyRadiusKm;
    if (els.nearbyRadiusValue) els.nearbyRadiusValue.textContent = nearbyRadiusKm;
    if (els.nearbyTitle) els.nearbyTitle.textContent = `Leads próximas em ${nearbyRadiusKm} km`;
    if (els.nearbyRadiusText) {
        els.nearbyRadiusText.innerHTML = `Raio de <strong>${nearbyRadiusKm} km</strong> em torno da lead selecionada. Inclui contactos a retomar (ex.: não atendeu, ligar depois).`;
    }
}

function renderOperationalInsights() {
    if (els.recommendedZone) {
        const groups = new Map();
        allLeads.filter((lead) => isActive(lead) && !excludedFromDayContact(lead) && hasCoordinates(lead)).forEach((lead) => {
            const city = leadCity(lead);
            groups.set(city, (groups.get(city) || 0) + 1);
        });
        const best = Array.from(groups.entries()).sort((a, b) => b[1] - a[1])[0];
        els.recommendedZone.querySelector("strong").textContent = best ? `${best[0]} · ${best[1]} leads próximas` : "Sem zona ativa";
    }
    if (els.forgottenAlert) {
        const count = allLeads.filter(isForgotten).length;
        els.forgottenAlert.hidden = count === 0;
        els.forgottenAlert.textContent = `${count} leads sem contacto recente`;
    }
}

function generatePlan() {
    if (!selectedLead) return;
    const max = planLimit(12);
    const planLeads = [selectedLead, ...nearbyLeads].slice(0, max);
    planLeads.forEach((lead) => selectedBulkIds.add(lead.id));
    currentRouteDay = planLeads;
    renderRouteDayList();
    const dominantLocality = dominant(planLeads.map((lead) => leadCity(lead)));
    els.planSummary.innerHTML = `
        <section class="plan-created-card">
            <strong>Lista criada</strong>
            <p>${planLeads.length} contactos preparados no raio de ${nearbyRadiusKm} km.</p>
        </section>
        <section class="plan-summary plan-summary--compact">
            <article><span>Total</span><strong>${planLeads.length}</strong></article>
            <article><span>Zona</span><strong>${dominantLocality}</strong></article>
        </section>
    `;
    els.visitPlan.innerHTML = planLeads.map((lead, index) => `
        <article class="visit-row visit-row--compact">
            <div class="row-top">
                <strong>${index + 1}. ${leadName(lead)}</strong>
                <span class="tag">${index === 0 ? "Base" : `${(lead.distanceKm ?? haversineKm(selectedLead, lead)).toFixed(1)} km`}</span>
            </div>
            <span class="muted">${leadArea(lead)} · ${lead.telefone || "—"} · ${leadCity(lead)} · ${leadCommercialLabel(lead)}</span>
        </article>
    `).join("");
    currentPlanRows = planLeads.map((lead, index) => ({
        comercial: planOwnerValue(),
        data: planDateValue(),
        raio_km: nearbyRadiusKm,
        nome_empresa: leadName(lead),
        tipo_cliente: leadArea(lead),
        morada: lead.morada,
        codigo_postal: lead.codigo_postal,
        localidade: leadCity(lead),
        contacto: leadName(lead),
        telefone: lead.telefone,
        email: lead.email,
        estado: lead.estado,
        observacoes: lead.observacoes_contacto || lead.observacoes,
        distancia_km: index === 0 ? "0.0" : (lead.distanceKm ?? haversineKm(selectedLead, lead)).toFixed(1),
    }));
    els.exportPlan.disabled = currentPlanRows.length === 0;
    drawPlanLine(planLeads);
    document.getElementById("planPanel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function generateDayContactPlan() {
    if (!selectedLead || !hasCoordinates(selectedLead)) return;
    const head = eligibleForDayContactPlan(selectedLead) ? [selectedLead] : [];
    const nearbyEligible = nearbyLeads.filter(eligibleForDayContactPlan);
    if (nearbyEligible.length === 0) {
        els.planSummary.innerHTML = `
            <section class="plan-warning-card">
                <strong>Sem leads próximas para adicionar.</strong>
                <p>A lead base foi selecionada, mas não existem outras leads ativas num raio de ${nearbyRadiusKm} km.</p>
            </section>
        `;
        els.visitPlan.innerHTML = head.length
            ? `<article class="visit-row visit-row--compact">
                <div class="row-top">
                    <strong>1. ${leadName(selectedLead)}</strong>
                    <span class="tag">Base</span>
                </div>
                <div class="nearby-meta">
                    <span>${leadArea(selectedLead)}</span>
                    <span>${selectedLead.telefone || "—"}</span>
                    <span>${leadCity(selectedLead)}</span>
                </div>
            </article>`
            : "";
    currentPlanRows = head.map((lead) => ({
        comercial: planOwnerValue(),
        data: planDateValue(),
        raio_km: nearbyRadiusKm,
            nome_empresa: leadName(lead),
            tipo_cliente: leadArea(lead),
            morada: lead.morada,
            codigo_postal: lead.codigo_postal,
            localidade: leadCity(lead),
            contacto: leadName(lead),
            telefone: lead.telefone,
            email: lead.email,
            estado: lead.estado,
            observacoes: lead.observacoes_contacto || lead.observacoes,
            distancia_km: "0.0",
        }));
        els.exportPlan.disabled = currentPlanRows.length === 0;
        drawPlanLine(head);
        document.getElementById("planPanel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
    }
    const pool = [...head, ...nearbyEligible];
    const seen = new Set();
    const unique = [];
    for (const lead of pool) {
        if (seen.has(lead.id)) continue;
        seen.add(lead.id);
        unique.push(lead);
    }
    if (unique.length === 0) {
        els.planSummary.innerHTML =
            '<p class="empty-state empty-state--quiet">Não há leads elegíveis no raio (ou a lead base está excluída do plano de contactos).</p>';
        els.visitPlan.innerHTML = "";
        currentPlanRows = [];
        els.exportPlan.disabled = true;
        if (planLine) planLine.remove();
        planLine = null;
        orderMarkers.forEach((marker) => marker.remove());
        orderMarkers = [];
        return;
    }
    const max = Math.min(planLimit(15), unique.length);
    const planLeads = unique.slice(0, max).map((lead, index) => ({
        ...lead,
        distanceKm: index === 0 ? 0 : haversineKm(selectedLead, lead),
    }));
    planLeads.forEach((lead) => selectedBulkIds.add(lead.id));
    currentRouteDay = planLeads;
    renderRouteDayList();

    const dominantLocality = dominant(planLeads.map((lead) => leadCity(lead)));
    els.planSummary.innerHTML = `
        <section class="plan-created-card">
            <strong>Lista criada</strong>
            <p>${planLeads.length} contactos preparados no raio de ${nearbyRadiusKm} km. Podes exportar a lista em Excel.</p>
        </section>
        <section class="plan-summary plan-summary--compact">
            <article><span>Lista</span><strong>Contactos da zona</strong></article>
            <article><span>Leads</span><strong>${planLeads.length}</strong></article>
            <article><span>Raio</span><strong>${nearbyRadiusKm} km</strong></article>
            <article><span>Zona</span><strong>${dominantLocality}</strong></article>
        </section>
    `;
    els.visitPlan.innerHTML = planLeads.map((lead, index) => `
        <article class="visit-row visit-row--compact">
            <div class="row-top">
                <strong>${index + 1}. ${leadName(lead)}</strong>
                <span class="tag">${index === 0 ? "Base" : `${lead.distanceKm.toFixed(1)} km`}</span>
            </div>
            <div class="nearby-meta">
                <span>${leadArea(lead)}</span>
                <span>${lead.telefone || "—"}</span>
                <span>${leadCity(lead)}</span>
            </div>
        </article>
    `).join("");

    currentPlanRows = planLeads.map((lead, index) => ({
        comercial: planOwnerValue(),
        data: planDateValue(),
        raio_km: nearbyRadiusKm,
        nome_empresa: leadName(lead),
        tipo_cliente: leadArea(lead),
        morada: lead.morada,
        codigo_postal: lead.codigo_postal,
        localidade: leadCity(lead),
        contacto: leadName(lead),
        telefone: lead.telefone,
        email: lead.email,
        estado: lead.estado,
        observacoes: lead.observacoes_contacto || lead.observacoes,
        distancia_km: index === 0 ? "0.0" : lead.distanceKm.toFixed(1),
    }));
    els.exportPlan.disabled = currentPlanRows.length === 0;
    drawPlanLine(planLeads);
    document.getElementById("planPanel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function drawPlanLine(planLeads) {
    if (planLine) planLine.remove();
    orderMarkers.forEach((marker) => marker.remove());
    orderMarkers = [];
    const points = planLeads.filter(hasCoordinates).map((lead) => [lead.latitude, lead.longitude]);
    if (points.length > 1) {
        planLine = L.polyline(points, { color: "#0f766e", weight: 3, dashArray: "8 6" }).addTo(map);
    }
    planLeads.filter(hasCoordinates).forEach((lead, index) => {
        const marker = L.marker([lead.latitude, lead.longitude], {
            icon: L.divIcon({
                className: "order-marker",
                html: `<span>${index + 1}</span>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            }),
        }).addTo(map);
        orderMarkers.push(marker);
    });
}

function dominant(values) {
    const counts = values.reduce((acc, value) => {
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
}

function planLimit(defaultValue = 12) {
    return Math.min(25, Math.max(1, Number(els.planMax?.value) || defaultValue));
}

function planDateValue() {
    return els.planDate?.value || todayIso;
}

function planOwnerValue() {
    return "Alltera";
}

async function goToNextLead() {
    const commercial = els.commercialFilter?.value || (selectedLead ? leadCommercialKey(selectedLead) : "");
    const params = new URLSearchParams();
    if (selectedLead?.id) params.set("base_id", String(selectedLead.id));
    if (commercial) params.set("commercial", commercial);
    const response = await fetch(`/api/leads/next?${params.toString()}`);
    const payload = await response.json();
    if (payload.lead?.id) {
        selectLead(payload.lead.id);
        const row = document.querySelector(`.lead-row[data-id="${payload.lead.id}"]`);
        row?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

async function performAction(action) {
    if (!selectedLead) return;
    const dialog = window.AllteraDialog;
    const askConfirm = async (message, options) => (dialog ? dialog.confirm(message, options) : confirm(message));
    const askPrompt = async (message, options = {}) => (dialog ? dialog.prompt(message, options) : prompt(message, options.defaultValue || ""));
    const showAlert = async (message, options) => (dialog ? dialog.alert(message, options) : alert(message));
    const confirmations = {
        crm: "Confirmar que esta lead já foi tratada no CRM? A lead sai da lista ativa.",
        sem_interesse: "Confirmar Sem interesse? A lead deixa de aparecer na lista ativa.",
    };
    if (confirmations[action] && !(await askConfirm(confirmations[action], { type: "warning", confirmText: "Confirmar" }))) return;
    const payload = { action, comercial_responsavel: selectedLead.comercial_responsavel, observacao: "" };
    if (action === "update_coordinates") {
        payload.latitude = await askPrompt("Latitude:", { title: "Atualizar coordenadas", defaultValue: selectedLead.latitude || "" });
        if (payload.latitude === null) return;
        payload.longitude = await askPrompt("Longitude:", { title: "Atualizar coordenadas", defaultValue: selectedLead.longitude || "" });
        if (payload.longitude === null) return;
    } else if (action === "corrigir_estado") {
        const state = await askPrompt("Novo estado:", { title: "Corrigir estado", defaultValue: selectedLead.estado });
        if (state === null) return;
        payload.estado = state || selectedLead.estado;
        const observation = await askPrompt("Motivo da correcao:", { title: "Corrigir estado" });
        if (observation === null) return;
        payload.observacao = observation || "";
    }
    if (action === "ligar_volta") {
        const when = await askPrompt("Data para ligar de volta:", { title: "Ligar de volta", defaultValue: todayIso, inputType: "date" });
        if (!when) return;
        payload.action = "adiar";
        payload.data_novo_contacto = when;
        const observation = await askPrompt("Motivo/observacao:", { title: "Ligar de volta", defaultValue: "Ligar de volta" });
        if (observation === null) return;
        payload.observacao = observation || "Ligar de volta";
    } else if (action === "adiar") {
        const when = await askPrompt("Data de novo contacto:", { title: "Reagendar contacto", defaultValue: todayIso, inputType: "date" });
        if (!when) return;
        const observation = await askPrompt("Motivo/observacao:", { title: "Reagendar contacto", defaultValue: "Ligar mais tarde" });
        if (observation === null) return;
        payload.data_novo_contacto = when;
        payload.observacao = observation || "";
    } else if (!["update_coordinates", "corrigir_estado"].includes(action)) {
        const observation = await askPrompt("Observacao opcional:", { title: "Registar ação" });
        if (observation === null) return;
        payload.observacao = observation || "";
    }

    const actedLeadId = selectedLead.id;
    const response = await fetch(`/api/leads/${selectedLead.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        await showAlert("Nao foi possivel atualizar a lead.", { type: "error", title: "Erro" });
        return;
    }
    await loadLeads({ force: true });
    if (["crm", "reuniao", "cliente_existente", "sem_interesse", "adiar", "ligar_volta"].includes(action)) {
        const leadStillVisible = leadsById.has(actedLeadId) && visibleLeads.some((lead) => lead.id === actedLeadId);
        if (!leadStillVisible) selectLead(null);
        renderMarkers({ force: true });
        renderMapMiniCard();
    }
}

async function tagAction(action, tag) {
    if (!selectedLead || !tag) return;
    await fetch(`/api/leads/${selectedLead.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, tag, comercial_responsavel: selectedLead.comercial_responsavel }),
    });
    await loadLeads();
}

async function addLeadNote() {
    if (!selectedLead || !els.leadNoteInput) return;
    const note = els.leadNoteInput.value.trim();
    if (!note) return;
    const response = await fetch(`/api/leads/${selectedLead.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "add_note",
            observacao: note,
            comercial_responsavel: selectedLead.comercial_responsavel,
        }),
    });
    if (!response.ok) {
        if (window.AllteraDialog) await window.AllteraDialog.alert("Nao foi possivel guardar a nota.", { type: "error", title: "Erro" });
        else alert("Nao foi possivel guardar a nota.");
        return;
    }
    els.leadNoteInput.value = "";
    await loadLeads();
}

async function saveInternalInsights() {
    if (!selectedLead) return;
    const tags = Array.from(document.querySelectorAll("[data-insight-tag].is-active")).map((item) => item.dataset.insightTag);
    const note = document.getElementById("internalInsightNote")?.value.trim() || "";
    const response = await fetch(`/api/leads/${selectedLead.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "update_insights",
            insight_tags: tags,
            insight_note: note,
            comercial_responsavel: selectedLead.comercial_responsavel,
        }),
    });
    if (!response.ok) {
        if (window.AllteraDialog) await window.AllteraDialog.alert("Não foi possível guardar os insights.", { type: "error", title: "Erro" });
        return;
    }
    const updated = await response.json();
    allLeads = allLeads.map((lead) => (lead.id === updated.id ? updated : lead));
    selectedLead = updated;
    applyFilters();
    renderDetails();
    if (window.AllteraToast) window.AllteraToast("Insights internos guardados.", "success");
}

async function bulkAction(action, extra = {}) {
    const ids = extra.ids || Array.from(selectedBulkIds);
    if (!ids.length) return;
    const response = await fetch("/api/leads/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids, ...extra }),
    });
    if (!response.ok) {
        if (window.AllteraDialog) await window.AllteraDialog.alert("Não foi possível aplicar a ação em lote.", { type: "error", title: "Erro" }); else alert("Não foi possível aplicar a ação em lote.");
        return;
    }
    selectedBulkIds = new Set();
    await loadLeads();
}

async function exportPlan() {
    if (currentPlanRows.length === 0) return;
    const response = await fetch("/api/export-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: currentPlanRows }),
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plano_contactos_alltera.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

async function exportSelectedLeads() {
    const rows = allLeads
        .filter((lead) => selectedBulkIds.has(lead.id))
        .map((lead) => ({
            nome_empresa: leadName(lead),
            tipo_cliente: leadArea(lead),
            morada: lead.morada,
            codigo_postal: lead.codigo_postal,
            localidade: leadCity(lead),
            contacto: leadName(lead),
            telefone: lead.telefone,
            email: lead.email,
            estado: lead.estado,
            observacoes: lead.observacoes_contacto || lead.observacoes,
            distancia_km: "",
        }));
    if (!rows.length) return;
    const response = await fetch("/api/export-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "leads_selecionadas_alltera.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

function clearSmartRoute() {
    if (smartRouteLine) smartRouteLine.remove();
    smartRouteLine = null;
    smartRouteMarkers.forEach((marker) => marker.remove());
    smartRouteMarkers = [];
    currentRouteDay = [];
    renderRouteDayList();
}

function openRouteInMaps() {
    const route = currentRouteDay.length ? currentRouteDay : routeDaySelection();
    if (route.length < 2) return;
    const points = route.slice(0, 10).map((lead) => `${lead.latitude},${lead.longitude}`);
    const origin = encodeURIComponent(points[0]);
    const destination = encodeURIComponent(points[points.length - 1]);
    const waypoints = points.slice(1, -1).map(encodeURIComponent).join("|");
    const url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ""}`;
    window.open(url, "_blank", "noopener");
}

function markRouteHistory(route) {
    route.forEach((lead, index) => {
        fetch(`/api/leads/${lead.id}/action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "day_plan",
                comercial_responsavel: lead.comercial_responsavel,
                observacao: `Posicao ${index + 1} na rota do dia.`,
            }),
        }).catch(() => {});
    });
}

function routeDistanceKm(route) {
    return route.slice(1).reduce((sum, lead, index) => sum + haversineKm(route[index], lead), 0);
}

function optimizedRoute(leads) {
    const pool = leads.filter(hasCoordinates);
    if (pool.length <= 2) return pool;
    const startIndex = selectedLead ? Math.max(0, pool.findIndex((lead) => lead.id === selectedLead.id)) : 0;
    const route = [pool.splice(startIndex, 1)[0]];
    while (pool.length) {
        const last = route[route.length - 1];
        const nextIndex = pool.reduce((best, lead, index) => (
            haversineKm(last, lead) < haversineKm(last, pool[best]) ? index : best
        ), 0);
        route.push(pool.splice(nextIndex, 1)[0]);
    }
    return route;
}

function drawSmartRoute() {
    const selected = visibleLeads.filter((lead) => selectedBulkIds.has(lead.id) && hasCoordinates(lead));
    if (selected.length < 2) {
        if (window.AllteraDialog) window.AllteraDialog.alert("Seleciona pelo menos duas leads com coordenadas.", { type: "info", title: "Seleção" });
        else alert("Seleciona pelo menos duas leads com coordenadas.");
        return;
    }
    clearSmartRoute();
    const route = optimizedRoute(selected);
    currentRouteDay = route;
    const points = route.map((lead) => [lead.latitude, lead.longitude]);
    smartRouteLine = L.polyline(points, {
        color: "#0f766e",
        weight: 4,
        opacity: 0.82,
        lineCap: "round",
        lineJoin: "round",
        dashArray: "10 8",
        className: "smart-route-line",
    }).addTo(map);
    route.forEach((lead, index) => {
        const marker = L.marker([lead.latitude, lead.longitude], {
            icon: L.divIcon({
                className: "smart-route-step",
                html: `<span>${index + 1}</span>`,
                iconSize: [26, 26],
                iconAnchor: [13, 13],
            }),
            zIndexOffset: 1000 + index,
        }).addTo(map);
        smartRouteMarkers.push(marker);
    });
    const distance = routeDistanceKm(route);
    const minutes = Math.max(8, Math.round((distance / 35) * 60 + route.length * 5));
    renderRouteDayList();
    markRouteHistory(route);
    map.flyToBounds(L.latLngBounds(points).pad(0.18), { duration: 0.32, easeLinearity: 0.25, maxZoom: 13 });
}

function resetFilters() {
    els.searchInput.value = "";
    els.localityFilter.value = "";
    els.typeFilter.value = "";
    if (els.commercialFilter) els.commercialFilter.value = "";
    els.stateFilter.value = "";
    if (els.heatFilter) els.heatFilter.value = "";
    els.classificationFilter.value = "ativos";
    if (els.scheduleFilter) els.scheduleFilter.value = "";
    if (els.territoryMode) els.territoryMode.value = "";
    els.tagFilter.value = "";
    if (els.insightFilter) els.insightFilter.value = "";
    els.historyFilter.checked = false;
    mapInitialFitDone = false;
    applyFilters();
}

function setMode(mode) {
    if (mode === "operational") {
        document.body.classList.toggle("operational-mode");
        if (document.body.classList.contains("operational-mode")) {
            document.body.classList.add("sidebar-collapsed");
            localStorage.setItem("alltera.sidebar.collapsed", "1");
        }
    }
    if (mode === "presentation") {
        document.body.classList.toggle("presentation-mode");
    }
    setTimeout(() => map.invalidateSize(), 220);
}

function bindEvents() {
    const debouncedApplyFilters = debounce(applyFilters, 200);

    // Drawer de filtros do mapa (UX-only): open/close via classe .open
    const elsFilters = {
        trigger: document.getElementById("mapFiltersTrigger"),
        panel: document.getElementById("mapFiltersPanel"),
        overlay: document.getElementById("mapFiltersOverlay"),
        close: document.getElementById("mapFiltersClose"),
    };

    const refreshMapSize = () => {
        requestAnimationFrame(() => map.invalidateSize());
        setTimeout(() => map.invalidateSize(), 180);
    };

    const setFiltersOpen = (open) => {
        if (!elsFilters.panel || !elsFilters.trigger) return;
        elsFilters.panel.classList.toggle("open", open);
        elsFilters.panel.setAttribute("aria-hidden", String(!open));
        elsFilters.trigger.setAttribute("aria-expanded", String(open));
        if (elsFilters.overlay) {
            elsFilters.overlay.classList.toggle("is-open", open);
            elsFilters.overlay.setAttribute("aria-hidden", String(!open));
        }
        document.body.classList.toggle("map-filters-open", open);
        refreshMapSize();
    };

    const toggleFilters = () => {
        if (!elsFilters.panel) return;
        const isOpen = elsFilters.panel.classList.contains("open");
        setFiltersOpen(!isOpen);
    };

    if (elsFilters.trigger) {
        elsFilters.trigger.addEventListener("click", (e) => {
            e.preventDefault();
            toggleFilters();
        });
    }
    if (elsFilters.overlay) {
        elsFilters.overlay.addEventListener("click", () => setFiltersOpen(false));
    }
    if (elsFilters.close) {
        elsFilters.close.addEventListener("click", () => setFiltersOpen(false));
    }
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setFiltersOpen(false);
    });

    const debouncedRadiusUpdate = debounce(() => {
        updateNearby();
        refreshMarkerState();
        renderDetails();
    }, 120);
    [
        els.searchInput,
        els.localityFilter,
        els.typeFilter,
        els.commercialFilter,
        els.stateFilter,
        els.heatFilter,
        els.classificationFilter,
        els.scheduleFilter,
        els.tagFilter,
        els.insightFilter,
        els.territoryMode,
    ].filter(Boolean).forEach((element) => {
        element.addEventListener("input", debouncedApplyFilters);
    });
    if (els.assignmentScopeFilter) {
        els.assignmentScopeFilter.addEventListener("change", () => {
            selectedBulkIds = new Set();
            selectedLead = null;
            loadLeads();
        });
    }
    [els.historyFilter, els.heatmapToggle].filter(Boolean).forEach((element) => {
        element.addEventListener("change", debouncedApplyFilters);
    });
    if (els.nearbyRadius) {
        els.nearbyRadius.addEventListener("input", () => {
            nearbyRadiusKm = Math.min(50, Math.max(1, Number(els.nearbyRadius.value) || DEFAULT_NEARBY_RADIUS_KM));
            updateRadiusUi();
            debouncedRadiusUpdate();
        });
    }
    els.resetFilters.addEventListener("click", resetFilters);
    if (els.generatePlan) els.generatePlan.addEventListener("click", generatePlan);
    if (els.exportPlan) els.exportPlan.addEventListener("click", exportPlan);
    if (els.dayContactPlan) els.dayContactPlan.addEventListener("click", generateDayContactPlan);
    if (els.bulkAssign) els.bulkAssign.addEventListener("click", () => bulkAction("assign_commercial", { comercial: els.bulkCommercial.value }));
    if (els.bulkClearCommercial) els.bulkClearCommercial.addEventListener("click", () => bulkAction("clear_commercial"));
    if (els.bulkSetState) els.bulkSetState.addEventListener("click", () => bulkAction("set_state", { estado: els.bulkState.value }));
    if (els.bulkIgnore) els.bulkIgnore.addEventListener("click", () => bulkAction("ignore_map"));
    if (els.bulkExport) els.bulkExport.addEventListener("click", exportSelectedLeads);
    if (els.bulkPlan) {
        els.bulkPlan.addEventListener("click", () => {
            const first = Array.from(selectedBulkIds)[0];
            if (first) window.location.href = `/planeamento?lead_base=${first}`;
        });
    }
    if (els.nextLeadButton) els.nextLeadButton.addEventListener("click", goToNextLead);
    if (els.addLeadNote) els.addLeadNote.addEventListener("click", addLeadNote);
    if (els.leadNoteInput) {
        els.leadNoteInput.addEventListener("keydown", (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") addLeadNote();
        });
    }
    if (els.leadListTabVisible) els.leadListTabVisible.addEventListener("click", () => setLeadListMode("visible"));
    if (els.leadListTabAll) els.leadListTabAll.addEventListener("click", () => setLeadListMode("all"));
    if (els.operationalMode) els.operationalMode.addEventListener("click", () => setMode("operational"));
    if (els.presentationMode) els.presentationMode.addEventListener("click", () => setMode("presentation"));
    if (els.addTag) els.addTag.addEventListener("click", () => tagAction("add_tag", els.tagSelect.value));
    if (els.leadsList) {
        els.leadsList.addEventListener("click", (event) => {
            const checkbox = event.target.closest("[data-bulk-id]");
            if (checkbox) {
                event.stopPropagation();
                return;
            }
            const row = event.target.closest(".lead-row");
            if (row) openLeadDrawer(Number(row.dataset.id));
        });
        els.leadsList.addEventListener("change", (event) => {
            const checkbox = event.target.closest("[data-bulk-id]");
            if (!checkbox) return;
            const id = Number(checkbox.dataset.bulkId);
            if (checkbox.checked) selectedBulkIds.add(id);
            else selectedBulkIds.delete(id);
            renderBulkActions();
        });
        els.leadsList.addEventListener("mouseover", (event) => {
            const row = event.target.closest(".lead-row");
            if (!row || row.contains(event.relatedTarget)) return;
            setLeadHover(Number(row.dataset.id), true);
        });
        els.leadsList.addEventListener("mouseout", (event) => {
            const row = event.target.closest(".lead-row");
            if (!row || row.contains(event.relatedTarget)) return;
            setLeadHover(Number(row.dataset.id), false);
        });
    }
    document.querySelectorAll("[data-action]").forEach((button) => {
        button.addEventListener("click", () => performAction(button.dataset.action));
    });
    els.openFullLead?.addEventListener("click", (event) => {
        if (!selectedLead) event.preventDefault();
    });
    els.focusSelectedLead?.addEventListener("click", () => {
        if (!selectedLead || !hasCoordinates(selectedLead)) return;
        map.closePopup();
        map.flyTo([selectedLead.latitude, selectedLead.longitude], Math.max(map.getZoom(), 14), {
            animate: true,
            duration: 0.22,
            easeLinearity: 0.3,
        });
    });
    if (els.drawerClose) els.drawerClose.addEventListener("click", () => selectLead(null));
    if (els.drawerBackdrop) els.drawerBackdrop.addEventListener("click", () => selectLead(null));
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && selectedLead) selectLead(null);
    });
    map.on("click", () => selectLead(null));
    const debouncedViewportLoad = debounce(() => loadLeads({ viewportOnly: true }), 260);
    map.on("moveend zoomend", () => {
        renderMapGeoStats();
        debouncedViewportLoad();
    });
}

async function loadLeads({ force = false, viewportOnly = true } = {}) {
    setMapLoading(true);
    const params = new URLSearchParams(window.location.search);
    const toFiniteNumber = (value) => {
        if (value === null || value === undefined) return Number.NaN;
        const trimmed = String(value).trim();
        if (!trimmed) return Number.NaN;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : Number.NaN;
    };
    const focusLeadId = !hasConsumedInitialFocus && initialFocusLeadId ? initialFocusLeadId : null;
    const selectedLeadId = selectedLead?.id || null;
    const urlLat = toFiniteNumber(params.get("lat"));
    const urlLng = toFiniteNumber(params.get("lng"));
    const currentId = selectedLeadId || focusLeadId;
    let response;
    const fetchParams = new URLSearchParams({ lite: "1" });
    if (els.assignmentScopeFilter?.value) fetchParams.set("scope", els.assignmentScopeFilter.value);
    if (currentId) fetchParams.set("lead_id", String(currentId));
    if (viewportOnly) {
        const boundsParams = currentBoundsParams();
        Object.entries(boundsParams).forEach(([key, value]) => fetchParams.set(key, value));
    }
    const fetchKey = fetchParams.toString();
    if (!force && fetchKey === lastLeadFetchKey && allLeads.length) {
        setMapLoading(false);
        return;
    }
    lastLeadFetchKey = fetchKey;
    if (leadFetchController) leadFetchController.abort();
    const controller = new AbortController();
    leadFetchController = controller;
    try {
        response = await fetch(`/api/leads?${fetchKey}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Erro ao carregar leads do mapa");
    } catch (error) {
        if (leadFetchController === controller) setMapLoading(false);
        if (leadFetchController === controller) lastLeadFetchKey = "";
        if (error?.name === "AbortError") return;
        throw error;
    }
    const payload = await response.json();
    if (leadFetchController !== controller) return;
    allLeads = payload.map((lead) => ({
        ...lead,
        id: Number(lead?.id),
        latitude: lead?.latitude === "" || lead?.latitude == null ? null : Number(lead.latitude),
        longitude: lead?.longitude === "" || lead?.longitude == null ? null : Number(lead.longitude),
    }));
    leadsById = new Map(allLeads.map((lead) => [lead.id, lead]));
    applyCityOffsets();
    if (focusLeadId) {
        if (els.classificationFilter) els.classificationFilter.value = "";
        if (els.historyFilter) els.historyFilter.checked = true;
    }
    if (selectedLeadId) {
        selectedLead = leadsById.get(selectedLeadId) || selectedLead;
    } else if (focusLeadId) {
        selectedLead = leadsById.get(focusLeadId) || null;
    }
    setDrawerOpen(Boolean(selectedLead));
    applyFilters();
    renderOperationalInsights();
    if (leadFetchController === controller) setMapLoading(false);
    if (focusLeadId && selectedLead) {
        const alreadyVisible = visibleLeads.some((lead) => lead.id === selectedLead.id);
        if (!alreadyVisible) {
            visibleLeads = [selectedLead, ...visibleLeads];
            renderMarkers();
        }
        selectLead(focusLeadId);
        consumeInitialFocus();
        return;
    }
    if (!hasConsumedInitialFocus) consumeInitialFocus();
    if (!selectedLeadId && Number.isFinite(urlLat) && Number.isFinite(urlLng)) {
        // Respeita deep-link com coordenadas, mas sem aproximar demasiado.
        map.flyTo([urlLat, urlLng], 11, { animate: true, duration: 0.32, easeLinearity: 0.25 });
    }
}

function applyCityOffsets() {
    const groups = new Map();
    allLeads.filter(hasCoordinates).forEach((lead) => {
        const key = `${leadCity(lead)}|${lead.latitude}|${lead.longitude}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(lead);
    });
    groups.forEach((items) => {
        if (items.length <= 1) return;
        items.forEach((lead, index) => {
            const angle = (Math.PI * 2 * index) / items.length;
            const radius = 0.00035 + Math.floor(index / 8) * 0.00018;
            lead.latitude = lead.latitude + Math.cos(angle) * radius;
            lead.longitude = lead.longitude + Math.sin(angle) * radius;
        });
    });
}

async function init() {
    updateRadiusUi();
    bindEvents();
    requestAnimationFrame(() => map.invalidateSize());
    setTimeout(() => map.invalidateSize(), 250);

    // Integra a pesquisa global do header (base.html) com os filtros do mapa.
    // O mapa usa els.searchInput (id="searchInput").
    const globalSearchInput = document.getElementById("globalSearchInput");
    const debouncedGlobalApplyFilters = debounce(applyFilters, 200);
    const setSearchInputValue = (value) => {
        if (!els.searchInput) return;
        // evita loop desnecessário: só atribui se mudou
        if (els.searchInput.value !== value) {
            els.searchInput.value = value;
            // aplica filtro em tempo real
            debouncedGlobalApplyFilters();
        }
    };

    if (globalSearchInput && els.searchInput) {
        globalSearchInput.addEventListener("input", () => {
            setSearchInputValue(globalSearchInput.value);
        });

        // “X” não existe no HTML; mas isto cobre o caso de limpar via tecla/backspace.
        globalSearchInput.addEventListener("search", () => {
            setSearchInputValue(globalSearchInput.value);
        });

        // inicializa coerência (caso venha com value pré-definido)
        setSearchInputValue(globalSearchInput.value || "");
    }

    await loadLeads();
    requestAnimationFrame(() => map.invalidateSize());
}

init();
