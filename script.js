const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.nav');

if (menuButton && navigation) {
  menuButton.addEventListener('click', () => {
    const isOpen = navigation.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });

  navigation.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navigation.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
    });
  });
}

const year = document.getElementById('year');

if (year) {
  year.textContent = new Date().getFullYear();
}

const form = document.getElementById('contact-form');

if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const firstName = data.get('firstName') || '';
    const lastName = data.get('lastName') || '';
    const email = data.get('email') || '';
    const message = data.get('message') || '';
    const name = `${firstName} ${lastName}`.trim();

    const isGerman = document.documentElement.lang === 'de';

    const subjectText = isGerman
        ? `Webseitenanfrage von ${name || 'Besucher'}`
        : `Website enquiry from ${name || 'visitor'}`;

    const bodyText = [
      `Name: ${name}`,
      `${isGerman ? 'E-Mail' : 'Email'}: ${email}`,
      '',
      message
    ].join('\n');

    const subject = encodeURIComponent(subjectText);
    const body = encodeURIComponent(bodyText);

    window.location.href =
        `mailto:kontakt@schmeidler.at?subject=${subject}&body=${body}`;
  });
}

const themeToggle = document.querySelector('.theme-toggle');
const root = document.documentElement;

function applyTheme(theme) {
  const activeTheme = theme === 'dark' ? 'dark' : 'light';

  root.dataset.theme = activeTheme;

  if (!themeToggle) {
    return;
  }

  const isDark = activeTheme === 'dark';
  const isGerman = root.lang === 'de';

  themeToggle.setAttribute('aria-pressed', String(isDark));

  if (isGerman) {
    themeToggle.setAttribute(
        'aria-label',
        isDark
            ? 'Helles Farbschema aktivieren'
            : 'Dunkles Farbschema aktivieren'
    );
  } else {
    themeToggle.setAttribute(
        'aria-label',
        isDark
            ? 'Switch to light mode'
            : 'Switch to dark mode'
    );
  }
}

let savedTheme = 'light';

try {
  savedTheme =
      localStorage.getItem('site-theme') ||
      root.dataset.theme ||
      'light';
} catch {}

applyTheme(savedTheme);

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const nextTheme =
        root.dataset.theme === 'dark'
            ? 'light'
            : 'dark';

    applyTheme(nextTheme);

    try {
      localStorage.setItem('site-theme', nextTheme);
    } catch {}
  });
}

const abstractGrid = document.querySelector('.abstract-grid');

if (abstractGrid) {
  const shapes = [
    'square', 'square', 'circle', 'square', 'bar', 'diamond', 'square', 'square',
    'square', 'pill', 'square', 'circle', 'square', 'triangle', 'square', 'bar',
    'diamond', 'square', 'square', 'square', 'circle', 'square', 'pill', 'square',
    'square', 'bar', 'square', 'diamond', 'square', 'circle', 'square', 'square',
    'triangle', 'square', 'square', 'pill', 'square', 'bar', 'circle', 'square',
    'square', 'diamond', 'square', 'square', 'bar', 'square', 'circle', 'square'
  ];

  const fragment = document.createDocumentFragment();

  shapes.forEach((shape, index) => {
    const cell = document.createElement('span');

    const duration = 3.35 + ((index * 17) % 19) / 10;
    const delay = -(((index * 37) % 53) / 10);
    const x = ((index * 11) % 9) - 4;
    const y = ((index * 7) % 9) - 4;
    const scale = 0.64 + ((index * 13) % 23) / 100;

    cell.className = `abstract-cell shape-${shape}`;

    cell.style.setProperty('--dur', `${duration.toFixed(2)}s`);
    cell.style.setProperty('--delay', `${delay.toFixed(2)}s`);
    cell.style.setProperty('--dx', `${x}px`);
    cell.style.setProperty('--dy', `${y}px`);
    cell.style.setProperty('--shape-scale', scale.toFixed(2));

    fragment.appendChild(cell);
  });

  abstractGrid.replaceChildren(fragment);
}

