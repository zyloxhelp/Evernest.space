/* Evernest dragon buddy: walks along the bottom edge as you scroll, hops, blinks, follows the pointer, chats per section,
   sleeps on the footer, and cheers when something goes in the cart. No dependencies. */
(function () {
  "use strict";
  var small = window.matchMedia && matchMedia("(max-width:640px)").matches;
  var doc = document, root = doc.documentElement;
  var buddy = doc.getElementById("buddy"), btn = doc.getElementById("buddy-btn"), bub = doc.getElementById("bubble");
  var prog = doc.querySelector("#progress i");
  if (!buddy || !btn || !bub) return;
  var svg = btn.querySelector("svg");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia && matchMedia("(pointer:fine)").matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var $$ = function (s) { return Array.prototype.slice.call(doc.querySelectorAll(s)); };

  /* poses are CSS classes on the svg; pose() plays one for a while, then clears it */
  var poseT = {};
  function pose(name, ms) {
    if (reduce || sleeping) return;
    clearTimeout(poseT[name]);
    svg.classList.remove(name); void svg.getBoundingClientRect(); svg.classList.add(name);
    poseT[name] = setTimeout(function () { svg.classList.remove(name); }, ms);
  }
  var walkT = 0;
  function walking(on) {
    if (reduce || sleeping) return;
    if (on) { svg.classList.add("walk"); clearTimeout(walkT); walkT = setTimeout(function () { svg.classList.remove("walk"); }, 220); }
  }
  var ctas = $$(".js-add,.js-buy,.js-pdp-add,.js-pdp-buy,.js-trio");

  var vw = 0, vh = 0, W = 0, docH = 1;
  var x = 12, tx = 12, y = 0, ty = 0, face = -1, tilt = 0, lastY = window.scrollY, vel = 0;
  var sleeping = false, ready = false, raf = 0, idleT = 0, bubT = 0, said = {}, lastStep = 0;
  var mx = null, my = null;
  var gums = $$(".cta .g"), panel = doc.querySelector(".hero-art .panel");
  var sticky = doc.querySelector(".sticky-buy"), fbar = doc.querySelector(".fbar");

  function measure() {
    vw = root.clientWidth; vh = window.innerHeight; W = buddy.offsetWidth || 90;
    docH = Math.max(root.scrollHeight - vh, 1);
  }

  function say(msg, ms) {
    if (!msg) return;
    clearTimeout(bubT);
    bub.textContent = msg;
    buddy.classList.toggle("right", x + W / 2 > vw / 2);
    bub.classList.add("show");
    bubT = setTimeout(function () { bub.classList.remove("show"); }, ms || 3200);
  }

  function setSleep(on) {
    if (on === sleeping) return;
    sleeping = on;
    if (on) svg.classList.remove("walk", "wave", "peek", "jump", "cheer", "chomp");
    svg.classList.toggle("sleep", on);
    buddy.classList.toggle("sleeping", on);
    if (on) { face = 1; if (!small) say("zzz... five more minutes", 2600); } else { say("Oh! I am awake!", 1800); }
  }

  /* what sits under the dragon: the footer bar and the mobile sticky buy bar act as ledges */
  function floorY() {
    var f = 0;
    if (fbar) { var r = fbar.getBoundingClientRect(); if (r.top < vh) f = Math.min(f, r.top - vh); }
    if (sticky && sticky.classList.contains("show")) { var s = sticky.getBoundingClientRect(); f = Math.min(f, s.top - vh); }
    return f;
  }

  function frame() {
    raf = 0;
    var sy = window.scrollY, p = clamp(sy / docH, 0, 1);
    if (prog) prog.style.setProperty("--p", p.toFixed(4));
    var dy = sy - lastY; lastY = sy;
    vel += (dy - vel) * .35;                       /* smoothed scroll velocity, px per frame */
    var moving = Math.abs(vel) > .4;
    if (moving) walking(true);

    if (!reduce) {
      var track = Math.max(vw - W - 24, 0);
      tx = 12 + p * track;
      var nx = x + (tx - x) * .14;
      if (!sleeping && Math.abs(nx - x) > .15) face = nx > x ? -1 : 1;   /* faces the way it walks */
      x = nx;
      var hop = moving ? Math.abs(Math.sin(sy / 34)) * 8 * clamp(Math.abs(vel) / 6, .25, 1) : 0;
      ty = floorY();
      y += ((ty - hop) - y) * .3;
      tilt += (clamp(vel * .55, -9, 9) - tilt) * .25;
    } else {
      x = Math.max(vw - W - 14, 0); y = floorY(); tilt = 0;
    }
    buddy.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
    btn.style.setProperty("--face", face);
    btn.style.setProperty("--tilt", tilt.toFixed(1) + "deg");

    /* eyes and head: look at a nearby Add to cart / Buy button (within 150px of the cursor), else follow the pointer */
    var px = 0, py = 0, hr = 0;
    if (moving) { py = clamp(vel, -1, 1) * 7; px = 0; }
    else if (mx !== null && fine && !sleeping) {
      var r = btn.getBoundingClientRect(), cx = r.left + r.width * .52, cy = r.top + r.height * .32;
      var tx2 = mx, ty2 = my, near = null, best = 150;
      ctas.forEach(function (b) {
        var br = b.getBoundingClientRect();
        if (br.bottom < 0 || br.top > vh || !br.width) return;
        var ddx = Math.max(br.left - mx, 0, mx - br.right), ddy = Math.max(br.top - my, 0, my - br.bottom), dd = Math.hypot(ddx, ddy);
        if (dd < best) { best = dd; near = br; }
      });
      if (near) { tx2 = near.left + near.width / 2; ty2 = near.top + near.height / 2; }
      var dx = tx2 - cx, dy2 = ty2 - cy, d = Math.hypot(dx, dy2) || 1, k = Math.min(1, d / 260);
      px = dx / d * 7 * k * face; py = dy2 / d * 7 * k;
      var fdir = face === -1 ? 1 : -1;
      hr = near ? clamp(Math.atan2(dy2, Math.max(Math.abs(dx), 60)) * 180 / Math.PI, -22, 22) * (dx * fdir >= 0 ? 1 : .4) : 0;
      if (near && !said.cta && ready) { said.cta = 1; say("Ooh, tap that one!", 2200); }
    }
    svg.style.setProperty("--px", px.toFixed(1) + "px");
    svg.style.setProperty("--py", py.toFixed(1) + "px");
    svg.style.setProperty("--hr", hr.toFixed(1) + "deg");

    /* extra scroll-linked motion */
    if (!reduce) {
      if (panel) { var ps = Math.min(sy, 900); panel.style.transform = "translate3d(0," + (ps * .07).toFixed(1) + "px,0) rotate(" + (ps * .01).toFixed(2) + "deg)"; }
      gums.forEach(function (g) {
        var r2 = g.parentNode.getBoundingClientRect();
        if (r2.bottom < -80 || r2.top > vh + 80) return;
        var o = (r2.top + r2.height / 2 - vh / 2) * -.12 * (1 + (+g.dataset.k || 0));
        g.style.transform = "translate3d(0," + o.toFixed(1) + "px,0)";
      });
    }
    if (moving || Math.abs(tx - x) > .3 || Math.abs((ty - y)) > .3 || Math.abs(tilt) > .2) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  gums.forEach(function (g, i) { g.dataset.k = i % 2 ? .6 : 0; });

  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", function () { measure(); kick(); });
  if (fine) window.addEventListener("pointermove", function (e) { mx = e.clientX; my = e.clientY; kick(); }, { passive: true });
  window.addEventListener("load", function () { measure(); kick(); });

  /* per-section chatter */
  function arm() {
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting || !ready) return;
        var t = e.target.getAttribute("data-say");
        if (t && !said[t] && !sleeping) {
          said[t] = 1; say(t, 3000);
          if (e.target.id === "heroes" && !reduce) {         /* ducks behind the edge, then pops up and waves */
            svg.classList.add("peek");
            setTimeout(function () { svg.classList.remove("peek"); pose("wave", 1500); }, 2300);
          }
        }
      });
    }, { threshold: .4 });
    $$("[data-say]").forEach(function (s) { io.observe(s); });
    var ft = doc.querySelector(".site-footer");
    if (ft) new IntersectionObserver(function (es) { setSleep(es[0].isIntersecting && es[0].intersectionRatio > .25); }, { threshold: [0, .25, .5] }).observe(ft);
  }

  /* reactions */
  function burst(n) {
    var r = btn.getBoundingClientRect(), gsrc = svg.getAttribute("data-gum");
    for (var i = 0; i < n; i++) {
      var im = doc.createElement("img"); im.className = "gum-fly"; im.alt = ""; im.src = gsrc.replace("gummy-0", "gummy-" + (i % 6));
      im.style.left = (r.left + r.width * .45) + "px"; im.style.top = (r.top + r.height * .3) + "px";
      doc.body.appendChild(im);
      var ang = (-70 - Math.random() * 40 + (i % 2 ? 20 : -20)) * Math.PI / 180, dist = 90 + Math.random() * 90;
      var a = im.animate([{ transform: "translate(0,0) scale(.4) rotate(0)", opacity: 1 },
        { transform: "translate(" + Math.cos(ang) * dist + "px," + (Math.sin(ang) * dist) + "px) scale(1) rotate(" + (Math.random() * 200 - 100) + "deg)", opacity: 1, offset: .55 },
        { transform: "translate(" + Math.cos(ang) * dist * 1.1 + "px," + (Math.sin(ang) * dist + 120) + "px) scale(.8) rotate(240deg)", opacity: 0 }],
        { duration: 1100 + Math.random() * 300, easing: "cubic-bezier(.2,.7,.4,1)" });
      a.onfinish = (function (el) { return function () { el.remove(); }; })(im);
    }
  }
  function jump() { pose("jump", 950); }
  var chat = ["Hee hee, that tickles!", "Gummies make me smile!", "Roar! A friendly one.", "Psst, the Trio bundle is a good deal.", "Want a gummy? Me too."];
  var ci = 0;
  btn.addEventListener("click", function () {
    if (sleeping) { setSleep(false); }
    if (ci % 3 === 2) pose("chomp", 2600); else if (ci % 3 === 1) pose("wave", 1700); else jump();
    burst(reduce ? 0 : 7); say(chat[ci++ % chat.length], 2600);
  });
  window.addEventListener("evn:checkout", function () { if (sleeping) setSleep(false); pose("jump", 950); say("Almost there! Fill in your details.", 2600); });
  window.addEventListener("evn:done", function () { pose("cheer", 1900); burst(reduce ? 0 : 8); say("Yay! We got your order request!", 3000); });
  window.addEventListener("evn:add", function () {
    if (sleeping) setSleep(false);
    pose("cheer", 1900); burst(reduce ? 0 : 6); say("Yum! Into the cart it goes.", 2400);
  });

  measure(); kick();
  setTimeout(function () { buddy.classList.add("on"); }, 500);
  setTimeout(function () { ready = true; arm(); pose("wave", 2400); say(small ? "Hi! Scroll, I follow!" : "Hi! I am the Evernest dragon. Scroll and I will tag along.", 3000); said["Hi! Scroll down and I will tag along."] = 1; }, 1300);
})();
