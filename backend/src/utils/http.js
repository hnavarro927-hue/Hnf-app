export const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload, null, 2));
};

export const sendSuccess = (response, statusCode, data, meta = {}) => {
  sendJson(response, statusCode, {
    success: true,
    data,
    meta,
  });
};

export const sendError = (response, statusCode, message, details = {}) => {
  sendJson(response, statusCode, {
    success: false,
    error: {
      message,
      ...details,
    },
  });
};

export const readJsonBody = async (request) => {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

export const matchRoute = (routes, method, pathname) => {
  const requestParts = pathname.split('/').filter(Boolean);

  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }

    const routeParts = route.path.split('/').filter(Boolean);
    if (routeParts.length !== requestParts.length) {
      continue;
    }

    const params = {};
    let isMatch = true;

    routeParts.forEach((part, index) => {
      const current = requestParts[index];
      if (part.startsWith(':')) {
        params[part.slice(1)] = current;
        return;
      }

      if (part !== current) {
        isMatch = false;
      }
    });

    if (isMatch) {
      return { route, params };
    }
  }

  return null;
};
