(function () {
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const animateCount = (el) => {
        if (!el || el.dataset.countAnimated === "1") return;
        const target = Number(el.dataset.countTo ?? el.textContent ?? 0);
        if (!Number.isFinite(target)) return;
        el.dataset.countAnimated = "1";
        if (reduceMotion) {
            el.textContent = String(target);
            return;
        }
        const duration = 1900;
        const start = performance.now();
        const step = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = String(Math.round(target * eased));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };

    const animateCounters = () => {
        document.querySelectorAll("[data-count-to]").forEach(animateCount);
    };

    const animatePageEnter = () => {
        const shell = document.querySelector(".app-shell__content");
        if (!shell) return;
        shell.classList.add("page-enter");
        requestAnimationFrame(() => shell.classList.add("page-enter--active"));
    };

    const animateStagger = () => {
        const groups = [
            ".lead-list--compact .lead-row",
            ".history-list--compact .history-item",
            ".dashboard-list > *",
            ".day-lead-list > *",
            ".nearby-list--compact .nearby-row",
        ];
        groups.forEach((selector) => {
            document.querySelectorAll(selector).forEach((item, index) => {
                item.classList.add("stagger-item");
                item.style.setProperty("--stagger-delay", `${index * 60}ms`);
            });
        });
    };

    const animateSkeletons = () => {
        document.querySelectorAll(".skeleton").forEach((el) => el.classList.add("skeleton--animated"));
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
    };

    const initSidebar = () => {
        const toggle = document.getElementById("sidebarToggle");
        if (!toggle) return;
        toggle.addEventListener("click", () => {
            document.body.classList.add("sidebar-is-collapsing");
            window.setTimeout(() => document.body.classList.remove("sidebar-is-collapsing"), 280);
        });
    };

    const initMarkerGlow = () => {
        document.body.classList.add("marker-glow-ready");
    };

    const init = () => {
        animatePageEnter();
        animateCounters();
        animateStagger();
        animateSkeletons();
        initSearchBar();
        initToasts();
        initSidebar();
        initMarkerGlow();
    };

    document.addEventListener("DOMContentLoaded", init);
})();
