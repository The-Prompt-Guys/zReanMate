/**
 * Which material a study screen is about.
 *
 * Selecting a file inside a kit is exclusive: `?sourceId=…` names the one
 * material to study, and everything the screen generates — summary, quiz,
 * flashcards, mock exam — is built from that file alone.
 *
 * So an explicit id NEVER falls back to another file. A file that is still
 * processing, has failed, or is not in this kit at all resolves to nothing, and
 * the screen says so. Falling back would be worse than an empty screen: the
 * student asked for cost-analyst1.pdf, and would be quietly quizzed on whatever
 * else happened to be in the kit without a word to say the subject had changed.
 *
 * With no id — the kit-wide entry from the Practice tab — the first ready file
 * stands in for the kit, which is the old behaviour and still the right one.
 */
export const resolveStudySource = (files = [], selectedSourceId = null) => {
  if (!Array.isArray(files) || files.length === 0) return null;

  if (selectedSourceId) return files.find((item) => item.id === selectedSourceId) ?? null;

  return files.find((item) => item.status === 'ready') ?? null;
};
