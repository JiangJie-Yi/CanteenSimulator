// The shop's editor (item 178, the owner's, 2026-11-15: "the developer's way of working: more professional, as the mainstream tools are, and
// split off into a tool of its own"): editor.html, the same shop drawn, always in the developer mode, laid out as the mainstream editors are
// (menus and tools along the top, the outliner on the left, the inspector on the right, a status line at the foot). The game's G opens it.

/** whether this page is the editor (editor.html's `<html data-tool="editor">`), not the game */
export const TOOL_PAGE = typeof document !== 'undefined' && document.documentElement.dataset.tool === 'editor'
/** the editor's page and the game's, each opened from the other in a tab of its own (the same tab each time) */
export const EDITOR_URL = `${import.meta.env.BASE_URL}editor.html`
export const GAME_URL = import.meta.env.BASE_URL
/** the back office's page (item 184, ui/admin): a console on the game being played in another tab */
export const ADMIN_URL = `${import.meta.env.BASE_URL}admin.html`
