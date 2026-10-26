/* ==========================================================================
   SMIICE | app.js
   Dependencias (CDN, ver index.html): GSAP + ScrollTrigger, Lenis.
   Si alguna falla o el usuario pide reducir movimiento, la pagina funciona en modo estatico.

   INDICE
   01 Utilidades              08 Sectores (acordeon)     15 Intro del hero
   02 WhatsApp                09 Formulario              16 Interacciones (tilt, magnetico)
   03 Menu y anclas           10 Particulas del hero     17 Animaciones de scroll
   04 Navegacion              11 Rotador de palabras     18 Arranque
   05 FAQ                     12 Lenis
   06 Spotlight               13 Loader
   07 Marquee                 14 Preparacion inicial
   ========================================================================== */
(() => {
    'use strict';

    const WA_NUMBER = '5214464929602';
    const root = document.documentElement;
    const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const hasLibs = !!(window.gsap && window.ScrollTrigger);

    let motion = hasLibs && !reduceMQ.matches;
    let lenis = null;
    let gctx = null; /* gsap.context: permite revertir todo si algo falla */
    let menuOpen = false;
    let introDone = false;

    /* 01 UTILIDADES -------------------------------------------------------- */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
    const refreshST = debounce(() => { if (motion && window.ScrollTrigger) ScrollTrigger.refresh(); }, 600);

    /* Divide un titular en palabras con mascara (respeta etiquetas internas como .gold-text) */
    function splitWords(el) {
        const label = el.textContent.replace(/\s+/g, ' ').trim();
        const words = [];
        const walk = (node) => {
            Array.from(node.childNodes).forEach((child) => {
                if (child.nodeType === Node.TEXT_NODE) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach((part) => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const w = document.createElement('span');
                        w.className = 'w';
                        w.setAttribute('aria-hidden', 'true');
                        const wi = document.createElement('span');
                        wi.className = 'wi';
                        wi.textContent = part;
                        w.appendChild(wi);
                        frag.appendChild(w);
                        words.push(wi);
                    });
                    node.replaceChild(frag, child);
                } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
                    if (child.classList.contains('gold-text')) child.classList.add('is-split');
                    walk(child);
                }
            });
        };
        walk(el);
        el.setAttribute('aria-label', label);
        return words;
    }

    /* 02 WHATSAPP ---------------------------------------------------------- */
    const waUrl = (text) => `https://wa.me/${WA_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

    function initWhatsApp() {
        $$('[data-wa]').forEach((a) => {
            a.href = waUrl(a.dataset.wa);
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        });
        const y = $('#year');
        if (y) y.textContent = new Date().getFullYear();
    }

    function initWaTip() {
        const wa = $('#waFloat');
        if (!wa) return;
        wa.classList.add('is-in');
        setTimeout(() => {
            wa.classList.add('is-tip');
            setTimeout(() => wa.classList.remove('is-tip'), 4500);
        }, 5500);
    }

    /* 03 MENU Y ANCLAS ----------------------------------------------------- */
    const nav = $('#nav');
    const menu = $('#menu');
    const burger = $('#burger');

    function openMenu() {
        if (menuOpen || !menu) return;
        menuOpen = true;
        menu.removeAttribute('inert');
        menu.classList.add('is-open');
        burger.setAttribute('aria-expanded', 'true');
        burger.setAttribute('aria-label', 'Cerrar menú');
        root.classList.add('menu-open');
        nav.classList.remove('is-hidden');
        if (lenis) lenis.stop();
    }

    function closeMenu() {
        if (!menuOpen || !menu) return;
        menuOpen = false;
        menu.classList.remove('is-open');
        menu.setAttribute('inert', '');
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Abrir menú');
        root.classList.remove('menu-open');
        if (lenis) lenis.start();
    }

    function initMenu() {
        if (!burger || !menu) return;
        burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && menuOpen) { closeMenu(); burger.focus(); }
        });
        window.addEventListener('resize', debounce(() => {
            if (window.innerWidth >= 960) closeMenu();
        }, 150));
    }

    function initAnchors() {
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a[href^="#"]');
            if (!a) return;
            const id = a.getAttribute('href');
            if (id.length < 2) return;
            const target = document.querySelector(id);
            if (!target) return;
            e.preventDefault();
            const wasOpen = menuOpen;
            closeMenu();
            const go = () => {
                if (lenis) {
                    lenis.scrollTo(id === '#inicio' ? 0 : target, {
                        duration: 1.7,
                        offset: id === '#inicio' ? 0 : -4,
                        easing: (t) => 1 - Math.pow(1 - t, 4)
                    });
                } else {
                    target.scrollIntoView({ behavior: reduceMQ.matches ? 'auto' : 'smooth' });
                }
                history.replaceState(null, '', id);
            };
            wasOpen ? setTimeout(go, 350) : go();
        });
    }

    /* 04 NAVEGACION -------------------------------------------------------- */
    function initNavBasic() {
        if (!nav) return;
        /* Fondo de vidrio al salir del tope (sin listeners de scroll: IntersectionObserver) */
        const sentinel = document.createElement('div');
        sentinel.setAttribute('aria-hidden', 'true');
        sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:48px;pointer-events:none';
        document.body.prepend(sentinel);
        new IntersectionObserver(([e]) => nav.classList.toggle('is-stuck', !e.isIntersecting)).observe(sentinel);

        /* Enlace activo segun la seccion en el centro del viewport */
        const links = new Map($$('.nav__links a').map((a) => [a.dataset.nav, a]));
        const setCurrent = (id) => links.forEach((a, key) => a.classList.toggle('is-current', key === id));
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => { if (en.isIntersecting) setCurrent(en.target.id); });
        }, { rootMargin: '-45% 0px -50% 0px' });
        ['inicio', 'nosotros', 'trabajo', 'servicios', 'sectores', 'proceso', 'compromisos', 'preguntas', 'contacto']
            .forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
    }

    /* 05 FAQ --------------------------------------------------------------- */
    function initFaq() {
        const items = $$('.faq__item');
        items.forEach((item) => {
            const btn = $('.faq__q', item);
            btn.addEventListener('click', () => {
                const open = !item.classList.contains('is-open');
                items.forEach((it) => {
                    const on = it === item && open;
                    it.classList.toggle('is-open', on);
                    $('.faq__q', it).setAttribute('aria-expanded', String(on));
                });
                refreshST();
            });
        });
    }

    /* 06 SPOTLIGHT (la luz sigue al cursor sobre tarjetas) ----------------- */
    function initSpot() {
        if (!finePointer) return;
        $$('.spot').forEach((el) => {
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                el.style.setProperty('--mx', `${e.clientX - r.left}px`);
                el.style.setProperty('--my', `${e.clientY - r.top}px`);
            });
        });
    }

    /* 07 MARQUEE (acelera con la velocidad del scroll) -------------------- */
    function initMarquee() {
        const track = $('#marqueeTrack');
        if (!track || !lenis || !track.getAnimations) return;
        const anim = track.getAnimations()[0];
        if (!anim) return;
        let boost = 0;
        lenis.on('scroll', ({ velocity }) => { boost = Math.min(Math.abs(velocity) / 10, 5); });
        gsap.ticker.add(() => {
            boost *= 0.94;
            anim.playbackRate = 1 + boost;
        });
    }

    /* 08 SECTORES (acordeon de fotos con auto-avance) --------------------- */
    function initSectors() {
        const acc = $('#acc');
        if (!acc) return;
        const items = $$('.acc__item', acc);
        let current = 0;
        let timer = null;
        let byUser = false;

        const set = (i, user) => {
            if (user) { byUser = true; stop(); }
            if (i === current) return;
            current = i;
            items.forEach((it, k) => {
                const on = k === i;
                it.classList.toggle('is-active', on);
                $('.acc__trigger', it).setAttribute('aria-expanded', String(on));
            });
        };
        const stop = () => { clearInterval(timer); timer = null; };
        const start = () => {
            if (byUser || timer || reduceMQ.matches) return;
            timer = setInterval(() => set((current + 1) % items.length), 6500);
        };

        items.forEach((it, i) => {
            $('.acc__trigger', it).addEventListener('click', () => set(i, true));
            if (finePointer) {
                it.addEventListener('pointerenter', () => { if (window.innerWidth >= 960) set(i, true); });
            }
        });
        new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.45 }).observe(acc);
    }

    /* 09 FORMULARIO (valida y abre WhatsApp con el mensaje armado) -------- */
    function initForm() {
        const form = $('#quoteForm');
        if (!form) return;
        const fields = { name: $('#f-name'), phone: $('#f-phone'), service: $('#f-service'), msg: $('#f-msg') };
        const errs = { name: $('#e-name'), phone: $('#e-phone'), service: $('#e-service'), space: $('#e-space') };
        const spaceSet = $('.field--set', form);

        const setErr = (key, el, msg) => {
            errs[key].textContent = msg || '';
            if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
        };

        const validate = () => {
            let first = null;
            const name = fields.name.value.trim();
            if (name.length < 2) { setErr('name', fields.name, 'Escribe tu nombre para poder atenderte.'); first = first || fields.name; }
            else setErr('name', fields.name, '');

            const rawPhone = fields.phone.value.trim();
            const digits = rawPhone.replace(/\D/g, '');
            if (rawPhone && (digits.length < 10 || digits.length > 13)) { setErr('phone', fields.phone, 'Revisa tu número: debe tener 10 dígitos.'); first = first || fields.phone; }
            else setErr('phone', fields.phone, '');

            if (!fields.service.value) { setErr('service', fields.service, 'Elige el servicio que necesitas.'); first = first || fields.service; }
            else setErr('service', fields.service, '');

            const space = form.querySelector('input[name="space"]:checked');
            if (!space) {
                errs.space.textContent = 'Indica si es para hogar, comercio o industria.';
                spaceSet.classList.add('is-invalid');
                first = first || form.querySelector('input[name="space"]');
            } else {
                errs.space.textContent = '';
                spaceSet.classList.remove('is-invalid');
            }
            return { first, name, phone: rawPhone, service: fields.service.value, space: space ? space.value : '', msg: fields.msg.value.trim() };
        };

        /* Limpia el error en cuanto el campo vuelve a ser valido */
        form.addEventListener('input', (e) => {
            const t = e.target;
            if (t === fields.name && t.value.trim().length >= 2) setErr('name', t, '');
            if (t === fields.phone) setErr('phone', t, '');
            if (t === fields.service && t.value) setErr('service', t, '');
            if (t.name === 'space') { errs.space.textContent = ''; spaceSet.classList.remove('is-invalid'); }
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const v = validate();
            if (v.first) { v.first.focus(); return; }

            const lines = [
                'Hola SMIICE, quiero solicitar una cotización.',
                '',
                `*Nombre:* ${v.name}`,
                `*Servicio:* ${v.service}`,
                `*Tipo de espacio:* ${v.space}`
            ];
            if (v.phone) lines.push(`*Teléfono:* ${v.phone}`);
            if (v.msg) lines.push('', `*Detalles:* ${v.msg}`);
            const url = waUrl(lines.join('\n'));

            const btn = $('.form__submit', form);
            const label = $('.form__label', btn);
            const icon = $('i', btn);
            const prevLabel = label.textContent;
            btn.classList.add('is-busy');
            label.textContent = 'Abriendo WhatsApp...';
            icon.className = 'ph ph-circle-notch is-spinning';

            /* Se abre dentro del gesto del usuario para que los bloqueadores no lo frenen */
            window.open(url, '_blank', 'noopener');
            $('#formFallback').href = url;

            setTimeout(() => {
                btn.classList.remove('is-busy');
                label.textContent = prevLabel;
                icon.className = 'ph-fill ph-whatsapp-logo';
                $('#formOk').hidden = false;
                form.reset();
                refreshST();
            }, 1100);
        });
    }

    /* 10 PARTICULAS DEL HERO ----------------------------------------------- */
    function initParticles() {
        const canvas = $('#heroCanvas');
        const hero = $('.hero');
        if (!canvas || !hero) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const LINK = 128;
        const REPEL = 140;
        const mouse = { x: -9999, y: -9999 };
        let w = 0, h = 0, pts = [], raf = 0, running = false, visible = true;
        const rnd = (a, b) => a + Math.random() * (b - a);
        const make = () => ({ x: rnd(0, w), y: rnd(0, h), vx: rnd(-0.22, 0.22), vy: rnd(-0.22, 0.22), r: rnd(0.9, 2.4), gold: Math.random() < 0.6 });

        const draw = () => {
            ctx.clearRect(0, 0, w, h);
            for (let i = 0; i < pts.length; i++) {
                const p = pts[i];
                if (motion) {
                    p.x += p.vx; p.y += p.vy;
                    if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
                    if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
                    const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
                    if (d2 < REPEL * REPEL) {
                        const d = Math.sqrt(d2) || 1, f = (1 - d / REPEL) * 1.6;
                        p.x += (dx / d) * f; p.y += (dy / d) * f;
                    }
                }
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, 6.2832);
                ctx.fillStyle = p.gold ? 'rgba(208,154,37,.62)' : 'rgba(52,55,61,.32)';
                ctx.fill();
                for (let j = i + 1; j < pts.length; j++) {
                    const q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
                    if (d2 < LINK * LINK) {
                        const a = (1 - Math.sqrt(d2) / LINK) * 0.3;
                        ctx.strokeStyle = p.gold && q.gold ? `rgba(178,127,23,${a})` : `rgba(52,55,61,${a * 0.7})`;
                        ctx.lineWidth = 0.8;
                        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
                    }
                }
            }
        };
        const loop = () => { if (!running) return; draw(); raf = requestAnimationFrame(loop); };
        const start = () => { if (running || !motion || !visible || document.hidden) return; running = true; raf = requestAnimationFrame(loop); };
        const stop = () => { running = false; cancelAnimationFrame(raf); };

        const resize = () => {
            const r = canvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
            w = r.width; h = r.height;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            pts = Array.from({ length: clamp(Math.round((w * h) / 17000), 26, 84) }, make);
            if (!motion) draw();
        };

        resize();
        window.addEventListener('resize', debounce(resize, 200));
        hero.addEventListener('pointermove', (e) => {
            const r = canvas.getBoundingClientRect();
            mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
        });
        hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
        new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(hero);
        document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    }

    /* 11 ROTADOR DE PALABRAS DEL H1 --------------------------------------- */
    function startRotator() {
        const words = $$('.rot__w');
        if (words.length < 2) return;
        let i = 0;
        setInterval(() => {
            if (document.hidden) return;
            const cur = words[i];
            i = (i + 1) % words.length;
            const nxt = words[i];
            gsap.timeline()
                .to(cur, { yPercent: -105, opacity: 0, duration: 0.7, ease: 'expo.inOut' })
                .fromTo(nxt, { yPercent: 105, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.95, ease: 'expo.out' }, '-=0.45');
        }, 2700);
    }

    /* 12 LENIS (scroll suave) --------------------------------------------- */
    function initLenis() {
        if (typeof window.Lenis === 'undefined') return;
        lenis = new window.Lenis({
            duration: 1.25,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            wheelMultiplier: 0.9
        });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
        lenis.stop();
    }

    /* 13 LOADER ------------------------------------------------------------ */
    async function runLoaderProgress() {
        const num = $('#ldNum');
        const fill = $('.ld-hat-fill');
        const arc = $('.ld-arc');
        const C = 314.16;
        const state = { p: 0 };
        const render = () => {
            num.textContent = String(Math.round(state.p));
            fill.style.clipPath = `inset(${100 - state.p}% 0 0 0)`;
            arc.style.strokeDashoffset = String(C * (1 - state.p / 100));
        };
        render();

        /* El spinner simula el avance, pero no llega a 100 hasta que cargaron fuentes e imagenes (con tope de 7 s) */
        const loaded = Promise.all([
            document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true })),
            document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()
        ]);
        const cap = new Promise((r) => setTimeout(r, 7000));

        await gsap.to(state, { p: 88, duration: 1.9, ease: 'power2.out', onUpdate: render });
        await Promise.race([loaded, cap]);
        await gsap.to(state, { p: 100, duration: 0.55, ease: 'power2.inOut', onUpdate: render });
        await new Promise((r) => setTimeout(r, 220));
    }

    function exitLoader() {
        const loader = $('#loader');
        return new Promise((resolve) => {
            gsap.timeline({ onComplete: resolve })
                .to('.ld-mark, .ld-count, .ld-tag', { opacity: 0, y: -18, duration: 0.5, ease: 'power2.in', stagger: 0.05 })
                .to('.ld-panel--top', { yPercent: -101, duration: 1.15, ease: 'expo.inOut' }, '>-0.05')
                .to('.ld-panel--bottom', { yPercent: 101, duration: 1.15, ease: 'expo.inOut' }, '<')
                .add(() => gctx.add(heroIntro), '-=0.8')
                .add(() => {
                    if (loader) loader.remove();
                    root.classList.remove('is-loading');
                    if (lenis) lenis.start();
                }, '>');
        });
    }

    /* 14 PREPARACION INICIAL (estados de partida del hero, tapados por el loader) */
    function prepareIntro() {
        gsap.set('.hero__line-in', { yPercent: 118 });
        gsap.set('.rot__w', { yPercent: 105, opacity: 0 });
        gsap.set('.rot__w.is-on', { yPercent: 0, opacity: 1 });
        gsap.set('.pill, .hero__sub, .hero__cta > *', { opacity: 0, y: 24 });
        gsap.set('.hero__bg', { opacity: 0 });
        gsap.set('.nav__bar', { opacity: 0, y: -24 });
        gsap.set('.orbit__disc', { opacity: 0, scale: 0.6 });
        gsap.set('.orbit__halo', { opacity: 0 });
        gsap.set('.ring', { opacity: 0, scale: 0.82 });
        gsap.set('.node', { opacity: 0, scale: 0 });
        gsap.set('.orbit__core', { opacity: 0, scale: 0.7, y: 30 });
        gsap.set('.chip', { opacity: 0, y: 24 });
    }

    /* 15 INTRO DEL HERO ---------------------------------------------------- */
    function heroIntro() {
        gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: afterIntro })
            .to('.hero__bg', { opacity: 1, duration: 1.6, ease: 'power2.out' }, 0)
            .to('.nav__bar', { opacity: 1, y: 0, duration: 1.2 }, 0.2)
            .to('.pill', { opacity: 1, y: 0, duration: 1.1 }, 0.15)
            .to('.hero__line-in', { yPercent: 0, duration: 1.5, stagger: 0.14 }, 0.25)
            .to('.hero__sub', { opacity: 1, y: 0, duration: 1.2 }, 0.7)
            .to('.hero__cta > *', { opacity: 1, y: 0, duration: 1.2, stagger: 0.12 }, 0.85)
            .to('.orbit__disc', { opacity: 1, scale: 1, duration: 1.8 }, 0.2)
            .to('.orbit__halo', { opacity: 1, duration: 2 }, 0.3)
            .to('.ring', { opacity: 1, scale: 1, duration: 1.8, stagger: 0.14 }, 0.35)
            .to('.orbit__core', { opacity: 1, scale: 1, y: 0, duration: 1.8 }, 0.5)
            .to('.node', { opacity: 1, scale: 1, duration: 1.1, ease: 'back.out(2.2)', stagger: 0.09 }, 1.0)
            .to('.chip', { opacity: 1, y: 0, duration: 1.2, stagger: 0.14 }, 1.3);
    }

    function afterIntro() {
        introDone = true;
        initTilt();
        initMagnetic();
        startRotator();
        initWaTip();
    }

    /* 16 INTERACCIONES (solo con puntero fino) ----------------------------- */
    function initTilt() {
        if (!finePointer) return;
        const hero = $('.hero');
        const tilt = $('.orbit__tilt');
        if (!hero || !tilt) return;
        const rx = gsap.quickTo(tilt, 'rotationX', { duration: 1.1, ease: 'power3.out' });
        const ry = gsap.quickTo(tilt, 'rotationY', { duration: 1.1, ease: 'power3.out' });
        const layers = $$('[data-depth]', tilt).map((el) => ({
            d: parseFloat(el.dataset.depth),
            x: gsap.quickTo(el, 'x', { duration: 1.3, ease: 'power3.out' }),
            y: gsap.quickTo(el, 'y', { duration: 1.3, ease: 'power3.out' })
        }));
        hero.addEventListener('pointermove', (e) => {
            const r = hero.getBoundingClientRect();
            const nx = (e.clientX - r.left) / r.width - 0.5;
            const ny = (e.clientY - r.top) / r.height - 0.5;
            ry(nx * 10); rx(-ny * 10);
            layers.forEach((l) => { l.x(nx * l.d); l.y(ny * l.d); });
        });
        hero.addEventListener('pointerleave', () => {
            rx(0); ry(0);
            layers.forEach((l) => { l.x(0); l.y(0); });
        });
    }

    function initMagnetic() {
        if (!finePointer) return;
        $$('[data-magnetic]').forEach((btn) => {
            const xTo = gsap.quickTo(btn, 'x', { duration: 0.6, ease: 'power3.out' });
            const yTo = gsap.quickTo(btn, 'y', { duration: 0.6, ease: 'power3.out' });
            btn.addEventListener('pointermove', (e) => {
                const r = btn.getBoundingClientRect();
                xTo((e.clientX - (r.left + r.width / 2)) * 0.2);
                yTo((e.clientY - (r.top + r.height / 2)) * 0.28);
            });
            btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
        });
    }

    /* 17 ANIMACIONES DE SCROLL --------------------------------------------- */
    /* Orden importa: los pins (imagen que se abre y servicios) se crean antes que lo que va despues en la pagina,
       y llevan refreshPriority para que ScrollTrigger mida primero el espacio que ocupan. */
    function buildScroll() {
        /* Barra de progreso y navegacion que se esconde al bajar */
        const bar = $('.progress i');
        ScrollTrigger.create({
            start: 0, end: 'max',
            onUpdate: (self) => {
                if (bar) bar.style.transform = `scaleX(${self.progress})`;
                if (menuOpen) return;
                if (self.scroll() < 240 || self.direction === -1) nav.classList.remove('is-hidden');
                else nav.classList.add('is-hidden');
            }
        });

        /* Hero: profundidad al salir */
        gsap.to('.hero__copy', { yPercent: -7, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
        gsap.to('.hero__visual', { yPercent: -11, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

        /* Manifiesto: las palabras se encienden con el scroll */
        const mText = $('.manifesto__text');
        if (mText) {
            const mWords = splitWords(mText);
            gsap.to(mWords, {
                opacity: 1, ease: 'none', stagger: 0.12,
                scrollTrigger: { trigger: mText, start: 'top 80%', end: 'bottom 58%', scrub: true }
            });
        }

        /* Imagen que se abre a pantalla completa */
        const expand = $('.expand');
        if (expand) {
            const startClip = () => (window.innerWidth < 960 ? 'inset(40% 8% 12% 8% round 24px)' : 'inset(36% 27% 9% 27% round 32px)');
            const tl = gsap.timeline({
                defaults: { ease: 'none' },
                scrollTrigger: {
                    trigger: expand, start: 'top top', end: '+=150%', pin: $('.expand__pin', expand),
                    scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 2
                }
            });
            tl.fromTo('.expand__media', { clipPath: startClip }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'power2.inOut', duration: 1 }, 0)
                .fromTo('.expand__img', { scale: 1.35 }, { scale: 1, duration: 1 }, 0)
                .to('.expand__lead', { opacity: 0, y: -90, duration: 0.35, ease: 'power2.in' }, 0.08)
                .fromTo('.expand__scrim', { opacity: 0 }, { opacity: 1, duration: 0.45 }, 0.5)
                .fromTo('.expand__text', { opacity: 0, y: 44 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0.74)
                .fromTo('.expand__content .btn', { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' }, 0.9)
                .to({}, { duration: 0.35 });
        }

        /* Servicios: scroll horizontal fijado (escritorio) o tarjetas apiladas (movil) */
        const section = $('#servicios');
        if (section) {
            gsap.matchMedia().add('(min-width: 960px) and (min-height: 560px)', () => {
                const pin = $('.services__pin', section);
                const track = $('.services__track', section);
                const progress = $('.services__progress i', section);
                section.classList.add('is-hscroll');
                const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);

                const move = gsap.to(track, {
                    x: () => -dist(), ease: 'none',
                    scrollTrigger: {
                        trigger: pin, start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 0.8,
                        anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 1,
                        onUpdate: (self) => { progress.style.transform = `scaleX(${self.progress})`; }
                    }
                });
                /* Parallax de cada foto mientras cruza la pantalla */
                $$('.svc-card__media img', section).forEach((img) => {
                    gsap.fromTo(img, { xPercent: -7, scale: 1.22 }, {
                        xPercent: 7, ease: 'none',
                        scrollTrigger: { trigger: img.closest('.svc'), containerAnimation: move, start: 'left right', end: 'right left', scrub: true }
                    });
                });
                return () => section.classList.remove('is-hscroll');
            });
        }

        /* Titulares: revelado por palabras */
        $$('[data-split]').forEach((h) => {
            const words = splitWords(h);
            gsap.set(words, { yPercent: 115 });
            ScrollTrigger.create({
                trigger: h, start: 'top 88%', once: true,
                onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: 0.05 })
            });
        });

        /* Bloques que entran con el scroll */
        ScrollTrigger.batch('[data-reveal]', {
            start: 'top 90%', once: true,
            onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.15, ease: 'expo.out', stagger: 0.09, overwrite: 'auto' })
        });

        /* Cifras que cuentan */
        $$('[data-count]').forEach((el) => {
            const target = parseInt(el.dataset.count, 10);
            const obj = { v: 0 };
            el.textContent = '0';
            ScrollTrigger.create({
                trigger: el, start: 'top 90%', once: true,
                onEnter: () => gsap.to(obj, { v: target, duration: 1.8, ease: 'power3.out', onUpdate: () => { el.textContent = String(Math.round(obj.v)); } })
            });
        });

        /* Proceso: la linea se dibuja y cada paso se enciende */
        gsap.to('.steps__fill', {
            scaleY: 1, ease: 'none',
            scrollTrigger: { trigger: '.steps', start: 'top 62%', end: 'bottom 68%', scrub: 0.5 }
        });
        $$('.step').forEach((step) => {
            ScrollTrigger.create({
                trigger: step, start: 'top 64%',
                onEnter: () => step.classList.add('is-active'),
                onLeaveBack: () => step.classList.remove('is-active')
            });
        });

        /* Cierre: el casco se desplaza dentro de la tarjeta */
        gsap.fromTo('.cta__hat', { yPercent: 14, rotate: -7 }, {
            yPercent: -14, rotate: 4, ease: 'none',
            scrollTrigger: { trigger: '.cta__card', start: 'top bottom', end: 'bottom top', scrub: true }
        });

        /* Pie: el wordmark sube al llegar */
        gsap.from('.footer__word img', {
            yPercent: 40, ease: 'none',
            scrollTrigger: { trigger: '.footer__word', start: 'top bottom', end: 'bottom bottom', scrub: true }
        });

        initMarquee();
    }

    /* 18 ARRANQUE ---------------------------------------------------------- */
    function staticMode() {
        root.classList.remove('anim', 'is-loading');
        const loader = $('#loader');
        if (loader) loader.remove();
        initWaTip();
    }

    async function initMotion() {
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({ ignoreMobileResize: true });
        gctx = gsap.context(() => {});
        initLenis();
        gctx.add(prepareIntro);
        await runLoaderProgress();
        gctx.add(buildScroll);
        ScrollTrigger.refresh();
        await exitLoader();
    }

    function init() {
        initWhatsApp();
        initMenu();
        initAnchors();
        initNavBasic();
        initFaq();
        initSpot();
        initSectors();
        initForm();
        initParticles();

        if (!motion) { staticMode(); return; }
        initMotion().catch((err) => {
            /* Si algo falla, la pagina queda funcional y estatica */
            console.error('[SMIICE] Modo estatico por error de movimiento:', err);
            motion = false;
            if (gctx) gctx.revert();
            if (window.ScrollTrigger) ScrollTrigger.getAll().forEach((t) => t.kill());
            if (lenis) { lenis.destroy(); lenis = null; }
            staticMode();
        });
    }

    init();
})();
