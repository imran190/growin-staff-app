const MANAGER_RESOLVER_URL = 'https://crm.travbizz.com/growin_manager/growin_resolve_agent.php';

function normalizeCrmApiUrl(payload) {
  if (payload?.api_base_url) return payload.api_base_url;
  if (!payload?.crm_url) return '';
  const base = String(payload.crm_url).replace(/\/+$/, '');
  return `${base}/growin_app/growin_api.php`;
}

export async function resolveAgent(agentCode) {
  const code = String(agentCode || '').trim();
  if (!/^\d{5}$/.test(code)) {
    throw new Error('Agent code 5 digit ka hona chahiye.');
  }

  const url = `${MANAGER_RESOLVER_URL}?agent_code=${encodeURIComponent(code)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });

  let json = null;
  try {
    json = await response.json();
  } catch (error) {
    throw new Error('Manager response JSON format me nahi aaya.');
  }

  if (!response.ok || !json?.status) {
    throw new Error(json?.message || 'Agent code resolve nahi hua.');
  }

  return {
    ...json,
    api_base_url: normalizeCrmApiUrl(json)
  };
}

export async function loginToCrm(apiBaseUrl, username, password, agentCode) {
  if (!apiBaseUrl) throw new Error('CRM API URL missing hai.');

  const response = await fetch(`${apiBaseUrl}?endpoint=auth.login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: String(username || '').trim(),
      email: String(username || '').trim(),
      password: String(password || ''),
      agent_code: String(agentCode || '').trim(),
      device_type: 'mobile_app',
      app_name: 'Growin Staff'
    })
  });

  let json = null;
  try {
    json = await response.json();
  } catch (error) {
    throw new Error('CRM login response JSON format me nahi aaya.');
  }

  if (!response.ok || !json?.status) {
    throw new Error(json?.message || 'Login failed.');
  }

  return json;
}

export async function growinLogin({ agentCode, username, password }) {
  const agent = await resolveAgent(agentCode);
  const login = await loginToCrm(agent.api_base_url, username, password, agentCode);
  return { agent, login };
}
