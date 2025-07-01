document.addEventListener('DOMContentLoaded', function () {
  const byline = document.querySelector('d-byline');
  if (!byline) return;
  const container = byline.querySelector('.byline');
  if (!container) return;
  container.querySelectorAll('div').forEach(div => {
    const header = div.querySelector('h3');
    if (!header) return;
    const label = header.textContent.trim().toLowerCase();
    if (label === 'published') {
      header.textContent = 'Date';
      const p = div.querySelector('p');
      if (p) p.style.fontWeight = 'normal';
    } else {
      div.remove();
    }
  });
});
