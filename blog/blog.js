(() => {
  document.querySelectorAll('.copy-code').forEach(button => {
    if (!navigator.clipboard?.writeText) return;
    button.hidden = false;
    button.addEventListener('click', async () => {
      const status = document.querySelector('#copy-status');
      try {
        await navigator.clipboard.writeText(button.closest('.code-block').querySelector('code').textContent);
        button.textContent = 'Copied';
        status.textContent = 'Code copied to clipboard.';
      } catch {
        button.textContent = 'Select to copy';
        status.textContent = 'Clipboard access unavailable. Select and copy the code manually.';
      }
      setTimeout(() => { button.textContent = 'Copy code'; }, 2000);
    });
  });
})();
