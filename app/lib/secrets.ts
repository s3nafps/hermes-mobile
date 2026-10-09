// Names are compared in snake_case, so "apiKey", "api-key" and "API_KEY" all match the same rule.
function snakeCase(name: string): string {
  return name.replace(/([a-z\d])([A-Z])/g, '$1_$2').replace(/-/g, '_').toLowerCase();
}

// Config and memory keys that hold a secret. Their values are never shown back, only "set" or "not set".
const SECRET_KEY = /(api_?key|private_?key|access_?key|(^|[_.])key$|secret|token|password|passwd|(^|[_.])pass$)/;

// Names that only point at a secret, such as "api_key_env" (an environment variable's name),
// and token budgets, such as "max_completion_tokens" or "token_budget", are not secrets.
const NOT_SECRET = /(_env$|(^|[_.])(max|min)_?([a-z]+_)?tokens?$|token_(budget|limit|count)$)/;

export function isSecretKey(name: string): boolean {
  const flat = snakeCase(name);
  return SECRET_KEY.test(flat) && !NOT_SECRET.test(flat);
}
