/* ==========================================================================
   Navigation, menu, scroll reveals and the packages carousel.
   ========================================================================== */
(() => {
  const intro = document.getElementById('intro');
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('menu');

  /* ---------- Nav: invisible over the intro ---------- */

  function updateNav() {
    const pastIntro = intro.getBoundingClientRect().bottom < window.innerHeight * 0.6;
    nav.classList.toggle('is-visible', pastIntro);
  }
  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

  /* ---------- Menu ---------- */

  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
    } else {
      menu.classList.remove('is-open');
      setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 700);
    }
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); }
  });

  /* ---------- Scroll reveals ---------- */

  const reveals = document.querySelectorAll('.reveal, .reveal-group');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const el = entry.target;
        const reversible = el.classList.contains('reveal-group'); // services, packages, questionnaire, contact
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          if (!reversible) io.unobserve(el);
        } else if (reversible && entry.boundingClientRect.top > 0) {
          // Scrolled back up past it: fade out, ready to fade in again
          el.classList.remove('is-visible');
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-visible'));
  }

  /* ---------- Packages carousel (mobile) ---------- */

  const track = document.querySelector('.packages-track');
  const cards = track ? [...track.children] : [];
  const dots = [...document.querySelectorAll('.carousel-dots button')];

  function activeCard() {
    const centre = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    cards.forEach((card, i) => {
      const c = card.offsetLeft + card.offsetWidth / 2;
      const b = cards[best].offsetLeft + cards[best].offsetWidth / 2;
      if (Math.abs(c - centre) < Math.abs(b - centre)) best = i;
    });
    return best;
  }

  if (track && dots.length) {
    dots[0].classList.add('seen'); // the first package is in view on arrival
    let ticking = false;
    track.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const i = activeCard();
        dots.forEach((d, j) => d.setAttribute('aria-selected', String(i === j)));
        dots[i].classList.add('seen'); // remembered, so viewed packages stay lit
        ticking = false;
      });
    }, { passive: true });

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        const card = cards[i];
        track.scrollTo({ left: card.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft), behavior: 'smooth' });
      });
    });
  }

  /* ---------- Contact form ---------- */

  const contact = document.getElementById('contact-form');
  if (contact) {
    const submit = contact.querySelector('.contact-submit');
    const error = contact.querySelector('.q-error');
    const done = document.querySelector('.contact-done');

    contact.addEventListener('submit', async e => {
      e.preventDefault();
      const bad = [...contact.elements].find(el => el.willValidate && !el.checkValidity());
      if (bad) { bad.reportValidity(); return; }

      const endpoint = contact.getAttribute('action');
      error.hidden = true;
      if (!endpoint || endpoint.includes('[FORMSPREE_ENDPOINT]')) {
        error.textContent = 'This form is not connected yet. Add the Formspree endpoint to go live.';
        error.hidden = false;
        return;
      }
      submit.disabled = true;
      submit.textContent = 'Sending…';
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          body: new FormData(contact),
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(res.statusText);
        contact.hidden = true;
        done.hidden = false;
      } catch {
        error.textContent = 'Something went wrong sending your message. Please try again.';
        error.hidden = false;
      } finally {
        submit.disabled = false;
        submit.textContent = 'Send message';
      }
    });
  }

  /* ---------- Footer year ---------- */

  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();
