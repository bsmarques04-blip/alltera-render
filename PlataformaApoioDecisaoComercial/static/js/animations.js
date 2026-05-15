(function () {
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canHover = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const animateCount = (el) => {
        if (!el || el.dataset.countAnimated === "1") return;
        const target = Number(el.dataset.countTo ?? el.textContent ?? 0);
        if (!Number.isFinite(target)) return;
        el.dataset.countAnimated = "1";

        if (reduceMotion) {
            el.textContent = String(target);
            return;
        }

        const duration = 2100;
        const start = performance.now();
        const step = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            el.textContent = String(Math.round(target * easeOutCubic(progress)));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };

    const initCounters = () => {
        const counters = document.querySelectorAll("[data-count-to]");
        if (!counters.length) return;

        if (!("IntersectionObserver" in window)) {
            counters.forEach(animateCount);
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                animateCount(entry.target);
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.35 });

        counters.forEach((counter) => observer.observe(counter));
    };

    const initPageTransitions = () => {
        const shell = document.querySelector(".app-shell__content");
        if (!shell) return;

        shell.classList.add("page-enter");
        requestAnimationFrame(() => shell.classList.add("page-enter--active"));

        if (reduceMotion) return;
        document.addEventListener("click", (event) => {
            const link = event.target.closest("a[href]");
            if (!link || link.target || link.hasAttribute("download")) return;
            const href = link.getAttribute("href");
            if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

            const url = new URL(href, window.location.href);
            if (url.origin !== window.location.origin || url.pathname === window.location.pathname && url.search === window.location.search) return;

            event.preventDefault();
            shell.classList.add("page-exit");
            window.setTimeout(() => {
                window.location.href = url.href;
            }, 140);
        });
    };

    const initStagger = () => {
        const selectors = [
            ".dashboard-metrics > article",
            ".dashboard-masonry > article",
            ".dashboard-list > *",
            ".lead-list--compact .lead-row",
            ".history-list--compact .history-item",
            ".day-lead-list > *",
            ".nearby-list--compact .nearby-row",
            ".table-card tbody tr",
        ];

        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((item, index) => {
                item.classList.add("stagger-item");
                item.style.setProperty("--stagger-delay", `${Math.min(index * 46, 420)}ms`);
            });
        });
    };

    const initScrollReveal = () => {
        const items = document.querySelectorAll(".panel, .metric-grid article, .dashboard-card, .table-card, .empty-state");
        if (!items.length || reduceMotion || !("IntersectionObserver" in window)) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("reveal-in");
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });

        items.forEach((item) => {
            item.classList.add("reveal-item");
            observer.observe(item);
        });
    };

    const initSpotlight = () => {
        const dashboard = document.querySelector(".dashboard-page");
        if (!dashboard || !canHover || reduceMotion) return;

        dashboard.addEventListener("pointermove", (event) => {
            const rect = dashboard.getBoundingClientRect();
            dashboard.style.setProperty("--spotlight-x", `${event.clientX - rect.left}px`);
            dashboard.style.setProperty("--spotlight-y", `${event.clientY - rect.top}px`);
            dashboard.classList.add("has-spotlight");
        });

        dashboard.addEventListener("pointerleave", () => dashboard.classList.remove("has-spotlight"));
    };

    const initRipples = () => {
        document.addEventListener("click", (event) => {
            const button = event.target.closest(".button, .link-button, .theme-toggle, button[type='submit'], .primary-action");
            if (!button || reduceMotion) return;

            const rect = button.getBoundingClientRect();
            const ripple = document.createElement("span");
            ripple.className = "button-ripple";
            ripple.style.left = `${event.clientX - rect.left}px`;
            ripple.style.top = `${event.clientY - rect.top}px`;
            button.appendChild(ripple);
            window.setTimeout(() => ripple.remove(), 560);
        });
    };

    const initMagneticButtons = () => {
        if (!canHover || reduceMotion) return;
        document.querySelectorAll(".dashboard-actions .button, .primary-action").forEach((button) => {
            button.addEventListener("pointermove", (event) => {
                const rect = button.getBoundingClientRect();
                const x = (event.clientX - rect.left - rect.width / 2) * 0.08;
                const y = (event.clientY - rect.top - rect.height / 2) * 0.12;
                button.style.setProperty("--magnet-x", `${x}px`);
                button.style.setProperty("--magnet-y", `${y}px`);
            });
            button.addEventListener("pointerleave", () => {
                button.style.setProperty("--magnet-x", "0px");
                button.style.setProperty("--magnet-y", "0px");
            });
        });
    };

    const initSearchBar = () => {
        const search = document.querySelector(".global-search");
        if (!search) return;
        const input = search.querySelector("input");
        if (!input) return;
        const sync = () => search.classList.toggle("is-focused", document.activeElement === input);
        input.addEventListener("focus", sync);
        input.addEventListener("blur", sync);
        input.addEventListener("input", sync);
    };

    const initToasts = () => {
        document.querySelectorAll(".toast").forEach((toast, index) => {
            toast.style.setProperty("--toast-index", String(index));
            toast.classList.add("toast--animated");
        });

        window.AllteraToast = (message, type = "info") => {
            const wrap = document.querySelector(".toast-wrap") || document.body.appendChild(document.createElement("section"));
            wrap.classList.add("toast-wrap");
            const toast = document.createElement("div");
            toast.className = `toast toast--${type} toast--animated`;
            toast.innerHTML = `<div class="toast__dot" aria-hidden="true"></div><div class="toast__text"></div><button type="button" class="toast__close" aria-label="Fechar">&times;</button>`;
            toast.querySelector(".toast__text").textContent = message;
            wrap.appendChild(toast);
            const hide = () => {
                toast.classList.add("toast--hide");
                window.setTimeout(() => toast.remove(), 220);
            };
            toast.querySelector(".toast__close").addEventListener("click", hide);
            window.setTimeout(hide, 4200);
        };
    };

    const applyStoredOrder = (container, key) => {
        const stored = JSON.parse(localStorage.getItem(key) || "[]");
        if (!Array.isArray(stored) || !stored.length) return;

        const items = new Map([...container.children].map((item) => [item.dataset.dashboardCard, item]));
        stored.forEach((id) => {
            const item = items.get(id);
            if (item) container.appendChild(item);
        });
    };

    const initDashboardSort = () => {
        if (!window.Sortable) return;
        document.querySelectorAll("[data-dashboard-sortable]").forEach((container) => {
            const name = container.dataset.dashboardSortable;
            const key = `alltera.dashboard.order.${name}`;
            applyStoredOrder(container, key);

            window.Sortable.create(container, {
                animation: 220,
                delay: 70,
                delayOnTouchOnly: true,
                draggable: "[data-dashboard-card]",
                chosenClass: "dashboard-drag-chosen",
                ghostClass: "dashboard-drag-ghost",
                dragClass: "dashboard-dragging",
                onStart: () => document.body.classList.add("dashboard-is-dragging"),
                onEnd: () => {
                    document.body.classList.remove("dashboard-is-dragging");
                    const order = [...container.querySelectorAll("[data-dashboard-card]")].map((item) => item.dataset.dashboardCard);
                    localStorage.setItem(key, JSON.stringify(order));
                },
            });
        });
    };

    const initCursor = () => {
        if (!canHover || reduceMotion) return;
        const cursor = document.createElement("div");
        cursor.className = "premium-cursor";
        document.body.appendChild(cursor);
        document.addEventListener("pointermove", (event) => {
            cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
        });
        document.addEventListener("pointerover", (event) => {
            cursor.classList.toggle("is-active", Boolean(event.target.closest("a, button, input, select, textarea, .panel, .dashboard-card")));
        });
    };

    const initSidebar = () => {
        const sidebar = document.querySelector(".sidebar");
        if (sidebar) sidebar.classList.add("sidebar-enter");
        const toggle = document.getElementById("sidebarToggle");
        if (!toggle) return;
        toggle.addEventListener("click", () => {
            document.body.classList.add("sidebar-is-collapsing");
            window.setTimeout(() => document.body.classList.remove("sidebar-is-collapsing"), 300);
        });
    };

    const initSkeletons = () => {
        document.querySelectorAll(".skeleton").forEach((el) => el.classList.add("skeleton--animated"));
        document.body.classList.add("page-loaded");
    };

    const initMarkerEffects = () => {
        document.body.classList.add("marker-glow-ready");
    };

    const init = () => {
        initPageTransitions();
        initCounters();
        initStagger();
        initScrollReveal();
        initSpotlight();
        initRipples();
        initMagneticButtons();
        initSearchBar();
        initToasts();
        initDashboardSort();
        initCursor();
        initSidebar();
        initSkeletons();
        initMarkerEffects();
    };

    document.addEventListener("DOMContentLoaded", init);
})();
