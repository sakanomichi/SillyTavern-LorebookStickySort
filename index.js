import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "SillyTavern-LorebookStickySort";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionDisplayName = "LorebookStickySort";

// Map sort order values to human-readable names
// IMPORTANT: These values match SillyTavern's actual dropdown values!
const SORT_ORDER_NAMES = {
    '0': 'Priority',
    '1': 'Title A-Z',
    '2': 'Title Z-A',
    '3': 'Tokens ↗',
    '4': 'Tokens ↘',
    '5': 'Depth ↗',
    '6': 'Depth ↘',
    '7': 'Order ↗',
    '8': 'Order ↘',
    '9': 'UID ↗',
    '10': 'UID ↘',
    '11': 'Trigger% ↗',
    '12': 'Trigger% ↘',
    '13': 'Custom',
    '14': 'Search'  // Hidden option
};

// Helper for debug logging with call source tracking
function log(...args) {
    if (extension_settings[extensionName]?.debugMode) {
        // Add timestamp for tracking rapid-fire events
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        console.log(`[${extensionDisplayName}] [${timestamp}]`, ...args);
    }
}

// Helper for regular logging
function info(...args) {
    console.log(`[${extensionDisplayName}]`, ...args);
}

// Track event calls to detect duplicates
const eventCallTracker = {
    lastCall: null,
    callCount: 0,
    resetTimeout: null,
    
    track(eventName) {
        const now = Date.now();
        if (this.lastCall && now - this.lastCall < 200) {
            this.callCount++;
            if (this.callCount > 1) {
                log(`⚠️ DUPLICATE EVENT: "${eventName}" fired ${this.callCount} times within 200ms`);
            }
        } else {
            this.callCount = 1;
        }
        this.lastCall = now;
        
        // Reset counter after 500ms of no activity
        clearTimeout(this.resetTimeout);
        this.resetTimeout = setTimeout(() => {
            this.callCount = 0;
            this.lastCall = null;
        }, 500);
    }
}

