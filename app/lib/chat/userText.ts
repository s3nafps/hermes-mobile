// The gateway stores a sent message with the text the agent read for each attached file
// appended to it. After a reconnect the chat shows that stored text, so the file contents
// would appear as raw context in the bubble. This keeps only what the user typed.
const CONTEXT_MARKER = /\n*-{3} Attached Context -{3}[\s\S]*$/;
const FILE_REF = /^.*@file:.*$/gm;

export function userVisibleText(stored: string): string {
  const withoutContext = stored.replace(CONTEXT_MARKER, '');
  return withoutContext.replace(FILE_REF, '').replace(/\n{3,}/g, '\n\n').trim();
}
