/** The paths of the screens, in one place: the tiles link to what the screen tasks fill. */
export const mediaPath = (mediaId: string) => `/media/${encodeURIComponent(mediaId)}`;
export const folderPath = (folderId: string) => `/folders/${encodeURIComponent(folderId)}`;
