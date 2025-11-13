# Lorebook Sticky Sort

A SillyTavern extension that enables it to automatically remember your preferred sort order for each individual lorebook.

## Why Use This?

If you frequently switch between lorebooks that need different sort orders (e.g., Custom order for a specific type of lorebook vs UID order for a memory book), this extension eliminates the need to manually change sorting every time you switch. This was my personal pain point and why I made this.

## Features

- Each lorebook independently remembers its sort order
- Automatically restores your preferred sort when you switch lorebooks
- Preferences persist across browser sessions
- Optional debug logging for troubleshooting

## Installation

### Manual Installation

1. Download or clone this repository
2. Copy the `SillyTavern-LorebookStickySort` folder into your SillyTavern installation:
   ```
   public/scripts/extensions/third-party/SillyTavern-Ghostfinder/
   ```
3. Restart SillyTavern
4. The extension will load automatically

## Usage

Simply use your lorebooks as normal. When you change the sort order in a lorebook, that preference is saved. When you return to that lorebook later, your preferred sort order is automatically restored.

## Settings

Access settings through **Extensions → Lorebook Sticky Sort**:

- **Enable Sticky Sort**: Toggle the extension functionality on/off
- **Enable Debug Logging**: Shows detailed console information for troubleshooting

## How It Works

The extension monitors the World Info sort dropdown. When you change the sort order, it saves that preference along with the current lorebook's identifier. When you switch lorebooks, it checks if a saved preference exists and restores it.

**Note**: Preferences are stored in SillyTavern's settings system, not in the extension files. Reinstalling the extension will preserve your preferences, but clearing SillyTavern settings or browser data will erase them. You can manually clear all preferences using the "Clear All Preferences" button in the extension settings.

## Troubleshooting

If the extension isn't working:

1. Open the browser console (F12) and look for `[SillyTavern-LorebookStickySort]` messages
2. Enable debug logging in the extension settings
3. Verify all files are in the correct directory
4. Try clearing your browser cache

## Technical Details

**Supported Sort Orders:**
- Priority, Custom
- Title (A-Z, Z-A)
- Tokens (ascending, descending)
- Depth (ascending, descending)
- Order (ascending, descending)
- UID (ascending, descending)
- Trigger% (ascending, descending)

The extension uses Select2 event handlers to detect lorebook switches and standard change events for sort modifications.

## License

GPL-3.0 - See [LICENSE](LICENSE) file for details.
