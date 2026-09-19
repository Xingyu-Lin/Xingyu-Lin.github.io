const form = document.querySelector('#login-form');
const message = document.querySelector('#login-message');
const password = document.querySelector('#password');
const button = document.querySelector('#login-button');
let token;
button.disabled = true;
fetch('/api/auth?login=1').then(response => response.json()).then(session => {
  if (session.authenticated) { location.replace('/blog/'); return; }
  token = session.token;
  if (session.setup) {
    document.querySelector('#login-heading').textContent = 'Set your password';
    document.querySelector('#login-description').textContent = 'Your admin account. Only you can write here.';
    button.textContent = 'Create password'; password.autocomplete = 'new-password'; password.minLength = 12;
    password.placeholder = 'At least 12 characters';
  }
  if (session.unavailable) { message.textContent = 'The administrator account needs to be configured on the server.'; form.hidden = true; return; }
  button.disabled = false;
}).catch(() => { message.textContent = 'Unable to connect. Reload to try again.'; });
form.addEventListener('submit', async event => {
  event.preventDefault(); button.disabled = true; message.textContent = '';
  try {
    const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Writing-Token': token }, body: JSON.stringify({ password: password.value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    password.value = ''; location.replace('/blog/');
  } catch (error) { message.textContent = error.message; } finally { button.disabled = false; }
});
