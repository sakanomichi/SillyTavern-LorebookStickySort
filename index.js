import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "SillyTavern-LorebookStickySort";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionDisplayName = "LorebookStickySort";

// Map sort order values to human-readable names
const SORT_ORDER_NAMES = {
    '0': 'Priority',
    '1': 'Custom',
    '2': 'Title A-Z',
    '3': 'Title Z-A',
    '4': 'Tokens ↗',
    '5': 'Tokens ↘',
    '6': 'Depth ↗',
    '7': 'Depth ↘',
    '8': 'Order ↗',
    '9': 'Order ↘',
    '10': 'UID ↗',
    '11': 'UID ↘',
    '12': 'Trigger% ↗',
    '13': 'Trigger% ↘',
    '15': 'Position ↗',
    '16': 'Position ↘'
};

// Helper for debug logging
function log(...args) {
    if (extension_settings[extensionName]?.debugMode) {
        console.log(`[${extensionDisplayName}]`, ...args);
    }
}

// Helper for regular logging
function info(...args) {
    console.log(`[${extensionDisplayName}]`, ...args);
}

// Flag to prevent recursive saves when restoring
let isRestoring = false;

// Default settings
const defaultSettings = {
    sortPreferences: {},
    enabled: true,
    debugMode: false,
    promptOnRename: true
};

// Initialize settings
function loadSettings() {
    // Initialize with defaults if doesn't exist
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = structuredClone(defaultSettings);
    }
    
    // Ensure enabled exists
    if (extension_settings[extensionName].enabled === undefined) {
        extension_settings[extensionName].enabled = true;
    }
    
    // Ensure debugMode exists
    if (extension_settings[extensionName].debugMode === undefined) {
        extension_settings[extensionName].debugMode = false;
    }
    
    // Ensure promptOnRename exists
    if (extension_settings[extensionName].promptOnRename === undefined) {
        extension_settings[extensionName].promptOnRename = true;
    }
    
    // Update UI if it exists
    const enabledCheckbox = document.querySelector('#sillytavern_lorebookstickysort_enabled');
    if (enabledCheckbox) {
        enabledCheckbox.checked = extension_settings[extensionName].enabled;
    }
    
    const debugCheckbox = document.querySelector('#sillytavern_lorebookstickysort_debug');
    if (debugCheckbox) {
        debugCheckbox.checked = extension_settings[extensionName].debugMode;
    }
    
    const promptCheckbox = document.querySelector('#sillytavern_lorebookstickysort_prompt_rename');
    if (promptCheckbox) {
        promptCheckbox.checked = extension_settings[extensionName].promptOnRename;
    }
    
    log("Settings loaded:", extension_settings[extensionName]);
}

// Get current lorebook identifier and name
function getCurrentLorebookInfo() {
    const worldSelect = document.querySelector('#world_editor_select');
    if (worldSelect && worldSelect.selectedIndex >= 0) {
        const selectedOption = worldSelect.options[worldSelect.selectedIndex];
        const name = selectedOption?.text || 'Unknown';
        
        // Skip the placeholder option
        if (name === '--- Pick to Edit ---' || worldSelect.value === '') {
            log("No lorebook selected (placeholder)");
            return null;
        }
        
        return {
            id: name,
            name: name
        };
    }
    
    log("WARNING: Could not find #world_editor_select");
    return null;
}

// Get current sort order from the dropdown
function getCurrentSortInfo() {
    const sortSelect = document.querySelector('#world_info_sort_order');
    if (sortSelect) {
        const value = sortSelect.value;
        const name = SORT_ORDER_NAMES[value] || `Unknown (${value})`;
        log("Current sort order:", value, "->", name);
        return { value, name };
    }
    return null;
}

// Apply sort order to the dropdown
function applySortOrder(sortValue) {
    const sortSelect = document.querySelector('#world_info_sort_order');
    if (sortSelect && sortValue) {
        const sortName = SORT_ORDER_NAMES[sortValue] || sortValue;
        log("Applying sort order:", sortValue, "->", sortName);
        
        isRestoring = true;
        sortSelect.value = sortValue;
        
        // Trigger change event to make ST actually apply the sort
        sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Reset flag after a short delay
        setTimeout(() => { isRestoring = false; }, 100);
    }
}

