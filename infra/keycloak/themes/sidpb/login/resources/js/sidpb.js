/* Presentation only: no tiles, network calls, or changes to native forms. */
document.addEventListener('DOMContentLoaded', () => {
  const element = document.createElement('div');
  element.id = 'sidpb-map';
  element.className = 'sidpb-auth-map';
  element.setAttribute('aria-hidden', 'true');
  document.body.prepend(element);
  const attribution = document.createElement('a');
  attribution.className = 'sidpb-map-attribution';
  attribution.href = 'https://www.openstreetmap.org/copyright';
  attribution.textContent = '© OpenStreetMap contributors';
  document.body.append(attribution);
});
