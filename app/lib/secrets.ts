// Config and memory keys that hold a secret. Their values are never shown back, only "set" or "not set".
const SECRET_KEY = /(api_?key|private_?key|access_?key|(^|[_.])key$|secret|token|password|passwd)/i;

// Names that only point at a secret, such as "api_key_env" (an environment variable's name),
// and token budgets such as "max_tokens", are not secrets.
const NOT_SECRET = /(_env$|max_?tokens?)/i;

export function isSecretKey(name: string): boolean {
  return SECRET_KEY.test(name) && !NOT_SECRET.test(name);
}