(() => {
  const languageSwitch = document.querySelector('.language-switch');

  if (!languageSwitch) {
    return;
  }

  const links = [...languageSwitch.querySelectorAll('a.lang-link')];

  const currentLanguage = document.documentElement.lang
      .toLowerCase()
      .startsWith('de')
      ? 'de'
      : 'en';

  let pendingNavigation = null;

  function getLinkLanguage(link) {
    const language =
        link.getAttribute('hreflang') ||
        link.getAttribute('lang') ||
        '';

    return language.toLowerCase().startsWith('de')
        ? 'de'
        : 'en';
  }

  function showLanguage(language) {
    const isGerman = language === 'de';

    languageSwitch.classList.toggle('lang-de', isGerman);
    languageSwitch.classList.toggle('lang-en', !isGerman);

    links.forEach((link) => {
      const isActive = getLinkLanguage(link) === language;

      link.classList.toggle('active', isActive);

      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function toMilliseconds(value) {
    const text = value.trim();
    const number = Number.parseFloat(text);

    if (!Number.isFinite(number)) {
      return 0;
    }

    return text.endsWith('ms')
        ? number
        : number * 1000;
  }

  function getSliderDuration() {
    const style = getComputedStyle(languageSwitch, '::before');

    const properties = style.transitionProperty
        .split(',')
        .map((value) => value.trim());

    const durations = style.transitionDuration
        .split(',')
        .map(toMilliseconds);

    const delays = style.transitionDelay
        .split(',')
        .map(toMilliseconds);

    return properties.reduce((longest, property, index) => {
      if (property !== 'transform' && property !== 'all') {
        return longest;
      }

      const duration = durations[index % durations.length];
      const delay = delays[index % delays.length];

      return Math.max(longest, duration + delay);
    }, 0);
  }

  function clearPendingNavigation() {
    if (!pendingNavigation) {
      return;
    }

    clearTimeout(pendingNavigation.timer);

    if (pendingNavigation.frame) {
      cancelAnimationFrame(pendingNavigation.frame);
    }

    languageSwitch.removeEventListener(
        'transitionend',
        pendingNavigation.onEnd
    );

    pendingNavigation = null;
    languageSwitch.removeAttribute('aria-busy');
  }

  window.addEventListener('pageshow', () => {
    clearPendingNavigation();
    showLanguage(currentLanguage);
  });

  showLanguage(currentLanguage);

  languageSwitch.addEventListener('click', (event) => {
    const link = event.target.closest('a.lang-link');

    if (!link || !languageSwitch.contains(link)) {
      return;
    }

    const modifiedClick =
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey;

    const specialLink =
        link.hasAttribute('download') ||
        (link.target && link.target !== '_self');

    if (
        event.defaultPrevented ||
        event.button !== 0 ||
        modifiedClick ||
        specialLink
    ) {
      return;
    }

    const language = getLinkLanguage(link);

    if (pendingNavigation || language === currentLanguage) {
      event.preventDefault();
      return;
    }

    const destination = new URL(link.href, window.location.href);

    if (destination.origin !== window.location.origin) {
      return;
    }

    const duration = getSliderDuration();
    const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;

    if (reducedMotion || duration <= 0) {
      return;
    }

    event.preventDefault();

    getComputedStyle(languageSwitch, '::before').transform;

    const task = {
      timer: 0,
      frame: 0,
      onEnd: null,
      finishing: false
    };

    pendingNavigation = task;
    languageSwitch.setAttribute('aria-busy', 'true');

    const navigate = () => {
      if (
          pendingNavigation !== task ||
          task.finishing
      ) {
        return;
      }

      task.finishing = true;

      clearTimeout(task.timer);

      languageSwitch.removeEventListener(
          'transitionend',
          task.onEnd
      );

      task.frame = requestAnimationFrame(() => {
        if (pendingNavigation === task) {
          window.location.assign(destination.href);
        }
      });
    };

    task.onEnd = (transition) => {
      const correctTarget =
          transition.target === languageSwitch;

      const correctProperty =
          transition.propertyName === 'transform';

      const correctPseudoElement =
          !transition.pseudoElement ||
          transition.pseudoElement === '::before';

      if (
          correctTarget &&
          correctProperty &&
          correctPseudoElement
      ) {
        navigate();
      }
    };

    languageSwitch.addEventListener(
        'transitionend',
        task.onEnd
    );

    task.timer = window.setTimeout(
        navigate,
        duration + 100
    );

    showLanguage(language);
  });
})();