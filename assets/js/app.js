/* Evernest front-end: nav, cart drawer, checkout, event tracking, PDP, fun bits. No dependencies. */
(function () {
  "use strict";
  var CFG = window.EVERNEST || {};
  var doc = document, root = doc.documentElement;
  root.classList.add("js");
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var rupee = CFG.CURRENCY || "₹";
  function money(n) { return rupee + Number(n).toLocaleString("en-IN"); }
  function safe(fn) { try { return fn(); } catch (e) { return null; } }

  /* ---------- Meta Pixel ---------- */
  var STD_EVENTS = { PageView: 1, ViewContent: 1, Search: 1, AddToCart: 1, InitiateCheckout: 1, Lead: 1, Contact: 1 };
  /* events that are also sent from the server (Conversions API). PageView stays browser-only on purpose. */
  var CAPI_EVENTS = { ViewContent: 1, Search: 1, AddToCart: 1, ViewCart: 1, InitiateCheckout: 1, Lead: 1, Contact: 1 };
  function evId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function cookie(n) { var m = doc.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : ""; }
  function fbIds() {
    var fbp = cookie("_fbp"), fbc = cookie("_fbc");
    if (!fbc) { var c = safe(function () { return sessionStorage.getItem("evn_fbclid"); }); if (c) fbc = "fb.1." + Date.now() + "." + c; }
    return { fbp: fbp, fbc: fbc };
  }
  /* track(event, data, user): one shared event_id goes to the Pixel and to the server copy, so Meta counts it once.
     user (optional) = { email, phone, name, pin } for Lead and Contact, used for Meta's customer matching. */
  function track(evt, data, user) {
    var id = evId(), d = data || {}, u = user || null;
    if (window.fbq) {
      safe(function () {
        if (u && CFG.PIXEL_ID) {
          var nm = String(u.name || "").trim().toLowerCase().split(/\s+/), am = { country: "in" };
          if (u.email) am.em = String(u.email).trim().toLowerCase();
          if (u.phone) am.ph = String(u.phone).replace(/\D/g, "");
          if (nm[0]) am.fn = nm[0]; if (nm.length > 1) am.ln = nm[nm.length - 1];
          if (u.pin) am.zp = String(u.pin);
          window.fbq("init", CFG.PIXEL_ID, am);
        }
        window.fbq(STD_EVENTS[evt] ? "track" : "trackCustom", evt, d, { eventID: id });
      });
    }
    if (CAPI_EVENTS[evt] && CFG.CAPI !== false && CFG.PIXEL_ID && CFG.LEAD_ENDPOINT && !isLocal) {
      safe(function () {
        var f = fbIds();
        fetch(CFG.LEAD_ENDPOINT, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, keepalive: true,
          body: JSON.stringify({ capi: 1, event_name: evt, event_id: id, event_time: Math.floor(Date.now() / 1000), event_source_url: location.href,
            user_agent: navigator.userAgent, fbp: f.fbp, fbc: f.fbc, session: sid, user: u || undefined, custom_data: d }) }).catch(function () { });
      });
    }
  }
  if (CFG.PIXEL_ID && /^\d+$/.test(CFG.PIXEL_ID)) {
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, doc, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", CFG.PIXEL_ID); window.fbq("track", "PageView");
  }

  /* ---------- Attribution capture (for traffic tests) ---------- */
  var attr = {};
  safe(function () {
    var q = new URLSearchParams(location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "ad_id", "adset_id", "campaign_id", "placement"].forEach(function (k) {
      if (q.get(k)) sessionStorage.setItem("evn_" + k, q.get(k));
    });
    if (!sessionStorage.getItem("evn_landing")) sessionStorage.setItem("evn_landing", location.href);
    if (!sessionStorage.getItem("evn_ref")) sessionStorage.setItem("evn_ref", doc.referrer || "");
  });
  function getAttr() {
    var o = {};
    safe(function () {
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "ad_id", "adset_id", "campaign_id", "placement"].forEach(function (k) {
        var v = sessionStorage.getItem("evn_" + k); if (v) o[k] = v;
      });
      o.landing_url = sessionStorage.getItem("evn_landing") || location.href;
      o.referrer = sessionStorage.getItem("evn_ref") || "";
    });
    return o;
  }

  /* ---------- Mobile nav ---------- */
  var burger = $(".burger"), nav = $("#nav");
  if (burger && nav) {
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", open);
      doc.body.style.overflow = open ? "hidden" : "";
    });
    $$("a", nav).forEach(function (a) { a.addEventListener("click", function () { nav.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); doc.body.style.overflow = ""; }); });
  }

  /* ---------- Scroll reveal ---------- */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: .12, rootMargin: "0px 0px -40px 0px" });
    /* auto-tag headings, leads and card grids that are below the fold so they rise in once, with a stagger of 80ms */
    var vh0 = window.innerHeight;
    if (!reduce) {
      $$(".pgrid, .why, .pdp-related, .stack-cards").forEach(function (g) {
        if (g.getBoundingClientRect().top < vh0) return;
        Array.prototype.slice.call(g.children).forEach(function (k, i) { if (!k.classList.contains("reveal")) { k.classList.add("reveal"); k.style.transitionDelay = (i * 80) + "ms"; } else if (!k.style.transitionDelay) k.style.transitionDelay = (i * 80) + "ms"; });
      });
    }
    $$(".reveal,[data-io]").forEach(function (el) { io.observe(el); });
    /* count-up: prices and the free delivery threshold tick up from zero when they scroll into view */
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        var el = e.target, m = el.textContent.match(/^(\D*)([\d,]+)(.*)$/); if (!m) return;
        var end = +m[2].replace(/,/g, ""), t0 = null;
        function step(ts) {
          if (t0 === null) t0 = ts;
          var k = Math.min((ts - t0) / 1100, 1), v = Math.round(end * (1 - Math.pow(1 - k, 3)));
          el.textContent = m[1] + v.toLocaleString("en-IN") + m[3];
          if (k < 1) requestAnimationFrame(step); else el.textContent = m[1] + m[2] + m[3];
        }
        requestAnimationFrame(step);
      });
    }, { threshold: .6 });
    if (!reduce) $$(".pgrid .price .now, .trio .price .now").forEach(function (el) { if (!el.id && /^\D*[\d,]+$/.test(el.textContent.trim())) cio.observe(el); });
  } else { $$(".reveal,[data-io]").forEach(function (el) { el.classList.add("in"); }); }

  /* ---------- Motion helpers ---------- */
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* header: compact + shadow after scroll */
  var hdr = $(".site-header");
  if (hdr) {
    var tick = false;
    var onScroll = function () { hdr.classList.toggle("scrolled", window.scrollY > 24); tick = false; };
    window.addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  }
  /* hero: floating gummies drift with the pointer (desktop only) */
  var heroArt = $("#hero-art");
  if (heroArt && !reduce && window.matchMedia("(pointer:fine)").matches) {
    var fls = $$(".fl", heroArt), raf = 0, tx = 0, ty = 0;
    heroArt.addEventListener("pointermove", function (e) {
      var r = heroArt.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width - .5; ty = (e.clientY - r.top) / r.height - .5;
      if (!raf) raf = requestAnimationFrame(function () {
        raf = 0; fls.forEach(function (f) { var d = +f.dataset.depth || 10; f.style.transform = "translate(" + (tx * d).toFixed(1) + "px," + (ty * d).toFixed(1) + "px)"; });
      });
    });
    heroArt.addEventListener("pointerleave", function () { fls.forEach(function (f) { f.style.transform = ""; }); });
  }
  /* fly-to-cart: product image arcs into the cart icon, badge pops, then the form opens */
  function flyToCart(srcEl, done) {
    window.dispatchEvent(new CustomEvent("evn:add"));
    var cartBtn = $(".cart-btn");
    if (!reduce && cartBtn) { var cb = cartBtn.getBoundingClientRect(); setTimeout(function () { confetti(cb.left + cb.width / 2, cb.top + cb.height / 2); }, 650); }
    if (reduce || !srcEl || !cartBtn || !srcEl.animate) { done(); return; }
    var a = srcEl.getBoundingClientRect(), b = cartBtn.getBoundingClientRect();
    if (!a.width) { done(); return; }
    var clone = doc.createElement("img"); clone.className = "fly"; clone.src = srcEl.currentSrc || srcEl.src; clone.alt = "";
    var w = Math.min(a.width, 150), x0 = a.left + a.width / 2 - w / 2, y0 = a.top + a.height / 2 - w / 2;
    clone.style.width = clone.style.height = w + "px"; clone.style.left = x0 + "px"; clone.style.top = y0 + "px";
    doc.body.appendChild(clone);
    var dx = b.left + b.width / 2 - (x0 + w / 2), dy = b.top + b.height / 2 - (y0 + w / 2);
    var anim = clone.animate([
      { transform: "translate(0,0) scale(1) rotate(0)", opacity: 1 },
      { transform: "translate(" + dx * .45 + "px," + (dy * .45 - 90) + "px) scale(.7) rotate(-8deg)", opacity: 1, offset: .5 },
      { transform: "translate(" + dx + "px," + dy + "px) scale(.12) rotate(14deg)", opacity: .6 }
    ], { duration: 720, easing: "cubic-bezier(.5,0,.75,.4)" });
    anim.onfinish = function () {
      clone.remove();
      $$(".cart-badge").forEach(function (bd) { bd.classList.remove("pop"); void bd.offsetWidth; bd.classList.add("pop"); });
      done();
    };
  }

  /* ---------- Confetti + mascot ---------- */
  function confetti(x, y) {
    var cols = ["#FFCF21", "#FF5A6B", "#028635", "#7ED957", "#7CD3FF", "#FF9A2E"];
    for (var i = 0; i < 26; i++) {
      var c = doc.createElement("i"); c.className = "confetti";
      c.style.left = x + "px"; c.style.top = y + "px"; c.style.background = cols[i % cols.length];
      c.style.setProperty("--dx", (Math.random() * 360 - 180) + "px");
      c.style.setProperty("--dy", (Math.random() * 300 - 80) + "px");
      c.style.setProperty("--rr", (Math.random() * 720 - 360) + "deg");
      doc.body.appendChild(c); setTimeout(function (el) { el.remove(); }.bind(null, c), 1400);
    }
  }
  $$(".mascot").forEach(function (m) {
    m.addEventListener("click", function (e) {
      m.classList.remove("hop"); void m.getBoundingClientRect(); m.classList.add("hop");
      var r = m.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 3);
    });
  });
  $$(".mission").forEach(function (el) {
    el.addEventListener("click", function () {
      el.classList.toggle("done");
      var all = $$(".mission"), n = all.filter(function (x) { return x.classList.contains("done"); }).length;
      var bar = $(".mbar i"), t = $(".mtxt");
      if (bar) bar.style.width = (n / all.length * 100) + "%";
      if (t) t.textContent = n === all.length ? "Super star! All missions done!" : n + " of " + all.length + " missions done";
      if (el.classList.contains("done")) { var r = el.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + 20); }
    });
  });

  /* ---------- Event tracking ----------
     Every key step is logged: add_to_cart, cart_open, checkout_click (cart button), checkout_submit (form), contact.
     Sent to LEAD_ENDPOINT (Google Sheet via Apps Script) when set. With no endpoint, the three key events
     (checkout_click, checkout_submit, contact) go to Netlify Forms as a fallback. Always kept in this browser too. */
  var NL_FIELDS = ["event", "ref", "session", "source", "name", "email", "phone", "pincode", "items_text", "total", "message", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "ad_id", "adset_id", "campaign_id", "placement", "landing_url", "referrer", "page"];
  var sid = safe(function () { var s = sessionStorage.getItem("evn_sid"); if (!s) { s = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("evn_sid", s); } return s; }) || "na";
  var isLocal = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === "file:";
  function logLocal(p) { safe(function () { var all = JSON.parse(localStorage.getItem("evn_leads") || "[]"); all.push(p); localStorage.setItem("evn_leads", JSON.stringify(all.slice(-60))); }); }
  function nlPost(p) {
    var body = new URLSearchParams(); body.append("form-name", "evernest-events");
    NL_FIELDS.forEach(function (k) { body.append(k, p[k] == null ? "" : String(p[k])); });
    return fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(), keepalive: true }).catch(function () { });
  }
  function send(payload, viaNetlify) {
    logLocal(payload);
    if (CFG.LEAD_ENDPOINT) {
      return fetch(CFG.LEAD_ENDPOINT, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload), keepalive: true }).catch(function () { });
    }
    if (isLocal || !viaNetlify) { if (window.console && isLocal) console.info("[Evernest test mode] event kept in this browser only:", payload.event, payload); return Promise.resolve(); }
    return nlPost(payload);
  }
  var KEY_EVENTS = { checkout_click: 1, checkout_submit: 1, contact: 1 };
  function emit(evt, data) {
    var p = Object.assign({ timestamp: new Date().toISOString(), event: evt, session: sid, page: location.pathname }, data || {}, getAttr());
    return send(p, !!KEY_EVENTS[evt]);
  }

  /* ---------- Cart (sessionStorage) ---------- */
  var cart = safe(function () { return JSON.parse(sessionStorage.getItem("evn_cart2") || "[]"); }) || [];
  var drawer = $("#cart-drawer"), co = $("#checkout");
  var FREE = drawer ? +drawer.dataset.free || 499 : 499, FEE = drawer ? +drawer.dataset.fee || 49 : 49;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function subtotal() { return cart.reduce(function (a, i) { return a + i.price * i.qty; }, 0); }
  function mrpTotal() { return cart.reduce(function (a, i) { return a + (i.mrp || i.price) * i.qty; }, 0); }
  function count() { return cart.reduce(function (a, i) { return a + i.qty; }, 0); }
  function shipping(sub) { return sub === 0 || sub >= FREE ? 0 : FEE; }
  function cartContents() { return cart.map(function (i) { return { id: i.product, quantity: i.qty, item_price: i.price }; }); }
  function itemsText() { return cart.map(function (i) { return i.name + (i.variant ? " (" + i.variant + ")" : "") + " | " + i.packLabel + " x" + i.qty + (i.age ? " | age " + i.age : ""); }).join(" ; "); }
  function meta(i) { return [i.variant, i.packLabel, i.age ? "Age " + i.age : ""].filter(Boolean).join(" · "); }
  function saveCart() { safe(function () { sessionStorage.setItem("evn_cart2", JSON.stringify(cart)); }); renderBadge(); renderDrawer(); if (co && co.classList.contains("open")) renderSummary(); }
  function renderBadge() { var n = count(); $$(".cart-badge").forEach(function (b) { b.textContent = n; b.classList.toggle("on", n > 0); }); }

  function renderDrawer() {
    if (!drawer) return;
    var sub = subtotal(), n = count(), empty = !cart.length;
    $("#cd-count").textContent = n ? "(" + n + ")" : "";
    $("#cd-empty").style.display = empty ? "block" : "none";
    $("#cd-foot").style.display = empty ? "none" : "";
    $("#cd-ship").style.display = empty ? "none" : "";
    $("#cd-lines").innerHTML = cart.map(function (i, k) {
      var thumb = i.thumb ? '<img src="' + esc(i.thumb) + '" alt="">' : "";
      var was = i.mrp && i.mrp > i.price ? '<s>' + money(i.mrp * i.qty) + '</s>' : "";
      return '<div class="dline" data-k="' + k + '"><div class="thumb">' + thumb + '</div><div class="dinfo"><b>' + esc(i.name) + '</b><span class="meta">' + esc(meta(i)) + '</span>' +
        '<div class="dbot"><div class="qty qty-s" role="group" aria-label="Quantity"><button type="button" data-act="dec" aria-label="Decrease quantity">&minus;</button><output aria-live="polite">' + i.qty + '</output><button type="button" data-act="inc" aria-label="Increase quantity">+</button></div>' +
        '<button class="dlink rm" type="button" data-act="rm">Remove</button></div></div><div class="dprice"><b>' + money(i.price * i.qty) + '</b>' + was + '</div></div>';
    }).join("");
    $("#cd-sub").textContent = money(sub);
    var left = FREE - sub, txt = $("#cd-ship-txt");
    txt.innerHTML = left > 0 ? 'Add <b>' + money(left) + '</b> more for free delivery' : 'You have unlocked <b>free delivery</b>!';
    $("#cd-ship-bar").style.width = Math.min(100, sub / FREE * 100) + "%";
  }
  function renderSummary() {
    var sub = subtotal(), sh = shipping(sub);
    $("#co-lines").innerHTML = cart.map(function (i) {
      return '<div class="cline"><div class="thumb">' + (i.thumb ? '<img src="' + esc(i.thumb) + '" alt="">' : "") + '<em>' + i.qty + '</em></div><div class="dinfo"><b>' + esc(i.name) + '</b><span class="meta">' + esc(meta(i)) + '</span></div><b>' + money(i.price * i.qty) + '</b></div>';
    }).join("");
    var shTxt = sh ? money(sh) : "FREE";
    $("#co-sub").textContent = money(sub); $("#co-ship").textContent = shTxt; $("#co-ship2").textContent = shTxt;
    $("#co-total").textContent = money(sub + sh); $("#co-sumtotal").textContent = money(sub + sh);
    var save = mrpTotal() - sub; $("#co-save").textContent = save > 0 ? "You are saving " + money(save) + " on this order." : "";
  }
  if (drawer) {
    $("#cd-lines").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]"); if (!b) return;
      var row = b.closest(".dline"), it = cart[+row.dataset.k]; if (!it) return;
      var a = b.dataset.act;
      if (a === "inc") it.qty = Math.min(10, it.qty + 1);
      else if (a === "dec") it.qty = Math.max(1, it.qty - 1);
      else if (a === "rm") cart.splice(+row.dataset.k, 1);
      saveCart();
      if (a !== "rm") { var again = $('.dline[data-k="' + row.dataset.k + '"] [data-act="' + a + '"]'); if (again) again.focus(); }
    });
    $$("[data-dclose]", drawer).forEach(function (el) { el.addEventListener("click", closeDrawer); });
    $("#cd-checkout").addEventListener("click", function () { goCheckout("cart"); });
  }

  /* open / close helpers with focus return and a simple focus trap */
  var lastFocus = null;
  function lock(on) { doc.body.style.overflow = on ? "hidden" : ""; }
  function openDrawer() {
    if (!drawer) return; lastFocus = doc.activeElement; renderDrawer();
    drawer.classList.add("open"); lock(true);
    emit("cart_open", { items_text: itemsText(), total: subtotal() });
    if (cart.length) track("ViewCart", { value: subtotal(), currency: "INR", num_items: count(), content_type: "product", content_ids: cart.map(function (i) { return i.product; }), contents: cartContents() });
    setTimeout(function () { var f = $("#cd-checkout") && cart.length ? $("#cd-checkout") : $(".x", drawer); if (f) f.focus(); }, 80);
  }
  function closeDrawer(noFocus) {
    if (!drawer) return; drawer.classList.remove("open"); if (!co || !co.classList.contains("open")) lock(false);
    if (noFocus !== true && lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function openCheckout() {
    if (!co) return; lastFocus = lastFocus || doc.activeElement;
    co.classList.remove("done"); co.classList.add("open"); lock(true); renderSummary(); co.scrollTop = 0;
    var er = $("#co-err"); if (er) er.hidden = true;
    var f = $("#f-email"); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 80);
  }
  function closeCheckout() { if (!co) return; co.classList.remove("open"); lock(false); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  /* the Checkout click is the number we are testing, so it is recorded before anything else happens */
  function goCheckout(source) {
    if (!cart.length) return;
    var total = subtotal() + shipping(subtotal());
    emit("checkout_click", { source: source, items_text: itemsText(), total: total });
    track("InitiateCheckout", { value: total, currency: "INR", num_items: count(), content_type: "product", content_ids: cart.map(function (i) { return i.product; }), contents: cartContents(), checkout_source: source });
    window.dispatchEvent(new CustomEvent("evn:checkout"));
    closeDrawer(true); openCheckout();
  }
  if (co) {
    $("#co-back").addEventListener("click", function () { closeCheckout(); openDrawer(); });
    $("#co-close").addEventListener("click", closeCheckout);
    $("#co-sumtoggle").addEventListener("click", function () { var o = $("#co-sum").classList.toggle("open"); this.setAttribute("aria-expanded", o); $("span", this).textContent = o ? "Hide order summary" : "Show order summary"; });
  }
  doc.addEventListener("keydown", function (e) {
    var top = co && co.classList.contains("open") ? co : (drawer && drawer.classList.contains("open") ? drawer : null);
    if (!top) return;
    if (e.key === "Escape") { if (top === co) closeCheckout(); else closeDrawer(); return; }
    if (e.key === "Tab") {
      var f = $$("button,a[href],input,textarea,select", top).filter(function (x) { return x.offsetParent !== null && !x.disabled && x.tabIndex > -1; });
      if (!f.length) return; var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && doc.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });
  $$("[data-open-cart]").forEach(function (b) { b.addEventListener("click", openDrawer); });
  renderBadge(); renderDrawer();

  function addToCart(item) {
    var k = [item.product, item.variant, item.packLabel, item.age].join("|");
    var hit = cart.filter(function (c) { return [c.product, c.variant, c.packLabel, c.age].join("|") === k; })[0];
    if (hit) hit.qty = Math.min(10, hit.qty + item.qty); else cart.push(item);
    saveCart();
    track("AddToCart", { content_name: item.name, content_ids: [item.product], content_type: "product", value: item.price * item.qty, currency: "INR", num_items: item.qty, contents: [{ id: item.product, quantity: item.qty, item_price: item.price }] });
    emit("add_to_cart", { items_text: item.name + " | " + item.packLabel + " x" + item.qty, total: item.price * item.qty });
  }
  function cardItem(btn) {
    var d = btn.dataset;
    return { product: d.product, name: d.name, variant: d.variant || "", packLabel: d.pack || "1 pack", qty: 1, price: Number(d.price), mrp: Number(d.mrp) || Number(d.price), age: "", thumb: d.thumb || "", url: d.url || "" };
  }
  $$(".js-add").forEach(function (b) {
    b.addEventListener("click", function () { var it = cardItem(b), card = b.closest(".pcard"); flyToCart(card ? $(".pimg img", card) : null, function () { addToCart(it); openDrawer(); }); });
  });
  $$(".js-buy").forEach(function (b) {
    b.addEventListener("click", function () { var it = cardItem(b), card = b.closest(".pcard"); flyToCart(card ? $(".pimg img", card) : null, function () { addToCart(it); goCheckout("buy_now"); }); });
  });

  /* ---------- Checkout form ---------- */
  var form = $("#lead-form");
  function setBad(input, bad) { var f = input.closest(".field"); if (f) f.classList.toggle("bad", bad); }
  function validate() {
    var ok = true, n = form.elements.name, e = form.elements.email, p = form.elements.phone, z = form.elements.pincode;
    var bn = n.value.trim().length < 2; setBad(n, bn); ok = ok && !bn;
    var be = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.value.trim()); setBad(e, be); ok = ok && !be;
    var digits = p.value.replace(/\D/g, ""); if (digits.length === 12 && digits.indexOf("91") === 0) digits = digits.slice(2); if (digits.length === 11 && digits[0] === "0") digits = digits.slice(1);
    var bp = !/^[6-9]\d{9}$/.test(digits); setBad(p, bp); ok = ok && !bp;
    var pin = z.value.replace(/\D/g, ""), bz = !/^[1-9]\d{5}$/.test(pin); setBad(z, bz); ok = ok && !bz;
    return { ok: ok, phone: digits, pin: pin };
  }
  function showErr(msg) { var er = $("#co-err"); if (!er) return; er.textContent = msg; er.hidden = !msg; }
  if (form) {
    $$("input", form).forEach(function (i) { i.addEventListener("input", function () { setBad(i, false); showErr(""); }); });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!cart.length) { showErr("Your cart is empty. Add a product first."); return; }
      var v = validate();
      if (!v.ok) { showErr("Please check the highlighted fields."); var bad = $(".field.bad input", form); if (bad) bad.focus(); return; }
      showErr("");
      var sub = subtotal(), total = sub + shipping(sub), ref = "EV" + Date.now().toString(36).toUpperCase().slice(-6);
      var snap = cart.map(function (i) { return { name: i.name, variant: i.variant, pack: i.packLabel, qty: i.qty, price: i.price, age_group: i.age || "" }; });
      var payload = Object.assign({
        timestamp: new Date().toISOString(), event: "checkout_submit", ref: ref, session: sid, source: "checkout_form",
        name: form.elements.name.value.trim(), email: form.elements.email.value.trim(), phone: "+91" + v.phone, pincode: v.pin,
        items: snap, items_text: itemsText(), total: total, page: location.pathname, user_agent: navigator.userAgent
      }, getAttr());
      var names = cart.map(function (i) { return i.name; }).join(", ");
      var leadIds = cart.map(function (i) { return i.product; }), leadContents = cartContents(), leadItems = count();
      var btn = $("#lead-submit"), finished = false;
      btn.disabled = true; btn.textContent = "Placing your request...";
      function done() {
        if (finished) return; finished = true;
        track("Lead", { content_name: names, value: total, currency: "INR", num_items: leadItems, content_type: "product", content_ids: leadIds, contents: leadContents },
          { email: payload.email, phone: payload.phone, name: payload.name, pin: payload.pincode });
        $("#ok-name").textContent = payload.name.split(" ")[0]; $("#ok-ref").textContent = ref; $("#ok-items").textContent = names;
        /* the thank you page reads this (kept in this browser tab only, never put in the URL) */
        safe(function () { sessionStorage.setItem("evn_thanks", JSON.stringify({ name: payload.name, ref: ref, items: snap, total: total })); });
        var thanks = co.getAttribute("data-thanks");
        co.classList.add("done"); co.scrollTop = 0; btn.disabled = false; btn.textContent = "Complete checkout";
        cart = []; saveCart(); form.reset();
        if (thanks) { setTimeout(function () { location.href = thanks; }, 450); return; }
        window.dispatchEvent(new CustomEvent("evn:done"));
        var m = $(".co-done .mascot, .co-done svg"); if (m) { var r = m.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + 40); }
      }
      var hp = form.elements["bot-field"];
      if (hp && hp.value) { done(); return; }                 /* bots get a fake success, nothing is sent */
      var timer = setTimeout(done, 4000);                     /* never leave a real visitor stuck on the button */
      send(payload, true).then(function () { clearTimeout(timer); done(); }, function () { clearTimeout(timer); done(); });
    });
  }

  /* ---------- Thank you page ---------- */
  var ty = $("#ty-h");
  if (ty) {
    var T = safe(function () { return JSON.parse(sessionStorage.getItem("evn_thanks") || "null"); });
    if (T && T.name) {
      $("#ty-name").textContent = ", " + String(T.name).trim().split(/\s+/)[0];
      $("#ty-who").textContent = T.name; $("#ty-ref").textContent = T.ref || "";
      $("#ty-items").textContent = (T.items || []).map(function (i) { return i.name + (i.variant ? " (" + i.variant + ")" : "") + (i.pack ? ", " + i.pack : "") + " x" + i.qty; }).join(" | ");
      $("#ty-total").textContent = money(T.total || 0);
      $("#ty-card").hidden = false;
    }
  }

  /* contact form (same pipeline) */
  var cform = $("#contact-form");
  if (cform) {
    cform.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var n = cform.elements.name, e = cform.elements.email, p = cform.elements.phone, m = cform.elements.message, ok = true;
      var b1 = n.value.trim().length < 2; setBad(n, b1); ok = ok && !b1;
      var b2 = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.value.trim()); setBad(e, b2); ok = ok && !b2;
      var d = p.value.replace(/\D/g, ""); if (d.length === 12 && d.indexOf("91") === 0) d = d.slice(2);
      var b3 = d && !/^[6-9]\d{9}$/.test(d); setBad(p, !!b3); ok = ok && !b3;
      var b4 = m.value.trim().length < 5; setBad(m, b4); ok = ok && !b4;
      if (!ok) return;
      var okBox = function () { track("Contact", {}, { email: e.value.trim(), phone: d ? "+91" + d : "", name: n.value.trim() }); cform.style.display = "none"; $("#contact-ok").style.display = "block"; };
      var hp = cform.elements["bot-field"]; if (hp && hp.value) { okBox(); return; }
      var timer = setTimeout(okBox, 4000);
      emit("contact", { name: n.value.trim(), email: e.value.trim(), phone: d ? "+91" + d : "", message: m.value.trim() }).then(function () { clearTimeout(timer); okBox(); });
    });
  }

  /* ---------- Product page ---------- */
  var P = window.EVN_PRODUCT;
  if (P) {
    var st = { p: 0, qty: 1, age: "", f: P.start ? P.start.f : 0, s: P.start ? P.start.s : 0 };
    function curPacks() { return P.sizes ? P.sizes[st.s].packs : P.packs; }
    function curMrp() { return P.sizes ? P.sizes[st.s].mrp : P.mrp; }
    var $price = $("#pr-now"), $mrp = $("#pr-mrp"), $off = $("#pr-off"), $per = $("#pr-per");
    function applyPack() {
      var k = curPacks()[st.p], M = curMrp();
      var each = Math.round(k.price / k.n);
      if ($price) $price.textContent = money(k.price * 1);
      var sale = k.price < M * k.n;
      if ($mrp) { $mrp.textContent = money(M * k.n); $mrp.hidden = !sale; }
      if ($off) { $off.textContent = Math.round((1 - k.price / (M * k.n)) * 100) + "% OFF"; $off.hidden = !sale; }
      if ($per) $per.textContent = k.n > 1 ? "That is just " + money(each) + " each" : "";
      $$(".packopt").forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.p === st.p)); });
      var sp = $("#sticky-price"); if (sp) sp.textContent = money(k.price);
    }
    $$(".packopt").forEach(function (b) { b.addEventListener("click", function () { st.p = +b.dataset.p; applyPack(); }); });
    $$(".pill[data-age]").forEach(function (b) {
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-pressed") === "true";
        $$(".pill[data-age]").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        st.age = b.dataset.age; b.setAttribute("aria-pressed", "true");
        var er = $("#age-err"); if (er) er.hidden = true;
      });
    });
    /* age is mandatory: stop add / buy and point at Step 1 */
    function needAge() {
      if (!$$(".pill[data-age]").length || st.age) return false;
      var er = $("#age-err"), step = $("#age-step");
      if (er) er.hidden = false;
      if (step) { step.classList.remove("shake"); void step.offsetWidth; step.classList.add("shake"); step.scrollIntoView({ behavior: "smooth", block: "center" }); }
      return true;
    }
    var qo = $("#qty-out");
    $("#qty-minus").addEventListener("click", function () { st.qty = Math.max(1, st.qty - 1); qo.textContent = st.qty; });
    $("#qty-plus").addEventListener("click", function () { st.qty = Math.min(10, st.qty + 1); qo.textContent = st.qty; });
    function pdpItem() {
      var k = curPacks()[st.p];
      var v = P.flavours ? P.flavours[st.f].label : (P.flavour || "");
      return { product: P.slug, name: P.name, variant: v, packLabel: k.label, qty: st.qty, price: k.price, mrp: curMrp() * k.n, age: st.age, thumb: P.thumb, url: P.url };
    }
    $$(".js-pdp-add").forEach(function (b) { b.addEventListener("click", function () { if (needAge()) return; var it = pdpItem(); flyToCart($(".gmain .js-pack"), function () { addToCart(it); openDrawer(); }); }); });
    $$(".js-pdp-buy").forEach(function (b) { b.addEventListener("click", function () { if (needAge()) return; var it = pdpItem(); flyToCart($(".gmain .js-pack"), function () { addToCart(it); goCheckout("buy_now"); }); }); });
    $$(".js-allrev").forEach(function (b) { b.addEventListener("click", function () { $$(".rv-more").forEach(function (r) { r.hidden = false; }); b.parentNode.hidden = true; }); });
    /* protein: flavour and size swap the first two gallery images, the pack tiles and the prices */
    function setTxt(id, t) { var el = $("#" + id); if (el) el.textContent = t; }
    function applyVariant() {
      if (!P.sizes) return;
      var fl = P.flavours[st.f], z = P.sizes[st.s], im = P.img[fl.key], main = im[z.key].main;
      var sl = $$(".slide"), th = $$(".gthumb");
      function swap(i, src, alt) {
        var a = sl[i] && $("img", sl[i]), b = th[i] && $("img", th[i]);
        if (a) { a.src = src; a.alt = alt; }
        if (b) b.src = src;
      }
      swap(0, main, "Evernest Kids Protein Powder, " + fl.label + ", " + z.label);
      swap(1, im.range, "Evernest Kids Protein Powder, " + fl.label + ", all sizes");
      P.thumb = main;
      var sb = $(".sb-img"); if (sb) sb.src = main;
      $$(".packopt").forEach(function (b, i) {
        var k = z.packs[i], im2 = $("img", b), sv = $(".pk-save", b);
        if (im2) im2.src = im[z.key].pk[i];
        var tb = $(".pk-t b", b); if (tb) tb.textContent = z.label;
        var pp = $(".pp", b); if (pp) pp.textContent = money(k.price);
        var pr = $(".per", b); if (pr) pr.textContent = k.n > 1 ? money(Math.round(k.price / k.n)) + " each" : "Single pack";
        if (sv) { var sg = z.mrp * k.n - k.price; sv.textContent = "Save " + money(sg); sv.hidden = sg <= 0; }
      });
      $$(".flopt").forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.flav === st.f)); });
      $$(".sizeopt").forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.s === st.s)); });
      setTxt("flav-now", fl.label); setTxt("size-now", z.label);
      setTxt("meta-flav", fl.label); setTxt("meta-unit", z.label + " · " + z.servings + " servings");
      setTxt("pack-now", z.label);
      applyPack();
    }
    $$(".flopt").forEach(function (b) { b.addEventListener("click", function () { st.f = +b.dataset.flav; applyVariant(); if (typeof show === "function") show(0); }); });
    $$(".sizeopt").forEach(function (b) { b.addEventListener("click", function () { st.s = +b.dataset.s; applyVariant(); if (typeof show === "function") show(0); }); });
    /* warm the cache so a flavour or size tap swaps the picture instantly */
    var warm = {};
    function pre(src) { if (!src || warm[src]) return; var im = new Image(); im.decoding = "async"; im.src = src; warm[src] = im; }
    function preloadAll() {
      if (!P.sizes) return;
      var cf = P.flavours[st.f].key, cs = P.sizes[st.s].key, list = [];
      P.sizes.forEach(function (z) { list.push(P.img[cf][z.key].main); });
      P.flavours.forEach(function (f) { list.push(P.img[f.key][cs].main); });
      P.flavours.forEach(function (f) { list.push(P.img[f.key].range); });
      P.flavours.forEach(function (f) { P.sizes.forEach(function (z) { list.push(P.img[f.key][z.key].main); }); });
      list.forEach(pre);
    }
    if (P.sizes) {
      applyVariant();
      if (document.readyState === "complete") preloadAll(); else window.addEventListener("load", function () { setTimeout(preloadAll, 50); });
      $$(".flopt").forEach(function (b) { var f = P.flavours[+b.dataset.flav].key; ["pointerenter", "touchstart", "focus"].forEach(function (ev) { b.addEventListener(ev, function () { pre(P.img[f][P.sizes[st.s].key].main); pre(P.img[f].range); }, { passive: true }); }); });
      $$(".sizeopt").forEach(function (b) { var z = P.sizes[+b.dataset.s].key; ["pointerenter", "touchstart", "focus"].forEach(function (ev) { b.addEventListener(ev, function () { pre(P.img[P.flavours[st.f].key][z].main); }, { passive: true }); }); });
    } else applyPack();
    track("ViewContent", { content_name: P.name, content_ids: [P.slug], content_type: "product", value: P.packs[0].price, currency: "INR", contents: [{ id: P.slug, quantity: 1, item_price: P.packs[0].price }] });

    /* gallery */
    var slides = $$(".slide"), thumbs = $$(".gthumb"), gi = 0;
    function show(i) {
      gi = (i + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle("on", k === gi); });
      thumbs.forEach(function (t, k) { t.setAttribute("aria-selected", String(k === gi)); });
      var gc = $("#gcount"); if (gc) gc.textContent = (gi + 1) + " / " + slides.length;
    }
    thumbs.forEach(function (t, k) { t.addEventListener("click", function () { show(k); }); });
    var pv = $(".arrows .prev"), nx = $(".arrows .next");
    if (pv) pv.addEventListener("click", function () { show(gi - 1); });
    if (nx) nx.addEventListener("click", function () { show(gi + 1); });
    var gm = $(".gmain"), sx = 0;
    if (gm) {
      gm.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
      gm.addEventListener("touchend", function (e) { var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) show(gi + (dx < 0 ? 1 : -1)); }, { passive: true });
    }
    show(0);

    /* sticky buy bar (mobile): show once main buy button scrolled out of view */
    var sticky = $(".sticky-buy"), anchor = $("#buy-anchor");
    if (sticky && anchor && "IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { sticky.classList.toggle("show", !es[0].isIntersecting && es[0].boundingClientRect.top < 0); }).observe(anchor);
    }
  }


  /* ---------- Store: search + category filter on the shop grid ---------- */
  var grid = $("#pgrid"), hq = $("#hq"), hform = $("#hsearch");
  if (grid) {
    var cards = $$(".pcard", grid), chips = $$(".chip"), cnt = $("#shop-count"), nores = $("#noresult");
    var qs = new URLSearchParams(location.search), cat = qs.get("c") || "all", q = (qs.get("q") || "").toLowerCase().trim();
    if (["all", "protein", "gummies", "bundles"].indexOf(cat) < 0) cat = "all";
    if (hq) hq.value = qs.get("q") || "";
    var applyFilter = function () {
      var n = 0;
      cards.forEach(function (c) {
        var okc = cat === "all" || c.dataset.cat === cat;
        var okq = !q || q.split(/\s+/).every(function (w) { return (c.dataset.s || "").indexOf(w) > -1; });
        c.hidden = !(okc && okq); if (!c.hidden) n++;
      });
      chips.forEach(function (b) { var on = b.dataset.f === cat; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
      if (cnt) cnt.textContent = n + (n === 1 ? " product" : " products");
      if (nores) nores.hidden = n > 0;
    };
    chips.forEach(function (b) { b.addEventListener("click", function () { cat = b.dataset.f; applyFilter(); }); });
    var searchTimer = null, lastSearch = "";
    function trackSearch() { var t = hq ? hq.value.trim() : ""; if (t.length < 2 || t.toLowerCase() === lastSearch) return; lastSearch = t.toLowerCase(); track("Search", { search_string: t }); }
    if (hq) hq.addEventListener("input", function () { q = hq.value.toLowerCase().trim(); applyFilter(); clearTimeout(searchTimer); searchTimer = setTimeout(trackSearch, 1200); });
    if (hform) hform.addEventListener("submit", function (e) { e.preventDefault(); trackSearch(); hq.blur(); });
    applyFilter();
  }

  /* Trio bundle buttons */
  $$(".js-trio").forEach(function (b) {
    b.addEventListener("click", function () {
      var it = { product: "evernest-trio", name: "Evernest Trio Bundle", variant: "", packLabel: "Protein + Eyesight + Multivitamin", qty: 1, price: Number(b.dataset.price), mrp: Number(b.dataset.mrp) || Number(b.dataset.price), age: "", thumb: b.dataset.thumb || "" };
      var trio = b.closest(".trio");
      flyToCart(trio ? $(".stack img", trio) : null, function () { addToCart(it); if (b.dataset.act === "buy") goCheckout("buy_now"); else openDrawer(); });
    });
  });
})();
