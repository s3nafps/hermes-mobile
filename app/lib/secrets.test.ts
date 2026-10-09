import { describe, expect, it } from 'vitest';

import { isSecretKey } from './secrets';

describe('isSecretKey', () => {
  it('treats key, token, secret and password names as secrets, in any spelling', () => {
    for (const name of [
      'providers.openai.apikey',
      'providers.anthropic.api_key',
      'channel.private_key',
      'agent.access_key',
      'channel.bot_token',
      'webhook.secret',
      'db.password',
      'key',
    ]) {
      expect(isSecretKey(name), name).toBe(true);
    }
  });

  it('does not treat variable names, token budgets or unrelated names as secrets', () => {
    for (const name of ['api_key_env', 'agent.max_tokens', 'agent.max_turns', 'monkey']) {
      expect(isSecretKey(name), name).toBe(false);
    }
  });
});
