/**
 * Where an upload hands off to the processing sheet.
 *
 * Returns the path and the state separately because they go to different
 * arguments: `navigate(pathname, { state })`. React Router's To is only
 * { pathname, search, hash }, so passing this whole object as the first
 * argument drops the state silently and the sheet has nothing to poll for.
 *
 * `uploaded` is only set when a file actually went over the wire, so the
 * processing sheet knows whether to show the upload step as already done. It is
 * omitted rather than sent false, to keep the state object minimal for the
 * YouTube and topic paths that never upload anything.
 *
 * `photo` rides along for the same reason the upload sheet needed it: the steps
 * are worded differently for a photo and a document ("Uploading photo" against
 * "Uploading document"), and the sheet would otherwise have to wait for its
 * first poll to learn which — long enough to show a spreadsheet the word
 * "photo" and then correct itself. Sent only when true, since a document is the
 * broader case and reads correctly as the default.
 */
export const buildProcessingNavigation = (
  kitId,
  sourceId,
  { uploaded = false, photo = false } = {},
) => ({
  pathname: `/kits/${kitId}/add/processing`,
  state: { kitId, sourceId, ...(uploaded && { uploaded: true }), ...(photo && { photo: true }) },
});

export const isSourceReadyForStudy = (source) => source?.status === 'ready';
