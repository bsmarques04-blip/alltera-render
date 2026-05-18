// Centro inicial: Portugal (visão geral, sem zoom excessivo)
const defaultCenter = [39.5, -8.0];
const todayIso = new Date().toISOString().slice(0, 10);

/** Raio fixo para “mesmo dia” e plano de contactos (km). */
const DEFAULT_NEARBY_RADIUS_KM = 10;

/** Estados excluídos do plano de contactos do dia e da lista de próximas. */
const STATES_EXCLUDED_DAY_CONTACT = ["Já tratado / no CRM", "Sem interesse", "Reunião marcada", "Sem interesse definitivo", "Cliente existente"];

let allLeads = [];
let visibleLeads = [];
let nearbyLeads = [];
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

const map = L.map("map", {
    zoomControl: true,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 90,
    closePopupOnClick: false,
}).setView(defaultCenter, 7);
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
    commercialFilter: document.getElementById("commercialFilter"),
    stateFilter: document.getElementById("stateFilter"),
    classificationFilter: document.getElementById("classificationFilter"),
    scheduleFilter: document.getElementById("scheduleFilter"),
    tagFilter: document.getElementById("tagFilter"),
    historyFilter: document.getElementById("historyFilter"),
    heatmapToggle: document.getElementById("heatmapToggle"),
    territoryMode: document.getElementById("territoryMode"),
    resetFilters: document.getElementById("resetFilters"),
    selectedState: document.getElementById("selectedState"),
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
    bulkRoute: document.getElementById("bulkRoute"),
    bulkPlan: document.getElementById("bulkPlan"),
    nextLeadButton: document.getElementById("nextLeadButton"),
    mapGeoStats: document.getElementById("mapGeoStats"),
    mapRouteSummary: document.getElementById("mapRouteSummary"),
    mapLeadMiniCard: document.getElementById("mapLeadMiniCard"),
    routeSelectedCount: document.getElementById("routeSelectedCount"),
    routeDayList: document.getElementById("routeDayList"),
    drawRouteDay: document.getElementById("drawRouteDay"),
    openRouteMaps: document.getElementById("openRouteMaps"),
    clearRouteDay: document.getElementById("clearRouteDay"),
    leadListTabVisible: document.getElementById("leadListTabVisible"),
    leadListTabAll: document.getElementById("leadListTabAll"),
};

if (els.planDate) els.planDate.value = todayIso;

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
    const score = leadScore(lead);
    if (score >= 70) return "high";
    if (score >= 40) return "medium";
    return "low";
}

function scoreLabel(lead) {
    return `${leadScore(lead)}/100`;
}

