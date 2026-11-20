/* Evernest site config. Edit these values, no other code changes needed. */
window.EVERNEST = {
  // Meta Pixel ID (digits only). Leave empty to disable the pixel.
  PIXEL_ID: "4694538034161266",
  // true = every key event is also sent from the server (Meta Conversions API) through the Apps Script below.
  // The access token is NOT stored here. It lives in the Apps Script "Script properties" as META_CAPI_TOKEN.
  CAPI: true,
  // Where events and leads are sent. Paste your Google Apps Script web app URL here
  // (see setup/google-apps-script.gs and README.md). Empty = the key events
  // (Checkout click, checkout form, contact) go to Netlify Forms instead, which is
  // limited to 100 submissions a month on the free plan. Everything is also kept in the
  // visitor's own browser (localStorage "evn_leads") and logged to the console on localhost.
  LEAD_ENDPOINT: "https://script.google.com/macros/s/AKfycbx_LCUsDp5rge9C3843tWu7Nq-EadYRs-rxeXROItwrrBFx_eRGg7cEsC7u-ABIusju/exec",
  // WhatsApp number with country code, digits only (example: 919876543210). Empty hides WhatsApp buttons.
  WHATSAPP: "",
  CURRENCY: "₹"
};