// Save current sort preference for the current lorebook
function saveSortPreference() {
    // Skip if extension is disabled
    if (!extension_settings[extensionName].enabled) {
        log("Skipping save (extension disabled)");
        return;
    }
    
    // Skip saving if we're restoring
    if (isRestoring) {
        log("Skipping save (currently restoring)");
        return;
    }
    
    const lorebookInfo = getCurrentLorebookInfo();
    const sortInfo = getCurrentSortInfo();
    
    if (lorebookInfo && sortInfo) {
        log(`Saving: "${lorebookInfo.name}" -> ${sortInfo.name}`);
        extension_settings[extensionName].sortPreferences[lorebookInfo.id] = sortInfo.value;
        saveSettingsDebounced();
    }
}

// Restore sort preference for the current lorebook
function restoreSortPreference() {
    // Skip if extension is disabled
    if (!extension_settings[extensionName].enabled) {
        log("Skipping restore (extension disabled)");
        return;
    }
    
    const lorebookInfo = getCurrentLorebookInfo();
    
    if (lorebookInfo) {
        const savedSort = extension_settings[extensionName].sortPreferences[lorebookInfo.id];
        const savedSortName = savedSort ? SORT_ORDER_NAMES[savedSort] : null;
        
        log(`Checking saved sort for "${lorebookInfo.name}":`, savedSortName || 'none');
        
        if (savedSort) {
            info(`Switched to "${lorebookInfo.name}" (restoring: ${savedSortName})`);
            applySortOrder(savedSort);
        } else {
            log(`No saved preference for "${lorebookInfo.name}"`);
        }
    }
}

// Hook into sort changes
function hookSortChanges() {
    const sortSelect = document.querySelector('#world_info_sort_order');
    
    if (sortSelect) {
        log("Found sort selector, attaching listener");
        
        // Save preference when user changes sort
        sortSelect.addEventListener('change', () => {
            log("Sort changed by user");
            saveSortPreference();
        });
    } else {
        console.warn(`[${extensionDisplayName}] WARNING: Could not find #world_info_sort_order`);
    }
}

// Hook into lorebook switching
function hookLorebookSwitch() {
    const worldSelect = $('#world_editor_select');
    
    if (worldSelect.length) {
        log("Found world editor select, attaching Select2 listener");
        
        // Select2 uses its own events
        worldSelect.on('select2:select', (e) => {
            log("Lorebook switched (Select2 event)");
            // Small delay to let ST render the new lorebook
            setTimeout(() => {
                restoreSortPreference();
            }, 100);
        });
        
        // Also try the regular change event as backup
        worldSelect.on('change', () => {
            log("Lorebook switched (change event)");
            setTimeout(() => {
                restoreSortPreference();
            }, 100);
        });
    } else {
        console.warn(`[${extensionDisplayName}] WARNING: Could not find #world_editor_select`);
    }
}

// Try to use ST events if available
function hookEvents() {
    log("Registering event listeners");
    
    // ST might have events we can use
    eventSource.on(event_types.WORLDINFO_SELECTED, (data) => {
        log("WORLDINFO_SELECTED event fired:", data);
        setTimeout(() => {
            restoreSortPreference();
        }, 100);
    });
    
    eventSource.on(event_types.WORLDINFO_SETTINGS_UPDATED, (data) => {
        log("WORLDINFO_SETTINGS_UPDATED event fired:", data);
        saveSortPreference();
    });
}

// Detect lorebook renames by watching the dropdown
function setupRenameDetection() {
    const worldSelect = document.querySelector('#world_editor_select');
    if (!worldSelect) {
        console.warn(`[${extensionDisplayName}] Cannot setup rename detection - selector not found`);
        return;
    }

    // Track current lorebook names and when it was last changed
    // Filter out the placeholder option
    let currentNames = Array.from(worldSelect.options)
    .map(opt => opt.text)
    .filter(text => text !== '--- Pick to Edit ---');
    
    // Create observer using Web API
    const observer = new MutationObserver(() => {
    const now = Date.now();
    const timeSinceLastChange = now - lastChangeTime;
    lastChangeTime = now;
    
    const newNames = Array.from(worldSelect.options)
        .map(opt => opt.text)
        .filter(text => text !== '--- Pick to Edit ---');  // Add filter here too
    const added = newNames.filter(n => !currentNames.includes(n));
    const removed = currentNames.filter(n => !newNames.includes(n));
    
    // One added + one removed within 500ms = likely a rename
    // (Delete + create would be slower and have multiple separate mutations)
    if (added.length === 1 && removed.length === 1 && timeSinceLastChange < 500) {
        handlePossibleRename(removed[0], added[0]);
    }
    
    currentNames = newNames;
});
    
    observer.observe(worldSelect, { childList: true });
    log("Rename detection active");
}