function priorityLabel(lead) {
    const score = leadScore(lead);
    if (score >= 70) return "Alta prioridade";
    if (score >= 40) return "Media prioridade";
    return "Baixa prioridade";
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
    if (!window.__allteraLeadNameDebugLogged) {
        console.log("[mapa] Estrutura de lead (sample):", lead);
        window.__allteraLeadNameDebugLogged = true;
    }
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

function safeLeadForCluster(lead, { isDev }) {
    if (!lead || typeof lead !== "object") return null;
    if (!isValidLeadId(lead)) {
        if (isDev) {
            console.warn("[mapa] Lead inválida no cluster (id ausente/inválido):", lead);
        }
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

function setDrawerOpen(open) {
    if (els.leadDrawer) els.leadDrawer.classList.toggle("drawer-open", open);
    document.body.classList.toggle("map-drawer-open", open);
}

function markerIcon(lead) {
    const classes = ["marker-pin", markerVisualClass(lead)];
    const isNearby = nearbyLeads.some((item) => item.id === lead.id);
    if (!isActive(lead)) classes.push("inactive");
    if (selectedLead && lead.id === selectedLead.id) classes.push("selected");
    if (hoveredLeadId === lead.id) classes.push("hovered");
    else if (isNearby) classes.push("nearby");
    if (selectedLead && lead.id !== selectedLead.id && !isNearby) classes.push("out-of-focus");
    return L.divIcon({
        className: "",
        html: `<span class="${classes.join(" ")}"><span class="marker-pin__core"></span></span>`,
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
    return `
        <div class="lead-popup">
            <div class="lead-popup__header">
                <strong>${leadName(lead)}</strong>
                <span class="priority-badge priority-badge--${scoreBand(lead)}">${priorityLabel(lead)} · ${scoreLabel(lead)}</span>
            </div>
            <span>${leadArea(lead)}</span>
            <span>${lead.telefone || "—"}</span>
            <span>${leadCity(lead)}</span>
            <small>${leadCommercialLabel(lead)} · ${lead.estado}</small>
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
        passesScheduleFilter(lead) &&
        (!els.tagFilter?.value || (lead.tags || []).includes(els.tagFilter.value))
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

function applyFilters() {
    visibleLeads = allLeads.filter(passesFilters);
    if (selectedLead && !visibleLeads.some((lead) => lead.id === selectedLead.id)) {
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
    renderOperationalInsights();
    renderMapGeoStats();
    renderMapMiniCard();
}

function renderMetrics() {
    if (els.metricTotal) els.metricTotal.textContent = visibleLeads.length;
    if (els.metricActive) els.metricActive.textContent = visibleLeads.filter(isActive).length;
    if (els.metricCrm) els.metricCrm.textContent = visibleLeads.filter((lead) => normalizeKey(lead.estado) === "jatratadonocrm").length;
    if (els.metricPostponed) {
        els.metricPostponed.textContent = visibleLeads.filter((lead) => {
            if (lead.estado !== "Adiar contacto" || !lead.data_novo_contacto) return false;
            const date = parseDate(lead.data_novo_contacto);
            return date && date > new Date();
        }).length;
    }
}

function renderMarkers() {
    markers.forEach((marker) => marker.remove());
    markers = new Map();
    if (clusterLayer) {
        clusterLayer.remove();
        clusterLayer = null;
    }
    if (els.heatmapToggle.checked) return;
    const useClusters = window.L && L.markerClusterGroup && visibleLeads.filter(hasCoordinates).length > 25;
    clusterLayer = useClusters ? L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: false,
        spiderfyOnMaxZoom: false,
        animate: true,
        animateAddingMarkers: false,
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
    visibleLeads.filter(hasCoordinates).forEach((lead) => {
        const zIndex =
            selectedLead && lead.id === selectedLead.id ? 900 : nearbyLeads.some((item) => item.id === lead.id) ? 500 : 0;
        const marker = L.marker([lead.latitude, lead.longitude], { icon: markerIcon(lead), zIndexOffset: zIndex })
            .bindPopup(popupHtml(lead))
            .bindTooltip(tooltipHtml(lead), {
                direction: "top",
                offset: [0, -34],
                opacity: 1,
                className: "lead-smart-tooltip",
                sticky: true,
            });
        marker.on("click", () => selectLead(lead.id));
        marker.on("mouseover", () => setLeadHover(lead.id, true));
        marker.on("mouseout", () => setLeadHover(lead.id, false));
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

function renderHeatmap() {
    if (heatLayer) {
        heatLayer.remove();
        heatLayer = null;
    }
    if (!els.heatmapToggle.checked) return;
    const points = visibleLeads
        .filter((lead) => isActive(lead) && hasCoordinates(lead))
        .map((lead) => [lead.latitude, lead.longitude, 0.65]);
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
    els.listCount.textContent = sourceLeads.length;
    els.leadsList.innerHTML = sourceLeads.map((lead) => `
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
    `).join("");
    document.querySelectorAll(".lead-row").forEach((row) => {
        row.addEventListener("click", () => selectLead(Number(row.dataset.id)));
        row.addEventListener("mouseenter", () => setLeadHover(Number(row.dataset.id), true));
        row.addEventListener("mouseleave", () => setLeadHover(Number(row.dataset.id), false));
    });
    document.querySelectorAll("[data-bulk-id]").forEach((checkbox) => {
        checkbox.addEventListener("click", (event) => event.stopPropagation());
        checkbox.addEventListener("change", () => {
            const id = Number(checkbox.dataset.bulkId);
            if (checkbox.checked) selectedBulkIds.add(id);
            else selectedBulkIds.delete(id);
            renderBulkActions();
        });
    });
    renderBulkActions();
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
        setDrawerOpen(false);
        drawRadius();
        renderMarkers();
        renderLeadList();
        renderDetails();
        renderMapMiniCard();
        renderNearbyList();
        requestAnimationFrame(() => map.invalidateSize());
        return;
    }
    selectedLead = allLeads.find((lead) => lead.id === id) || null;
    currentPlanRows = [];
    els.exportPlan.disabled = true;
    setDrawerOpen(Boolean(selectedLead));
    updateNearby();
    renderMarkers();
    renderLeadList();
    renderDetails();
    renderMapMiniCard();
    renderNearbyList();
    if (selectedLead && hasCoordinates(selectedLead)) {
        const marker = markers.get(selectedLead.id);
        const markerLatLng = marker?.getLatLng?.();
        const target = markerLatLng ? [markerLatLng.lat, markerLatLng.lng] : [selectedLead.latitude, selectedLead.longitude];
        if (map.getZoom() > 14) {
            map.flyTo(target, 14, { animate: true, duration: 0.65, easeLinearity: 0.24 });
        } else if (map.getZoom() < 13) {
            map.flyTo(target, 13, { animate: true, duration: 0.65, easeLinearity: 0.24 });
        } else {
            map.panTo(target, { animate: true, duration: 0.5, easeLinearity: 0.24 });
        }
        scrollLeadIntoView(selectedLead.id);
    }
    requestAnimationFrame(() => map.invalidateSize());
}

function clusterLeadFromMarker(marker) {
    if (marker?.lead && typeof marker.lead === "object") return marker.lead;
    if (marker?.options?.lead && typeof marker.options.lead === "object") return marker.options.lead;
    for (const [id, item] of markers.entries()) {
        if (item === marker) return allLeads.find((lead) => lead.id === id);
    }
    return null;
}


function clusterPopupHtml(cluster) {
    const allChildMarkers = cluster.getAllChildMarkers();
    const total = cluster.getChildCount();

    const validLeads = allChildMarkers
        .map(clusterLeadFromMarker)
        .map((lead) => safeLeadForCluster(lead, { isDev: false }))
        .filter(Boolean)
        .map((lead) => ({
            id: lead.id || "",
            nome: leadName(lead),
        }));

    const rows = validLeads
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

    return `
        <section class="cluster-popup">
            <header>
                <strong>${total} leads nesta zona</strong>
                <span>Seleciona uma lead ou expande a área.</span>
            </header>

            <div class="cluster-leads-list">
                ${rows}
            </div>

            <div class="cluster-popup__footer">
                <button class="cluster-expand-button" type="button">
                    Expandir área
                </button>
            </div>
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
            button.addEventListener("click", () => selectLead(Number(button.dataset.clusterLeadId)));
        });
        container?.querySelector(".cluster-expand-button")?.addEventListener("click", () => expandClusterArea(cluster));
    });
}

function expandClusterArea(cluster) {
    const bounds = cluster.getBounds();
    if (!bounds || !bounds.isValid()) return;
    map.closePopup();
    map.flyToBounds(bounds.pad(0.22), {
        maxZoom: Math.min(map.getZoom() + 2, 15),
        duration: 0.65,
        easeLinearity: 0.24,
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
        const nearby = nearbyLeads.some((item) => item.id === id);
        marker.setZIndexOffset(active ? 850 : selectedLead?.id === id ? 900 : nearby ? 500 : 0);
    }
}

function scrollLeadIntoView(id) {
    const row = document.querySelector(`.lead-row[data-id="${id}"]`);
    if (row) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function updateNearby() {
    if (!selectedLead || !hasCoordinates(selectedLead)) {
        nearbyLeads = [];
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

    if (!selectedLead) {
        els.selectedState.textContent = "—";
        els.selectedState.className = "tag tag--estado";
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
        els.leadHistory.innerHTML = "—";
        els.tagList.innerHTML = "—";
        els.addTag.disabled = true;
        if (els.leadNoteInput) els.leadNoteInput.value = "";
        if (els.addLeadNote) els.addLeadNote.disabled = true;
        return;
    }
    els.leadDetails.classList.remove("empty-state");
    els.addTag.disabled = false;
    if (els.addLeadNote) els.addLeadNote.disabled = false;
    const acc = document.getElementById("actionsAccordion");
    if (acc) acc.open = Boolean(selectedLead);
    els.selectedState.textContent = selectedLead.estado;
    els.selectedState.className = `tag tag--estado ${statusClass(selectedLead.estado)}`;
    const suggestion = commercialSuggestion(selectedLead);
    els.leadDetails.innerHTML = `
        <section class="lead-hero">
            <div class="lead-avatar" aria-hidden="true">${leadName(selectedLead).slice(0, 1).toUpperCase()}</div>
            <div>
                <h3>${leadName(selectedLead)}</h3>
                <p>${leadArea(selectedLead)} · ${selectedLead.telefone || "—"} · ${leadCity(selectedLead)}</p>
                <div class="lead-score-row">
                    <span class="priority-badge priority-badge--${scoreBand(selectedLead)}">${priorityLabel(selectedLead)} · ${scoreLabel(selectedLead)}</span>
                    <span class="tag">${leadCommercialLabel(selectedLead)}</span>
                </div>
                ${lastContactInfo(selectedLead) ? `<span class="contact-recency ${lastContactInfo(selectedLead).avoid ? "contact-recency--avoid" : ""}">${lastContactInfo(selectedLead).label}</span>` : ""}
            </div>
        </section>
        <dl class="lead-details-dl">
            ${detailLine("Nome Cliente", leadName(selectedLead))}
            ${detailLine("Área de negócio", leadArea(selectedLead))}
            ${detailLine("Contacto telefónico", selectedLead.telefone || "—")}
            ${detailLine("Cidade", leadCity(selectedLead))}
            ${detailLine("Empresa", selectedLead.empresa || selectedLead.nome_empresa || "—")}
            ${detailLine("Email", selectedLead.email || "—")}
            ${detailLine("Observações", selectedLead.observacoes || "—")}
            ${detailLine("Observações do contacto", selectedLead.observacoes_contacto || "—")}
            ${detailLine("Classificação", selectedLead.classificacao_observacao || "—")}
            ${detailLine("Motivo", selectedLead.motivo_classificacao || "—")}
            ${detailLine("Estado", selectedLead.estado)}
        </dl>
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
    els.leadHistory.innerHTML = selectedLead.historico?.length
        ? selectedLead.historico
              .map(
                  (item) =>
                      `<article class="history-item"><strong>${item.created_at} · ${item.acao}</strong><p>${item.observacao || ""}</p></article>`
              )
              .join("")
        : "Sem histórico.";
    els.tagList.innerHTML = selectedLead.tags?.length
        ? selectedLead.tags.map((tag) => `<span class="tag removable-tag" data-tag="${tag}">${tag} ×</span>`).join("")
        : "Sem tags.";
    document.querySelectorAll(".removable-tag").forEach((tag) => {
        tag.addEventListener("click", () => tagAction("remove_tag", tag.dataset.tag));
    });
}

function renderMapMiniCard() {
    if (!els.mapLeadMiniCard) return;
    if (!selectedLead) {
        els.mapLeadMiniCard.hidden = true;
        els.mapLeadMiniCard.innerHTML = "";
        return;
    }
    els.mapLeadMiniCard.hidden = false;
    els.mapLeadMiniCard.innerHTML = `
        <div class="map-mini-card__header">
            <div>
                <strong>${leadName(selectedLead)}</strong>
                <span>${leadCity(selectedLead)} · ${selectedLead.estado}</span>
            </div>
            <button type="button" class="map-mini-card__close" aria-label="Fechar">×</button>
        </div>
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

function detailLine(label, value) {
    return `<div class="detail-line"><dt>${label}</dt><dd>${value}</dd></div>`;
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
            <button class="link-button nearby-add" type="button" data-route-add="${lead.id}">Adicionar a rota</button>
        </article>
    `).join("");
    els.nearbyList.querySelectorAll("[data-route-add]").forEach((button) => {
        button.addEventListener("click", () => {
            selectedBulkIds.add(Number(button.dataset.routeAdd));
            if (selectedLead?.id) selectedBulkIds.add(selectedLead.id);
            renderLeadList();
            renderRouteDayList();
        });
    });
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
    const confirmations = {
        crm: "Confirmar que esta lead já foi tratada no CRM? A lead sai da lista ativa.",
        sem_interesse: "Confirmar Sem interesse? A lead deixa de aparecer na lista ativa.",
    };
    if (confirmations[action] && !confirm(confirmations[action])) return;
    const payload = { action, comercial_responsavel: selectedLead.comercial_responsavel, observacao: "" };
    if (action === "update_coordinates") {
        payload.latitude = prompt("Latitude:", selectedLead.latitude || "");
        payload.longitude = prompt("Longitude:", selectedLead.longitude || "");
    } else if (action === "corrigir_estado") {
        payload.estado = prompt("Novo estado:", selectedLead.estado) || selectedLead.estado;
        payload.observacao = prompt("Motivo da correcao:", "") || "";
    }
    if (action === "ligar_volta") {
        const when = prompt("Data para ligar de volta (AAAA-MM-DD):", todayIso);
        if (!when) return;
        payload.action = "adiar";
        payload.data_novo_contacto = when;
        payload.observacao = prompt("Motivo/observacao:", "Ligar de volta") || "Ligar de volta";
    } else if (action === "adiar") {
        payload.data_novo_contacto = prompt("Data de novo contacto (AAAA-MM-DD):", todayIso);
        payload.observacao = prompt("Motivo/observacao:", "Ligar mais tarde") || "";
    } else if (!["update_coordinates", "corrigir_estado"].includes(action)) {
        payload.observacao = prompt("Observacao opcional:", "") || "";
    }

    const response = await fetch(`/api/leads/${selectedLead.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        alert("Nao foi possivel atualizar a lead.");
        return;
    }
    await loadLeads();
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
        alert("Nao foi possivel guardar a nota.");
        return;
    }
    els.leadNoteInput.value = "";
    await loadLeads();
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
        alert("Não foi possível aplicar a ação em lote.");
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
    if (els.mapRouteSummary) {
        els.mapRouteSummary.hidden = true;
        els.mapRouteSummary.innerHTML = "";
    }
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
        alert("Seleciona pelo menos duas leads com coordenadas para desenhar uma rota.");
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
    if (els.mapRouteSummary) {
        els.mapRouteSummary.hidden = false;
        els.mapRouteSummary.innerHTML = `
            <strong>Rota inteligente</strong>
            <span>${route.length} leads · ${distance.toFixed(1)} km · ~${minutes} min</span>
            <button type="button" class="link-button" id="openSmartRouteMaps">Google Maps</button>
            <button type="button" class="link-button" id="clearSmartRoute">Limpar</button>
        `;
        document.getElementById("clearSmartRoute")?.addEventListener("click", clearSmartRoute);
        document.getElementById("openSmartRouteMaps")?.addEventListener("click", openRouteInMaps);
    }
    renderRouteDayList();
    markRouteHistory(route);
    map.flyToBounds(L.latLngBounds(points).pad(0.18), { duration: 0.65, easeLinearity: 0.24, maxZoom: 13 });
}

function resetFilters() {
    els.searchInput.value = "";
    els.localityFilter.value = "";
    els.typeFilter.value = "";
    if (els.commercialFilter) els.commercialFilter.value = "";
    els.stateFilter.value = "";
    els.classificationFilter.value = "ativos";
    if (els.scheduleFilter) els.scheduleFilter.value = "";
    if (els.territoryMode) els.territoryMode.value = "";
    els.tagFilter.value = "";
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
    [
        els.searchInput,
        els.localityFilter,
        els.typeFilter,
        els.commercialFilter,
        els.stateFilter,
        els.classificationFilter,
        els.scheduleFilter,
        els.tagFilter,
        els.territoryMode,
        els.historyFilter,
        els.heatmapToggle,
    ].filter(Boolean).forEach((element) => {
        element.addEventListener("input", applyFilters);
    });
    [els.historyFilter, els.heatmapToggle].filter(Boolean).forEach((element) => {
        element.addEventListener("change", applyFilters);
    });
    if (els.nearbyRadius) {
        els.nearbyRadius.addEventListener("input", () => {
            nearbyRadiusKm = Math.min(50, Math.max(1, Number(els.nearbyRadius.value) || DEFAULT_NEARBY_RADIUS_KM));
            updateRadiusUi();
            updateNearby();
            renderMarkers();
            renderDetails();
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
    if (els.bulkRoute) els.bulkRoute.addEventListener("click", drawSmartRoute);
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
    if (els.drawRouteDay) els.drawRouteDay.addEventListener("click", drawSmartRoute);
    if (els.openRouteMaps) els.openRouteMaps.addEventListener("click", openRouteInMaps);
    if (els.clearRouteDay) els.clearRouteDay.addEventListener("click", () => {
        selectedBulkIds = new Set();
        clearSmartRoute();
        renderLeadList();
    });
    if (els.leadListTabVisible) els.leadListTabVisible.addEventListener("click", () => setLeadListMode("visible"));
    if (els.leadListTabAll) els.leadListTabAll.addEventListener("click", () => setLeadListMode("all"));
    if (els.operationalMode) els.operationalMode.addEventListener("click", () => setMode("operational"));
    if (els.presentationMode) els.presentationMode.addEventListener("click", () => setMode("presentation"));
    if (els.addTag) els.addTag.addEventListener("click", () => tagAction("add_tag", els.tagSelect.value));
    document.querySelectorAll("[data-action]").forEach((button) => {
        button.addEventListener("click", () => performAction(button.dataset.action));
    });
    if (els.drawerClose) els.drawerClose.addEventListener("click", () => selectLead(null));
    if (els.drawerBackdrop) els.drawerBackdrop.addEventListener("click", () => selectLead(null));
    map.on("click", () => selectLead(null));
    map.on("moveend zoomend", renderMapGeoStats);
}

async function loadLeads() {
    const params = new URLSearchParams(window.location.search);
    const toFiniteNumber = (value) => {
        if (value === null || value === undefined) return Number.NaN;
        const trimmed = String(value).trim();
        if (!trimmed) return Number.NaN;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : Number.NaN;
    };
    const urlLeadId = toFiniteNumber(params.get("lead_id"));
    const urlLat = toFiniteNumber(params.get("lat"));
    const urlLng = toFiniteNumber(params.get("lng"));
    const currentId = selectedLead?.id || (Number.isFinite(urlLeadId) && urlLeadId > 0 ? urlLeadId : null);
    const response = await fetch("/api/leads?history=1");
    allLeads = (await response.json()).map((lead) => ({
        ...lead,
        id: Number(lead?.id),
        latitude: lead?.latitude === "" || lead?.latitude == null ? null : Number(lead.latitude),
        longitude: lead?.longitude === "" || lead?.longitude == null ? null : Number(lead.longitude),
    }));
    applyCityOffsets();
    if (currentId) {
        if (els.classificationFilter) els.classificationFilter.value = "";
        if (els.historyFilter) els.historyFilter.checked = true;
    }
    selectedLead = currentId ? allLeads.find((lead) => lead.id === currentId) || null : selectedLead;
    setDrawerOpen(Boolean(selectedLead));
    applyFilters();
    if (currentId && selectedLead) {
        const alreadyVisible = visibleLeads.some((lead) => lead.id === selectedLead.id);
        if (!alreadyVisible) {
            visibleLeads = [selectedLead, ...visibleLeads];
            renderMarkers();
        }
        selectLead(currentId);
        return;
    }
    if (Number.isFinite(urlLat) && Number.isFinite(urlLng)) {
        // Respeita deep-link com coordenadas, mas sem aproximar demasiado.
        map.flyTo([urlLat, urlLng], 11, { animate: true, duration: 0.7, easeLinearity: 0.24 });
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

    // Integra a pesquisa global do header (base.html) com os filtros do mapa.
    // O mapa usa els.searchInput (id="searchInput").
    const globalSearchInput = document.getElementById("globalSearchInput");
    const setSearchInputValue = (value) => {
        if (!els.searchInput) return;
        // evita loop desnecessário: só atribui se mudou
        if (els.searchInput.value !== value) {
            els.searchInput.value = value;
            // aplica filtro em tempo real
            applyFilters();
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
}

init();
