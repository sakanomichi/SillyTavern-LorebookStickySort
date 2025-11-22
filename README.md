# Lorebook Sticky Sort

A SillyTavern extension that automatically remembers your preferred sort order for each individual lorebook.

## Why Use This?

If you frequently switch between lorebooks that need different sort orders (e.g., Custom order for a specific type of lorebook vs UID order for a memory book), this extension eliminates the need to manually change sorting every time you switch. This was my personal pain point and why I made this.

## Features

- Each lorebook independently remembers its sort order
- Automatically restores your preferred sort when you switch lorebooks
- **NEW:** Optionally auto-apply a configurable default sort to unsaved lorebooks
- Preferences persist across browser sessions
- Optional debug logging for troubleshooting
- Clear all preferences button for easy reset

## Installation

### Manual Installation

1. Download or clone this repository
2. Copy the `SillyTavern-LorebookStickySort` folder into your SillyTavern installation:
   ```
   public/scripts/extensions/third-party/SillyTavern-LorebookStickySort/
   ```
3. Restart SillyTavern
4. The extension will load automatically

## Usage

Simply use your lorebooks as normal. When you change the sort order in a lorebook, that preference is saved. When you return to that lorebook later, your preferred sort order is automatically restored.

### Default Sort Behavior

When enabled, lorebooks without saved preferences will automatically switch to your chosen default sort order. When disabled (default), they keep whatever sort they currently have (SillyTavern's native behavior). You can configure which sort order to use as the default via a dropdown.

**Note:** If you rename a lorebook, it will be treated as a new lorebook and will use the default sort order until you set a new preference.

## Settings

Access settings through **Extensions → Lorebook Sticky Sort**:

- **Enable Sticky Sort**: Toggle the extension functionality on/off
- **Enable Debug Logging**: Shows detailed console information for troubleshooting
- **Auto-Apply Default to Unsaved Lorebooks**: When enabled, automatically applies your chosen default sort to lorebooks without saved preferences
- **Default Sort Order**: Select which sort order to use as your default (dropdown menu)
- **Clear All Preferences**: Removes all saved sort preferences (useful if you want a fresh start)

## How It Works

The extension monitors the World Info sort dropdown. When you change the sort order, it saves that preference along with the current lorebook's name. When you switch lorebooks, it checks if a saved preference exists and restores it. If no preference exists and "Auto-Apply Default to Unsaved Lorebooks" is enabled, it applies your chosen default sort order.

Preferences are stored by lorebook name in SillyTavern's extension settings. This means:
- Settings persist across browser sessions
- Settings survive lorebook deletion/reimport (as long as you keep the same name)
- Renaming a lorebook will reset its preference to default
- You can manually clear all preferences using the button in settings

## Troubleshooting

If the extension isn't working:

1. Open the browser console (F12) and look for `[LorebookStickySort]` messages
2. Enable debug logging in the extension settings
3. Verify all files are in the correct directory
4. Try clearing your browser cache
5. If preferences seem stuck, use the "Clear All Preferences" button

## Technical Details

**Supported Sort Orders:**
- Priority
- Custom
- Title (A-Z, Z-A)
- Tokens (ascending, descending)
- Depth (ascending, descending)
- Order (ascending, descending)
- UID (ascending, descending)
- Trigger% (ascending, descending)

**Technical Improvements:**
- **v2.2.0**: Fixed critical sort order value mapping bug, added default sort configuration
- **v2.1.1**: Proper event listener cleanup to prevent memory leaks
- Uses `APP_READY` event for reliable initialization timing
- All event listeners are tracked and cleaned up on reinitialization
- Simplified storage approach using lorebook names directly

The extension uses Select2 event handlers to detect lorebook switches and standard change events for sort modifications.

## License

GPL-3.0 - See [LICENSE](LICENSE) file for details.
