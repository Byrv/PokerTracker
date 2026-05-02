// Synchronous pre-paint theme-init script. Reads the `theme` cookie set by
// ThemeToggle and applies the `.dark` class on <html> before React hydrates,
// so users who explicitly chose a theme don't see a flash of the wrong one.
//
// We intentionally avoid `cookies()` here — pulling cookies into the root
// layout would force every static route to render dynamically. The script
// runs once, synchronously, before paint, and exits silently on any error.
const SCRIPT = `(function(){try{var c=document.cookie.split('; ').find(function(x){return x.indexOf('theme=')===0;});var v=c?c.slice(6):'system';var dark=v==='dark'||(v==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);}catch(_){}})();`;

export function ThemeInit() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
