const planningState = {
    radiusKm: 10,
    leads: [],
};

const planningEls = {
    radius: document.getElementById("planningRadius"),
    radiusValue: document.getElementById("planningRadiusValue"),
    radiusLabel: document.getElementById("planningRadiusLabel"),
    radiusText: document.getElementById("planningRadiusText"),
    planningRadiusInput: document.getElementById("planningRadiusInput"),
    cards: Array.from(document.querySelectorAll("[data-meeting-card]")),
};

const excludedPlanningStates = ["Reunião marcada", "Sem interesse definitivo", "Cliente existente"];

function toRadians(value) {
    return (value * Math.PI) / 180;
}

function haversineKm(a, b) {
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

function hasCoordinates(item) {
    return Number.isFinite(item.latitude) && Number.isFinite(item.longitude);
}

function leadName(lead) {
    return lead.nome_cliente || lead.nome_empresa || "Sem nome";
}

function leadArea(lead) {
    return lead.area_negocio || lead.tipo_cliente || "Outro";
}

function leadCity(lead) {
    return lead.cidade || lead.localidade || "Sem cidade";
}

function parseCoordinate(value) {
    if (value === null || value === undefined || String(value).trim() === "") return NaN;
    return Number(value);
}

function readMeeting(card) {
    return {
        id: Number(card.dataset.meetingId),
        name: card.dataset.name || "Lead",
        city: card.dataset.city || "Sem cidade",
        state: card.dataset.state || "Reunião marcada",
        latitude: parseCoordinate(card.dataset.latitude),
        longitude: parseCoordinate(card.dataset.longitude),
    };
}

function updateRadiusUi() {
    if (planningEls.radius) planningEls.radius.value = planningState.radiusKm;
    if (planningEls.radiusValue) planningEls.radiusValue.textContent = planningState.radiusKm;
    if (planningEls.radiusLabel) planningEls.radiusLabel.textContent = planningState.radiusKm;
    if (planningEls.planningRadiusInput) planningEls.planningRadiusInput.value = planningState.radiusKm;
    if (planningEls.radiusText) {
        planningEls.radiusText.textContent = `A página está a mostrar leads próximas num raio de ${planningState.radiusKm} km.`;
    }
}

function nearbyForMeeting(meeting) {
    if (!hasCoordinates(meeting)) return [];
    return planningState.leads
        .filter((lead) => {
            if (lead.id === meeting.id) return false;
            if (!hasCoordinates(lead)) return false;
            if (lead.ativa !== true) return false;
            if (excludedPlanningStates.includes(lead.estado)) return false;
            return true;
        })
        .map((lead) => ({ ...lead, distanceKm: haversineKm(meeting, lead) }))
        .filter((lead) => lead.distanceKm <= planningState.radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
}

function renderCard(card) {
    const meeting = readMeeting(card);
    const list = card.querySelector("[data-nearby-list]");
    const count = card.querySelector("[data-nearby-count]");
    const openLabel = card.querySelector(".planning-open-label");
    const dynamicNearby = planningState.leads.length ? nearbyForMeeting(meeting) : [];

    if (count && planningState.leads.length) {
        count.textContent = `${dynamicNearby.length} leads próximas`;
    }
    if (openLabel) {
        openLabel.textContent = card.open ? "Fechar" : "Abrir";
    }
    if (!list) return;

    if (!planningState.leads.length || !hasCoordinates(meeting)) {
        filterServerFallback(list, count);
        return;
    }

    if (dynamicNearby.length === 0) {
        list.innerHTML = `<p class="muted">Sem leads ativas num raio de ${planningState.radiusKm} km.</p>`;
        return;
    }

    list.innerHTML = dynamicNearby.slice(0, 12).map((lead) => `
        <div class="planning-nearby-row" data-distance="${lead.distanceKm.toFixed(1)}">
            <span>${leadName(lead)}</span>
            <strong>${lead.distanceKm.toFixed(1)} km</strong>
            <small>${leadArea(lead)} · ${lead.telefone || "—"} · ${leadCity(lead)}</small>
            <button class="link-button" type="button">Adicionar ao plano</button>
        </div>
    `).join("");
}

function filterServerFallback(list, count) {
    const rows = Array.from(list.querySelectorAll("[data-distance]"));
    let visible = 0;
    rows.forEach((row) => {
        const distance = Number(row.dataset.distance);
        const show = Number.isFinite(distance) && distance <= planningState.radiusKm;
        row.hidden = !show;
        if (show) visible += 1;
    });
    if (count) count.textContent = `${visible} leads próximas`;
}

function renderPlanning() {
    updateRadiusUi();
    planningEls.cards.forEach(renderCard);
}

function bindPlanning() {
    if (planningEls.radius) {
        planningEls.radius.addEventListener("input", () => {
            planningState.radiusKm = Math.min(50, Math.max(1, Number(planningEls.radius.value) || 10));
            renderPlanning();
        });
    }
    planningEls.cards.forEach((card) => {
        card.addEventListener("toggle", () => renderCard(card));
    });
}

async function loadPlanningLeads() {
    try {
        const response = await fetch("/api/leads?history=1");
        if (!response.ok) return;
        planningState.leads = await response.json();
        renderPlanning();
    } catch (error) {
        renderPlanning();
    }
}

bindPlanning();
renderPlanning();
loadPlanningLeads();
