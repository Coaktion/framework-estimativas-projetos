/**
 * Fixture da release note.
 *
 * Reproduz a estrutura REAL observada em
 * support.zendesk.com/hc/en-us/articles/11109219243546 (Release notes through
 * 2026-08-07): H2 = produto, H4 = componente ou "New"/"Fixed", <ul><li> = mudança.
 *
 * Os três bullets marcados [REAL] são texto verbatim do artigo. Os demais são
 * sintéticos, escritos para cobrir os caminhos do classificador (deprecation,
 * preço, API, EAP, ruído cosmético) mantendo o mesmo formato de redação.
 */
export const RELEASE_NOTE_HTML = `
<h2>Copilot</h2>
<h4>Auto assist</h4>
<ul>
  <li>Auto assist will no longer provide suggestions on a given ticket to agents who dismissed a suggestion three times in a row on that ticket.</li>
  <li>Admins can now configure which auto assist procedures are available per group in Admin Center. Requires Advanced AI add-on.</li>
</ul>
<h4>Fixed</h4>
<ul>
  <li>Fixed a visual glitch where the copilot panel alignment shifted on narrow screens.</li>
  <li>Fixed a typo in the auto assist tooltip wording.</li>
  <li>Fixed an issue where the auto assist API endpoint returned a 500 for tickets with more than 200 comments.</li>
</ul>

<h2>Contact Center</h2>
<h4>AI Agents</h4>
<ul>
  <li>With the voice testing widget, you can test and refine your voice AI agents directly from the AI agent dashboard, without placing a real phone call.</li>
  <li>Voice AI agents are now generally available for all accounts on Suite Professional and above with the Advanced AI add-on.</li>
</ul>

<h2>Knowledge &amp; AI agents</h2>
<h4>Web Crawler</h4>
<ul>
  <li>The web crawler now supports a configurable page limit per source, set in Admin Center. Existing crawlers keep their current limit until edited.</li>
</ul>
<h4>Editor</h4>
<ul>
  <li>Announcing the conversational help center early access program (EAP). Sign up to give your end users a conversational interface over your knowledge base.</li>
</ul>

<h2>Apps and integrations</h2>
<h4>New</h4>
<ul>
  <li>MadCap Connect helps organizations create, manage, and deliver technical documentation and knowledge content across support, self-service, and customer experience channels.</li>
</ul>
<h4>Developer</h4>
<ul>
  <li>Announcing the removal of API tokens as an authentication method for API requests. All integrations must migrate to OAuth by September 30, 2026.</li>
  <li>The new conversations endpoint is available in the Ticketing API. See the API reference for the payload schema.</li>
</ul>

<h2>Billing</h2>
<h4>New</h4>
<ul>
  <li>Announcing upcoming changes to WhatsApp Business messaging pricing, effective October 1, 2026. Per-conversation billing is replaced by per-message pricing.</li>
</ul>
`;

/** Artigo-vivo de EAPs: estrutura H2 = categoria, H3 = nome do EAP. */
export const EAP_ARTICLE_HTML = `
<p>Important considerations before joining an early access program.</p>
<h2>Support</h2>
<h3>Full end-user separation</h3>
<p>Customers using department spaces can now isolate end-user data by department. Enables isolated end-user directories per department rather than sharing across the entire account.</p>
<h2>Analytics</h2>
<h3>Agentic analytics</h3>
<p>AI-powered tool that helps customer service teams monitor the performance of both AI and human agents in real time. Provides intuitive dashboards and natural language query capabilities.</p>
<h2>AI agents</h2>
<h3>Voice AI agents</h3>
<p>Natively integrated, agentic voice automation solution that delivers natural, real-time conversations over the phone, with seamless human agent escalation.</p>
`;

/** Announcement: 1 artigo = 1 sinal. Títulos verbatim de agosto/2026. */
export const ANNOUNCEMENTS = [
  {
    id: 1,
    title: 'Announcing the removal of API tokens as an authentication method for API requests',
    body: '<p>Starting September 30, 2026, API tokens will no longer be accepted for API requests. Integrations must migrate to OAuth. <a href="https://developer.zendesk.com/api-reference/introduction/security-and-auth/">See the authentication reference.</a></p>',
    label_names: [],
  },
  {
    id: 2,
    title: 'Announcing upcoming changes to WhatsApp Business messaging pricing',
    body: '<p>Effective October 1, 2026, WhatsApp Business messaging moves from per-conversation billing to per-message pricing across all Suite plans.</p>',
    label_names: [],
  },
  {
    id: 3,
    title: 'Announcing the general availability of the MCP client',
    body: '<p>The MCP client is now generally available on Suite Professional and above. Connect Zendesk to your own systems through an MCP endpoint without middleware.</p>',
    label_names: [],
  },
  {
    id: 4,
    title: 'Announcing a new granular permission for managing API and OAuth clients',
    body: '<p>A dedicated permission for administering API and OAuth clients is now available in Admin Center for Suite Enterprise accounts, separate from the general admin role.</p>',
    label_names: [],
  },
  {
    id: 5,
    title: 'Announcing unified navigation across Zendesk products',
    body: '<p>A refreshed, unified navigation is rolling out across Zendesk products. No configuration is required and the change applies to all plans.</p>',
    label_names: [],
  },
];