// Handle detected lorebook rename
function handlePossibleRename(oldName, newName) {
    const prefs = extension_settings[extensionName].sortPreferences;
    
    if (prefs[oldName]) {
        const sortOrder = prefs[oldName];
        const sortName = SORT_ORDER_NAMES[sortOrder];
        
        let confirmed = true;
        
        // Only prompt if setting is enabled
        if (extension_settings[extensionName].promptOnRename) {
            confirmed = confirm(
                `Detected possible lorebook rename:\n` +
                `"${oldName}" → "${newName}"\n\n` +
                `Transfer sort preference (${sortName}) to the new name?\n\n` +
                `Click OK if this is a rename, or Cancel if these are different lorebooks.`
            );
        } else {
            info(`Auto-migrating sort preference: "${oldName}" → "${newName}"`);
        }
        
        if (confirmed) {
            prefs[newName] = sortOrder;
            delete prefs[oldName];
            saveSettingsDebounced();
            info(`Sort preference migrated: "${oldName}" → "${newName}"`);
            
            if (!extension_settings[extensionName].promptOnRename) {
                toastr.success('Sort preference updated for renamed lorebook', 'Lorebook Sticky Sort');
            }
        }
    }
}

// Handle enabled toggle
function onEnabledChange(event) {
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].enabled = value;
    saveSettingsDebounced();
    info(`Extension ${value ? 'enabled' : 'disabled'}`);
}

// Handle debug mode toggle
function onDebugModeChange(event) {
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].debugMode = value;
    saveSettingsDebounced();
    info(`Debug mode ${value ? 'enabled' : 'disabled'}`);
}

// Handle prompt on rename toggle
function onPromptRenameChange(event) {
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].promptOnRename = value;
    saveSettingsDebounced();
    info(`Prompt on rename ${value ? 'enabled' : 'disabled'}`);
}

// Handle clear preferences button
function onClearPreferences() {
    const count = Object.keys(extension_settings[extensionName].sortPreferences).length;
    
    if (count === 0) {
        toastr.info('No preferences to clear', 'Lorebook Sticky Sort');
        return;
    }
    
    const confirmed = confirm(`Clear all ${count} saved lorebook sort preferences?\n\nThis cannot be undone.`);
    
    if (confirmed) {
        extension_settings[extensionName].sortPreferences = {};
        saveSettingsDebounced();
        toastr.success(`Cleared ${count} preferences`, 'Lorebook Sticky Sort');
        info(`Cleared ${count} sort preferences`);
    }
}

// Initialize the extension
async function init() {
    info("Initializing...");
    
    loadSettings();
    
    // Load settings UI
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $("#extensions_settings2").append(settingsHtml);
        
        // Bind event handlers
        $("#sillytavern_lorebookstickysort_enabled").on("input", onEnabledChange);
        $("#sillytavern_lorebookstickysort_debug").on("input", onDebugModeChange);
        $("#sillytavern_lorebookstickysort_prompt_rename").on("input", onPromptRenameChange);
        $("#sillytavern_lorebookstickysort_clear").on("click", onClearPreferences);
        
        // Update checkboxes
        $("#sillytavern_lorebookstickysort_enabled").prop("checked", extension_settings[extensionName].enabled);
        $("#sillytavern_lorebookstickysort_debug").prop("checked", extension_settings[extensionName].debugMode);
        $("#sillytavern_lorebookstickysort_prompt_rename").prop("checked", extension_settings[extensionName].promptOnRename);
        
        log("Settings UI loaded");
    } catch (error) {
        console.error(`[${extensionDisplayName}] Failed to load settings UI:`, error);
    }
    
    // Wait for ST to load UI elements
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Set up hooks
    hookSortChanges();
    hookLorebookSwitch();
    hookEvents();
    setupRenameDetection();
    
    // Try to restore for current lorebook
    restoreSortPreference();
    
    log("Initialization complete");
    log("Available event types:", Object.keys(event_types));
}

// Register
jQuery(async () => {
    await init();
});
