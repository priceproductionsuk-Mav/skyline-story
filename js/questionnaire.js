/* ==========================================================================
   Questionnaire: branch first, then one or two questions per screen.
   Submits to Formspree (set the form's action in index.html).
   ========================================================================== */
(() => {
  const form = document.getElementById('quote-form');
  if (!form) return;

  const screens = [...form.querySelectorAll('.q-screen')];
  const branch = screens.find(s => s.dataset.path === 'branch');
  const done = screens.find(s => s.dataset.path === 'done');
  const controls = form.querySelector('.q-controls');
  const back = form.querySelector('.q-back');
  const next = form.querySelector('.q-next');
  const bar = form.querySelector('.q-progress span');
  const error = form.querySelector('.q-error');

  let flow = [];   // screens for the chosen path, in order
  let index = -1;  // -1 = branch question

  function show(screen) {
    screens.forEach(s => s.classList.toggle('is-active', s === screen));
    error.hidden = true;
  }

  function setFields(screen, enabled) {
    screen.querySelectorAll('input, textarea').forEach(el => { el.disabled = !enabled; });
  }

  function render() {
    if (index < 0) {
      show(branch);
      controls.hidden = true;
      bar.style.width = '0%';
      return;
    }
    show(flow[index]);
    controls.hidden = false;
    next.textContent = index === flow.length - 1 ? 'Send' : 'Next';
    bar.style.width = `${((index + 1) / (flow.length + 1)) * 100}%`;
    const first = flow[index].querySelector('textarea, input:not([type="radio"])');
    if (first && window.matchMedia('(hover: hover)').matches) first.focus({ preventScroll: true });
  }

  function choose(path) {
    form.elements.path.value = path === 'existing' ? 'Existing system (audit and fix)' : 'New system (build)';
    flow = screens.filter(s => s.dataset.path === path || s.dataset.path === 'both');
    // Only the chosen path's fields are validated and sent
    screens.forEach(s => {
      if (s.dataset.path === 'existing' || s.dataset.path === 'new') setFields(s, s.dataset.path === path);
    });
    index = 0;
    render();
  }

  function valid(screen) {
    const fields = [...screen.querySelectorAll('input, textarea')].filter(el => !el.disabled);
    const bad = fields.find(el => !el.checkValidity());
    if (bad) { bad.reportValidity(); return false; }
    return true;
  }

  async function send() {
    const endpoint = form.getAttribute('action');
    if (!endpoint || endpoint.includes('[FORMSPREE_ENDPOINT]')) {
      error.textContent = 'This form is not connected yet. Add the Formspree endpoint to go live.';
      error.hidden = false;
      return;
    }
    next.disabled = true;
    next.textContent = 'Sending…';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(res.statusText);
      controls.hidden = true;
      bar.style.width = '100%';
      show(done);
    } catch {
      error.textContent = 'Something went wrong sending your answers. Please try again.';
      error.hidden = false;
      next.textContent = 'Send';
    } finally {
      next.disabled = false;
    }
  }

  form.querySelectorAll('[data-choose]').forEach(btn => {
    btn.addEventListener('click', () => choose(btn.dataset.choose));
  });

  back.addEventListener('click', () => {
    index -= 1;
    render();
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (index < 0 || !valid(flow[index])) return;
    if (index < flow.length - 1) {
      index += 1;
      render();
    } else {
      send();
    }
  });

  // Package (required before the questionnaire starts). "Price on Request" fills it in;
  // tapping the pill opens the options to change it.
  const pkg = form.querySelector('.q-package');
  const toggle = pkg.querySelector('.q-package-toggle');
  const options = pkg.querySelector('.q-package-options');
  const branchButtons = [...form.querySelectorAll('[data-choose]')];

  const openOptions = open => {
    options.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  const setPackage = name => {
    form.elements.package.value = name;
    // Most packages read "Enquiring about <name>"; "Help me choose" has its own wording
    const option = options.querySelector(`[data-pick="${name}"]`);
    const pill = option && option.dataset.pill;
    pkg.classList.toggle('has-own-wording', !!pill);
    pkg.querySelector('strong').textContent = pill || name;
    pkg.classList.toggle('is-chosen', !!name);
    options.querySelectorAll('[data-pick]').forEach(b => b.classList.toggle('is-active', b.dataset.pick === name));
    branchButtons.forEach(b => { b.disabled = !name; }); // the questionnaire unlocks once a package is chosen
    openOptions(!name); // stays open until something is chosen
  };

  toggle.addEventListener('click', () => {
    if (pkg.classList.contains('is-chosen')) openOptions(options.hidden);
  });
  options.addEventListener('click', e => {
    const b = e.target.closest('[data-pick]');
    if (b) setPackage(b.dataset.pick);
  });
  document.querySelectorAll('[data-package]').forEach(link => {
    link.addEventListener('click', () => setPackage(link.dataset.package));
  });
  setPackage('');

  render();
})();