// Diagnostic function for console testing (call with: window.lorebookStickySortDiagnostics())
window.lorebookStickySortDiagnostics = function() {
    const prefs = extension_settings[extensionName]?.sortPreferences || {};
    const settings = extension_settings[extensionName] || {};
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('   LOREBOOK STICKY SORT - DIAGNOSTICS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('📊 CURRENT SETTINGS:');
    console.log('   Enabled:', settings.enabled);
    console.log('   Debug Mode:', settings.debugMode);
    console.log('   Reset to Default:', settings.resetToDefault);
    console.log('   Default Sort Order:', settings.defaultSortOrder, '-', SORT_ORDER_NAMES[settings.defaultSortOrder]);
    console.log('');
    
    console.log('📚 SAVED PREFERENCES:', Object.keys(prefs).length, 'lorebooks');
    if (Object.keys(prefs).length > 0) {
        Object.entries(prefs).forEach(([name, sortValue]) => {
            const sortName = SORT_ORDER_NAMES[sortValue] || `Unknown (${sortValue})`;
            console.log(`   "${name}" → ${sortName} (${sortValue})`);
        });
    } else {
        console.log('   (none)');
    }
    console.log('');
    
    const currentLorebook = getCurrentLorebookName();
    const currentSort = getCurrentSortInfo();
    console.log('🎯 CURRENT STATE:');
    console.log('   Lorebook:', currentLorebook || '(none selected)');
    if (currentSort) {
        console.log('   Sort Order:', currentSort.name, `(${currentSort.value})`);
    }
    console.log('   isRestoring flag:', isRestoring);
    const timeSinceRestore = Date.now() - lastRestoreTime;
    console.log('   lastRestoreTime:', timeSinceRestore === Date.now() ? 'never' : `${timeSinceRestore}ms ago`);
    console.log('');
    
    console.log('═══════════════════════════════════════════════════════\n');
    
    return {
        settings,
        preferences: prefs,
        current: { lorebook: currentLorebook, sort: currentSort },
        flags: { isRestoring, lastRestoreTime, timeSinceRestore }
    };
};

// Flag to prevent recursive saves when restoring
let isRestoring = false;

// Timestamp of last restore operation (for debouncing)
let lastRestoreTime = 0;
const RESTORE_DEBOUNCE_MS = 300; // Don't allow restores within 300ms of each other

// Track event listeners for cleanup
let trackedListeners = [];

// Default settings
const defaultSettings = {
    sortPreferences: {},
    enabled: true,
    debugMode: false,
    resetToDefault: false,  // OFF by default - use ST's native behavior (keep current sort)
    defaultSortOrder: '0'   // Priority - user can change to any sort order (0-13 or custom)
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
    
    // Ensure resetToDefault exists (OFF by default - ST's native behavior)
    if (extension_settings[extensionName].resetToDefault === undefined) {
        extension_settings[extensionName].resetToDefault = false;
    }
    
    // Ensure defaultSortOrder exists
    if (extension_settings[extensionName].defaultSortOrder === undefined) {
        extension_settings[extensionName].defaultSortOrder = '0';  // Priority
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
    
    const resetCheckbox = document.querySelector('#sillytavern_lorebookstickysort_reset_default');
    if (resetCheckbox) {
        resetCheckbox.checked = extension_settings[extensionName].resetToDefault;
    }
    
    log("Settings loaded:", extension_settings[extensionName]);
}

// Migrate old index-based preferences to name-based (one-time, v2.0.0/v2.1.0 → v2.1.1)
function migrateOldPreferences() {
    const prefs = extension_settings[extensionName].sortPreferences;
    
    // Check if we have old numeric index keys (e.g., "0", "1", "2")
    const hasNumericKeys = Object.keys(prefs).some(key => /^\d+$/.test(key));
    
    if (!hasNumericKeys || Object.keys(prefs).length === 0) {
        log("No migration needed - preferences already use names or empty");
        return;
    }
    
    info("Migrating old index-based preferences to name-based...");
    
    const worldSelect = document.querySelector('#world_editor_select');
    if (!worldSelect || worldSelect.options.length === 0) {
        log("Cannot migrate - world select not available yet");
        return;
    }
    
    const newPrefs = {};
    let migratedCount = 0;
    
    // Convert numeric indices to lorebook names
    for (const [key, value] of Object.entries(prefs)) {
        // If it's a numeric key (old format)
        if (/^\d+$/.test(key)) {
            const index = parseInt(key);
            if (index >= 0 && index < worldSelect.options.length) {
                const lorebookName = worldSelect.options[index]?.text;
                if (lorebookName) {
                    newPrefs[lorebookName] = value;
                    migratedCount++;
                    log(`Migrated: index ${index} → "${lorebookName}" = ${value}`);
                }
            }
        } else {
            // Keep any existing name-based keys
            newPrefs[key] = value;
        }
    }
    
    if (migratedCount > 0) {
        extension_settings[extensionName].sortPreferences = newPrefs;
        saveSettingsDebounced();
        info(`Migration complete: ${migratedCount} preferences converted to name-based storage`);
    } else {
        log("Migration found no preferences to convert");
    }
}

// Clean up all tracked event listeners
function cleanupEventListeners() {
    log("Cleaning up event listeners");
    
    trackedListeners.forEach(({ element, event, handler, isJQuery }) => {
        try {
            if (isJQuery && element && element.off) {
                element.off(event, handler);
            } else if (element && element.removeEventListener) {
                element.removeEventListener(event, handler);
            } else if (element && element.removeListener) {
                element.removeListener(event, handler);
            }
        } catch (error) {
            console.warn(`[${extensionDisplayName}] Error removing listener:`, error);
        }
    });
    
    trackedListeners.length = 0;
    log("Cleanup complete");
}

// Get current lorebook name
function getCurrentLorebookName() {
    const worldSelect = document.querySelector('#world_editor_select');
    if (worldSelect && worldSelect.selectedIndex >= 0) {
        const selectedOption = worldSelect.options[worldSelect.selectedIndex];
        return selectedOption?.text || null;
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
        log(`Applying sort order: value="${sortValue}" (type: ${typeof sortValue}) -> ${sortName}`);
        
        // DEBUG: Inspect the dropdown options
        log(`   Dropdown has ${sortSelect.options.length} options:`);
        for (let i = 0; i < sortSelect.options.length; i++) {
            const opt = sortSelect.options[i];
            log(`      [${i}] value="${opt.value}" text="${opt.text}"`);
        }
        log(`   Current selected index: ${sortSelect.selectedIndex}`);
        
        isRestoring = true;
        sortSelect.value = sortValue;
        
        log(`   After setting value="${sortValue}":`);
        log(`      Selected index: ${sortSelect.selectedIndex}`);
        log(`      Selected value: "${sortSelect.value}"`);
        log(`      Selected text: "${sortSelect.options[sortSelect.selectedIndex]?.text}"`);
        
        // Trigger change event to make ST actually apply the sort
        sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Reset flag after a short delay
        setTimeout(() => { isRestoring = false; }, 100);
    }
}

// Save current sort preference for the current lorebook
function saveSortPreference() {
    eventCallTracker.track('saveSortPreference');
    
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
    
    const lorebookName = getCurrentLorebookName();
    const sortInfo = getCurrentSortInfo();
    
    if (lorebookName && sortInfo) {
        log(`💾 SAVING: "${lorebookName}" -> ${sortInfo.name} (${sortInfo.value})`);
        extension_settings[extensionName].sortPreferences[lorebookName] = sortInfo.value;
        saveSettingsDebounced();
        log(`✓ Save queued (debounced)`);
    } else {
        log("⚠️ Cannot save - missing lorebook or sort info:", { lorebookName, sortInfo });
    }
}

// Restore sort preference for the current lorebook
function restoreSortPreference() {
    eventCallTracker.track('restoreSortPreference');
    
    // DEBUG: Log call stack to identify duplicate sources
    if (extension_settings[extensionName]?.debugMode) {
        const stack = new Error().stack;
        const caller = stack.split('\n')[2]?.trim(); // Get immediate caller
        log(`   Called from: ${caller}`);
    }
    
    // Skip if extension is disabled
    if (!extension_settings[extensionName].enabled) {
        log("Skipping restore (extension disabled)");
        return;
    }
    
    // CRITICAL: Skip if already in restore cycle (prevents cascading calls)
    if (isRestoring) {
        log("⚠️ BLOCKED: Already in restore cycle, preventing cascade");
        return;
    }
    
    // CRITICAL: Debounce - don't allow restores within 300ms of each other
    const now = Date.now();
    const timeSinceLastRestore = now - lastRestoreTime;
    if (timeSinceLastRestore < RESTORE_DEBOUNCE_MS) {
        log(`⚠️ BLOCKED: Restore debounced (${timeSinceLastRestore}ms since last restore, need ${RESTORE_DEBOUNCE_MS}ms)`);
        return;
    }
    
    // Update timestamp to prevent duplicates
    lastRestoreTime = now;
    log("🔓 Restore lock acquired");
    
    const lorebookName = getCurrentLorebookName();
    
    if (lorebookName) {
        const savedSort = extension_settings[extensionName].sortPreferences[lorebookName];
        const savedSortName = savedSort ? SORT_ORDER_NAMES[savedSort] : null;
        
        log(`🔍 CHECKING: "${lorebookName}" - saved sort:`, savedSortName || 'none');
        
        if (savedSort) {
            info(`📖 Switched to "${lorebookName}" (restoring: ${savedSortName})`);
            applySortOrder(savedSort);
        } else if (extension_settings[extensionName].resetToDefault) {
            // Reset to user's chosen default sort order
            const defaultSort = extension_settings[extensionName].defaultSortOrder;
            const defaultSortName = SORT_ORDER_NAMES[defaultSort] || `Custom (${defaultSort})`;
            log(`🔄 No saved preference for "${lorebookName}" - resetting to default`);
            log(`   Default value from settings: "${defaultSort}" (type: ${typeof defaultSort})`);
            log(`   Resolved to: ${defaultSortName}`);
            applySortOrder(defaultSort);
        } else {
            // Do nothing - let ST's native behavior apply (carry over previous sort)
            log(`➡️ No saved preference for "${lorebookName}" - keeping current sort (ST default behavior)`);
        }
    }
}

// Hook into sort changes
function hookSortChanges() {
    const sortSelect = document.querySelector('#world_info_sort_order');
    
    if (sortSelect) {
        log("Found sort selector, attaching listener");
        
        // Save preference when user changes sort
        const sortChangeHandler = () => {
            log("🎯 EVENT: Sort dropdown 'change' event fired");
            saveSortPreference();
        };
        
        sortSelect.addEventListener('change', sortChangeHandler);
        
        // Track for cleanup
        trackedListeners.push({
            element: sortSelect,
            event: 'change',
            handler: sortChangeHandler,
            isJQuery: false
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
        
        // Flag to prevent duplicate execution
        let switchInProgress = false;
        
        // Handle lorebook switch with debouncing
        const handleLorebookSwitch = (eventName) => {
            log(`🎯 EVENT: Lorebook switch (${eventName})`);
            
            // Skip if a switch is already in progress
            if (switchInProgress) {
                log("⚠️ DUPLICATE PREVENTED: Switch already in progress, skipping");
                eventCallTracker.track('lorebookSwitch-BLOCKED');
                return;
            }
            
            switchInProgress = true;
            eventCallTracker.track('lorebookSwitch');
            
            // Small delay to let ST render the new lorebook
            setTimeout(() => {
                restoreSortPreference();
                // Reset switch flag after everything completes
                setTimeout(() => {
                    switchInProgress = false;
                    log("🔓 Switch lock released");
                }, 200);
            }, 100);
        };
        
        // Select2 event (primary)
        const select2Handler = (e) => {
            handleLorebookSwitch("Select2 event");
        };
        
        // Regular change event (backup for non-Select2 scenarios)
        const changeHandler = () => {
            handleLorebookSwitch("change event");
        };
        
        worldSelect.on('select2:select', select2Handler);
        worldSelect.on('change', changeHandler);
        
        // Track for cleanup
        trackedListeners.push(
            { element: worldSelect, event: 'select2:select', handler: select2Handler, isJQuery: true },
            { element: worldSelect, event: 'change', handler: changeHandler, isJQuery: true }
        );
    } else {
        console.warn(`[${extensionDisplayName}] WARNING: Could not find #world_editor_select`);
    }
}

// Try to use ST events if available
function hookEvents() {
    log("Registering event listeners");
    
    // Only listen to WORLDINFO_SETTINGS_UPDATED for save operations
    // NOTE: We don't use WORLDINFO_SELECTED because it duplicates our Select2/change listeners
    // and causes race conditions with multiple simultaneous restore calls
    const worldInfoUpdatedHandler = (data) => {
        log("🎯 EVENT: WORLDINFO_SETTINGS_UPDATED fired:", data);
        eventCallTracker.track('WORLDINFO_SETTINGS_UPDATED');
        saveSortPreference();
    };
    
    eventSource.on(event_types.WORLDINFO_SETTINGS_UPDATED, worldInfoUpdatedHandler);
    
    // Track for cleanup
    trackedListeners.push(
        { element: eventSource, event: event_types.WORLDINFO_SETTINGS_UPDATED, handler: worldInfoUpdatedHandler, isJQuery: false }
    );
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

// Handle reset to default toggle
function onResetToDefaultChange(event) {
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].resetToDefault = value;
    saveSettingsDebounced();
    updateDefaultSortVisibility();
    const defaultSortName = SORT_ORDER_NAMES[extension_settings[extensionName].defaultSortOrder] || 'custom';
    info(`Reset to default ${value ? 'enabled' : 'disabled'} - new lorebooks will ${value ? `start with ${defaultSortName}` : 'keep current sort'}`);}

// Handle default sort order dropdown
function onDefaultSortChange(event) {
    const value = $(event.target).val();
    log(`Default sort dropdown changed: raw value = "${value}", type = ${typeof value}`);
    extension_settings[extensionName].defaultSortOrder = value;
    saveSettingsDebounced();
    const sortName = SORT_ORDER_NAMES[value] || `Custom (${value})`;
    info(`Default sort order set to: ${sortName} (value: ${value})`);
}

// Show/hide default sort dropdown based on reset checkbox
function updateDefaultSortVisibility() {
    const resetEnabled = extension_settings[extensionName].resetToDefault;
    const container = $('#sillytavern_lorebookstickysort_default_sort_container');
    if (resetEnabled) {
        container.show();
    } else {
        container.hide();
    }
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
    
    // Clean up any existing listeners first (in case of reinit)
    cleanupEventListeners();
    
    loadSettings();
    
    // Load settings UI
	try {
		const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
		$("#extensions_settings2").append(settingsHtml);
		
		// Bind event handlers
		$("#sillytavern_lorebookstickysort_enabled").on("input", onEnabledChange);
		$("#sillytavern_lorebookstickysort_debug").on("input", onDebugModeChange);
		$("#sillytavern_lorebookstickysort_reset_default").on("input", onResetToDefaultChange);
		$("#sillytavern_lorebookstickysort_default_sort").on("change", onDefaultSortChange);
		$("#sillytavern_lorebookstickysort_clear").on("click", onClearPreferences);
		
		// Update checkbox states
		$("#sillytavern_lorebookstickysort_enabled").prop("checked", extension_settings[extensionName].enabled);
		$("#sillytavern_lorebookstickysort_debug").prop("checked", extension_settings[extensionName].debugMode);
		$("#sillytavern_lorebookstickysort_reset_default").prop("checked", extension_settings[extensionName].resetToDefault);
		
		// Update dropdown value and visibility
		const defaultSortValue = extension_settings[extensionName].defaultSortOrder;
		log(`Initializing default sort dropdown with value: "${defaultSortValue}" (${SORT_ORDER_NAMES[defaultSortValue]})`);
		$("#sillytavern_lorebookstickysort_default_sort").val(defaultSortValue);
		updateDefaultSortVisibility();
		
		log("Settings UI loaded");
    } catch (error) {
        console.error(`[${extensionDisplayName}] Failed to load settings UI:`, error);
    }
    
    // Wait a bit for ST to load UI elements
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Migrate old index-based preferences to name-based (one-time)
    migrateOldPreferences();
    
    // Set up our hooks
    hookSortChanges();
    hookLorebookSwitch();
    hookEvents();
    
    // Try to restore for current lorebook
    restoreSortPreference();
    
    log("Initialization complete");
    log("Available event types:", Object.keys(event_types));
}

// Wait for SillyTavern to be fully ready before initializing
eventSource.once(event_types.APP_READY, () => {
    info("SillyTavern ready, initializing extension");
    init();
});
