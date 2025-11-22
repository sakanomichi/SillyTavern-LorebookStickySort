# Changelog

All notable changes to Lorebook Sticky Sort will be documented in this file.

## [2.2.0] - 2024-11-22

### Added
- Auto-apply default sort to unsaved lorebooks (optional toggle with configurable default sort order)
- Disabled by default to preserve SillyTavern's native behavior

### Fixed
- **Critical bug**: Corrected SORT_ORDER_NAMES mapping to match SillyTavern's actual dropdown values
  - Previous versions were storing wrong values (e.g., saving "2" for Title A-Z but ST interpreted "2" as Title Z-A)
  - **Important**: Users upgrading from 2.1.1 or earlier should use "Clear All Preferences" to reset stored values

### Changed
- Improved settings UI clarity with better labels and descriptions
- Default behavior: Auto-apply is OFF by default (keeps ST's native behavior)

## [2.1.1] - Previous Release

### Technical Improvements
- Proper event listener cleanup to prevent memory leaks
- All event listeners are tracked and cleaned up on reinitialization
- Simplified storage approach using lorebook names directly

### Fixed
- Memory leak issues from improper event listener handling
- Race conditions in event handling

## [2.1.0] - Previous Release

### Changed
- Migrated from index-based to name-based lorebook identification
- Improved reliability across SillyTavern versions

## [2.0.0] - Previous Release

### Added
- Name-based lorebook tracking (instead of index-based)
- Automatic migration from old index-based preferences

## [1.0.0] - Initial Release

### Added
- Basic sticky sort functionality
- Per-lorebook sort order memory
- Settings UI with enable/disable toggle
- Debug logging option
- Clear preferences button
