// ==========================================
// Expertise Engine Game Room - Main Script
// ==========================================
console.log("--- gameroom.js SCRIPT STARTED ---");

document.addEventListener('DOMContentLoaded', () => {
    console.log("--- DOMContentLoaded: Initializing Expertise Engine Interface... ---");
    // ... rest of your gameroom.js code
});
document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing Expertise Engine Interface...");

    // --- Configuration ---
    const AIRTABLE_PROXY_URL = 'https://expertiseengineproxy.netlify.app/.netlify/functions/airtable-proxy'; // <<< REPLACE WITH YOUR ACTUAL PROXY URL
    const MAX_DICE_POOL_SIZE = 10; // Max dice allowed in pool

    // --- Global State ---
    let state = {
        loggedInPlayerId: null,
        teamId: null,
        userRole: 'player', // Default role
        teamPlayers: [], // { playerId, name, characterSheetId, heroType }
        characterData: {}, // { characterSheetId: { airtableRecord } }
        inventoryData: {}, // { characterSheetId: [ { airtableItemRecord } ] }
        dicePool: [], // { expertiseName, playerId }
        currentRollResult: null, // { outcome, successes, complications, failures, isCritSuccess, isCritFailure, xpEarned }
        currentDifficulty: 3,
        isLoading: true,
    };

    // --- DOM Element References ---
    const DOMElements = {
        body: document.body,
        loadingScreen: document.querySelector('[wized="loading-screen"]'), // Optional Wized loading screen
        characterSheetArea: document.getElementById('character-sheet-area'),
        videoRoom: document.getElementById('video-room'),
        diceRollerBar: document.getElementById('dice-roller'),
        dicePoolDisplay: document.getElementById('dice-pool-display'),
        difficultyInput: document.getElementById('difficulty-input'),
        poolStatus: document.getElementById('pool-status'),
        rollButton: document.getElementById('roll-button'),
        resetButton: document.getElementById('reset-button'),
        pushLuckButton: document.getElementById('push-luck-button'),
        payPriceButton: document.getElementById('pay-price-button'),
        resultsArea: document.getElementById('results-area'),
        outcomeDisplay: document.getElementById('outcome'),
        xpResultDisplay: document.getElementById('xp-result'),
        xpControlsArea: document.getElementById('xp-controls-area'),
        chatMessages: document.getElementById('chat-messages'),
        chatInput: document.getElementById('chat-input'),
        chatSendButton: document.getElementById('chat-send'),
        chatToggleButton: document.getElementById('chat-toggle-button'),
        onboardingFlow: document.getElementById('onboarding-flow'),
        waiverModal: document.getElementById('waiver-modal'),
        waiverCheckbox: document.getElementById('waiver-checkbox'),
        waiverAcceptButton: document.getElementById('waiver-accept-button'),
        quizModal: document.getElementById('quiz-modal'),
        quizQuestionsContainer: document.getElementById('quiz-questions-container'),
        quizSubmitButton: document.getElementById('quiz-submit-button'),
        // Template Elements (fetch from hidden container)
        templatesContainer: document.getElementById('javascript-templates'),
        characterSheetTemplate: document.querySelector('.character-sheet-template'),
        expertiseBlockTemplate: document.querySelector('.expertise-block-template'),
        specialMoveBlockTemplate: document.querySelector('.special-move-block-template'),
        healthDiamondTemplate: document.querySelector('.health-point-diamond-template'),
        inventoryItemTemplate: document.querySelector('.inventory-item-template'),
        dieTemplate: document.querySelector('.die-template'),
        chatMessageTemplate: document.querySelector('.chat-message-template'),
        diceLogEntryTemplate: document.querySelector('.dice-log-entry-template'), // Needed for dice log
        xpControlSetTemplate: document.querySelector('.xp-control-set-template'),
    };

    // --- Character Template Data (PLACEHOLDER - Needs full data for all types) ---
    const characterTemplates = {
         // <<< ADD FULL TEMPLATES FOR ALL 9 HERO TYPES HERE >>>
        'Rogue': {
            level: 1, health: 3, max_health: 3, armor_name: 'Leather Armor', armor_points: 1, max_armor_points: 1, weapon_name: 'Twin Daggers', coin: 10, adventure_gear_uses: 5, max_adventure_gear: 5,
            backstory: 'I come from [PLACE], where I [DID JOB/ACTIVITY]. One day, [BIG CHANGE/BAD THING HAPPENED].\n\nNow, I adventure to [PERSONAL GOAL].\n\nIf only my [FATAL FLAW] didn\'t keep getting in the way...',
            look_personality: '', // Add if needed
            expertise: [ { name: 'Finesse', description: 'Sneaking, acrobatics...' }, { name: 'Insight', description: 'Assessing situations...' }, { name: 'Adaptability', description: 'Street smarts...' } ],
            special_moves: [ { name: 'Roguish Talent', description: 'Choose talent...', type: 'select', options: ['Sneaking', 'Lying', 'Climbing', 'Stealing'], field: 'rogue_talent' }, { name: 'Mastermind', description: 'When teammate follows plan...' }, { name: 'Backstab', description: 'When attacking from shadows.' } ],
            initial_inventory: [ { item_name: 'Throwing Knives', quantity: 3, type: 'Gear' }, { item_name: 'Lockpicks', quantity: 1, type: 'Inventory' } ] // Example item creation
        },
        'Mystic': { /* ... Mystic data ... */ },
        'Ranger': { /* ... Ranger data ... */ },
        // ... etc for all 9 types
    };

    // --- Airtable API Helper ---
    async function callAirtableProxy(method, path, data = null) {
        const url = `${AIRTABLE_PROXY_URL}?path=${encodeURIComponent(path)}`;
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (data && (method === 'POST' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }

        try {
            console.log(`Airtable Proxy: ${method} ${path}`, data ? JSON.stringify(data).substring(0, 100) + '...' : '');
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                console.error(`Airtable Error (${response.status} for ${method} ${path}):`, errorData);
                throw new Error(`Airtable Error (${response.status}): ${errorData.message || 'Unknown error'}`);
            }
            if (response.status === 204) { return null; } // Handle No Content
            const responseData = await response.json();
            console.log(`Airtable Response for ${method} ${path}:`, JSON.stringify(responseData).substring(0,100) + '...');
            return responseData;
        } catch (error) {
            console.error(`Error calling Airtable proxy (${method} ${path}):`, error);
            // TODO: Show user-friendly error message
            throw error;
        }
    }

    // --- Initialization ---
    async function initializeApp() {
        showLoading(true);
        console.log('Getting user data from Wized attributes...');
        // --- !!! WIZED INTEGRATION POINT !!! ---
        // Wized needs to correctly populate these attributes on the body tag before this script runs.
        state.loggedInPlayerId = DOMElements.body.dataset.playerId;
        state.teamId = DOMElements.body.dataset.teamId;
        state.userRole = DOMElements.body.dataset.role || 'player'; // Default to player

        if (!state.loggedInPlayerId || !state.teamId) {
            console.error("CRITICAL: Missing player ID or team ID from body attributes. Check Wized setup.");
            alert("Error: Could not load player or team information. Please check login status.");
            showLoading(false);
            return; // Stop initialization
        }
        console.log(`User Role: ${state.userRole}, Player ID: ${state.loggedInPlayerId}, Team ID: ${state.teamId}`);

        try {
            // 1. Fetch Basic Player Info (for Waiver/HeroType Check)
            const loggedInPlayerData = await fetchPlayerData(state.loggedInPlayerId);
            if (!loggedInPlayerData) throw new Error("Failed to fetch logged-in player data.");

            // 2. Run Onboarding Flow if needed
            const onboardingComplete = await runOnboardingFlow(loggedInPlayerData);
            if (!onboardingComplete) {
                console.log("Onboarding not complete. Halting further initialization.");
                showLoading(false);
                return; // Stop if onboarding wasn't completed
            }

            // 3. Fetch Core Game Data (Team players, Sheets, Video URL)
            await Promise.all([
                fetchTeamVideoUrl(),
                fetchTeamPlayersAndSheets() // Fetches players, their sheets, and inventory
            ]);

            // 4. Render UI Components
            renderCharacterSheets();
            renderXpControls(); // Only visible if host
            updateDicePoolStatus();

            // 5. Setup Event Listeners
            setupEventListeners();

            console.log("Initialization complete.");

        } catch (error) {
            console.error("Initialization failed:", error);
            alert(`Error initializing game room: ${error.message}`);
            // Potentially show a retry button or guide user
        } finally {
            showLoading(false);
        }
    }

    // --- Loading State ---
    function showLoading(isLoading) {
        state.isLoading = isLoading;
        // Toggle a global loading class or use Wized screen
        if (DOMElements.loadingScreen) {
            DOMElements.loadingScreen.classList.toggle('hidden', !isLoading);
        } else {
            DOMElements.body.classList.toggle('is-loading', isLoading); // Fallback
        }
    }

    // --- Data Fetching ---
    async function fetchPlayerData(playerId) {
        try {
            const data = await callAirtableProxy('GET', `Players/${playerId}`);
            return data?.fields ? { id: data.id, ...data.fields } : null;
        } catch (error) {
            console.error(`Error fetching player data for ${playerId}:`, error);
            return null;
        }
    }

    async function fetchTeamVideoUrl() {
        try {
            const teamData = await callAirtableProxy('GET', `Teams/${state.teamId}`);
            const videoUrl = teamData?.fields?.video_room_url; // Ensure field name is correct
            if (videoUrl) {
                renderVideo(videoUrl);
            } else {
                console.warn("Video room URL not found for team:", state.teamId);
                DOMElements.videoRoom.innerHTML = '<p style="color: var(--text-muted);">Video room not configured.</p>';
            }
        } catch (error) {
            console.error("Error fetching video URL:", error);
            DOMElements.videoRoom.innerHTML = '<p style="color: var(--danger-color);">Error loading video room.</p>';
        }
    }

    async function fetchTeamPlayersAndSheets() {
        try {
            // Fetch players linked to the team
            // Assuming 'Players' table has a 'team_id' link field
            const filterFormula = `FIND("${state.teamId}", ARRAYJOIN({team_id}))`; // Adjust if team_id is single link
            const playersData = await callAirtableProxy('GET', `Players?filterByFormula=${encodeURIComponent(filterFormula)}&fields%5B%5D=name`); // Fetch name field

            if (!playersData?.records || playersData.records.length === 0) {
                 console.warn("No players found for team:", state.teamId);
                 state.teamPlayers = [];
                 return;
            }

            state.teamPlayers = playersData.records.map(p => ({
                playerId: p.id,
                name: p.fields.name || 'Unnamed Player',
                characterSheetId: null, // Will be fetched next
                heroType: null
            }));

            // Fetch character sheets linked to these players
            const playerIds = state.teamPlayers.map(p => p.playerId);
            const sheetFilter = `OR(${playerIds.map(id => `{player_id} = '${id}'`).join(', ')})`; // Adjust if player_id is single link
            // Fetch ALL character sheet fields
            const sheetsData = await callAirtableProxy('GET', `Character Sheets?filterByFormula=${encodeURIComponent(sheetFilter)}`);

            if (sheetsData?.records) {
                sheetsData.records.forEach(sheet => {
                    const sheetData = { id: sheet.id, ...sheet.fields };
                    // Ensure player_id is treated as an array
                     const linkedPlayerIds = Array.isArray(sheetData.player_id) ? sheetData.player_id : [sheetData.player_id];
                    const player = state.teamPlayers.find(p => linkedPlayerIds.includes(p.playerId));
                    if (player) {
                        player.characterSheetId = sheet.id;
                        player.heroType = sheetData.hero_type;
                        state.characterData[sheet.id] = sheetData;
                        // Initialize inventory for this sheet
                        state.inventoryData[sheet.id] = [];
                    }
                });
            }

            // Fetch inventory items linked to the fetched character sheets
             const sheetIds = Object.keys(state.characterData);
             if(sheetIds.length > 0) {
                 const inventoryFilter = `OR(${sheetIds.map(id => `RECORD_ID({character_sheet_link}) = '${id}'`).join(', ')})`;
                 const inventoryRecords = await callAirtableProxy('GET', `Inventory Items?filterByFormula=${encodeURIComponent(inventoryFilter)}`);
                 if (inventoryRecords?.records) {
                     inventoryRecords.records.forEach(item => {
                         const itemData = { id: item.id, ...item.fields };
                          // Ensure link is treated as an array
                         const linkedSheetIds = Array.isArray(itemData.character_sheet_link) ? itemData.character_sheet_link : [itemData.character_sheet_link];
                         if (linkedSheetIds.length > 0 && state.inventoryData[linkedSheetIds[0]]) {
                            state.inventoryData[linkedSheetIds[0]].push(itemData);
                         }
                     });
                 }
             }

             console.log("Team Players & Sheets Loaded:", state.teamPlayers, state.characterData, state.inventoryData);

        } catch (error) {
            console.error("Error fetching team players/sheets:", error);
        }
    }

    // --- Onboarding ---
    async function runOnboardingFlow(playerData) {
        const needsWaiver = !playerData.waiver_signed;
        const needsHeroType = !playerData.hero_type;

        if (!needsWaiver && !needsHeroType) {
            return true; // Onboarding already complete
        }

        DOMElements.onboardingFlow.style.display = 'flex';

        if (needsWaiver) {
            return await handleWaiver();
        } else if (needsHeroType) {
            return await handleQuiz();
        }
        return false; // Should not happen
    }

    function handleWaiver() {
        return new Promise((resolve) => {
            console.log("Showing Waiver Modal");
            DOMElements.quizModal.style.display = 'none';
            DOMElements.waiverModal.style.display = 'block';
            DOMElements.waiverCheckbox.checked = false;
            DOMElements.waiverAcceptButton.disabled = true;

            // TODO: Populate actual waiver text

            const checkboxListener = () => {
                DOMElements.waiverAcceptButton.disabled = !DOMElements.waiverCheckbox.checked;
            };
            DOMElements.waiverCheckbox.addEventListener('change', checkboxListener);

            const acceptClickListener = async () => {
                showLoading(true);
                DOMElements.waiverAcceptButton.disabled = true;
                DOMElements.waiverAcceptButton.textContent = 'Saving...';
                try {
                    await callAirtableProxy('PATCH', `Players/${state.loggedInPlayerId}`, {
                        fields: { waiver_signed: true } // Ensure field name matches Airtable
                    });
                    console.log("Waiver accepted and saved.");
                    DOMElements.waiverModal.style.display = 'none';
                    // Remove listeners
                    DOMElements.waiverCheckbox.removeEventListener('change', checkboxListener);
                    DOMElements.waiverAcceptButton.removeEventListener('click', acceptClickListener);
                    // Check if quiz is needed next
                    const updatedPlayerData = await fetchPlayerData(state.loggedInPlayerId); // Re-fetch
                    showLoading(false);
                     if (!updatedPlayerData?.hero_type) {
                        resolve(await handleQuiz()); // Proceed to quiz
                    } else {
                        DOMElements.onboardingFlow.style.display = 'none';
                        resolve(true); // Onboarding complete
                    }
                } catch (error) {
                    console.error("Failed to save waiver:", error);
                    alert("Error saving waiver acceptance. Please try again.");
                    DOMElements.waiverAcceptButton.disabled = !DOMElements.waiverCheckbox.checked;
                     DOMElements.waiverAcceptButton.textContent = 'Accept & Continue';
                     showLoading(false);
                     resolve(false); // Indicate onboarding failed here
                }
            };
            // Add ONE listener for the accept button
             DOMElements.waiverAcceptButton.addEventListener('click', acceptClickListener, { once: true }); // Use once to prevent multiple bindings if re-shown
        });
    }

     function handleQuiz() {
         return new Promise((resolve) => {
            console.log("Showing Quiz Modal");
            DOMElements.waiverModal.style.display = 'none';
            DOMElements.quizModal.style.display = 'block';
            DOMElements.quizSubmitButton.disabled = false;
            DOMElements.quizSubmitButton.textContent = 'Submit Answers';

             // --- !!! QUIZ LOGIC NEEDED !!! ---
             // 1. Define Quiz Questions & Answers
             const quizData = [ /* { question: "...", options: ["A", "B", "C"], points: { A: 'type1', B: 'type2', C: 'type3' } } ... */ ];
             // 2. Render questions into DOMElements.quizQuestionsContainer
             renderQuizQuestions(quizData);
             // 3. Add listeners to radio buttons/selectors

            const submitClickListener = async () => {
                 showLoading(true);
                 DOMElements.quizSubmitButton.disabled = true;
                 DOMElements.quizSubmitButton.textContent = 'Determining Fate...';
                try {
                     // --- !!! QUIZ SCORING NEEDED !!! ---
                     // 4. Collect answers from the form
                     const answers = getQuizAnswers();
                     // 5. Determine heroType based on answers/logic
                     const determinedHeroType = calculateHeroType(answers); // e.g., returns 'Rogue', 'Mystic' etc.

                     if (!determinedHeroType || !characterTemplates[determinedHeroType]) {
                         throw new Error(`Could not determine a valid Hero Type from quiz answers. Result: ${determinedHeroType}`);
                     }
                     console.log(`Quiz result: ${determinedHeroType}`);

                     // 6. Create Character Sheet using template
                     const template = characterTemplates[determinedHeroType];
                     const newSheetPayload = {
                         fields: {
                             ...template, // Copy base stats/info
                             player_id: [state.loggedInPlayerId], // Link to player
                             hero_type: determinedHeroType,
                             // IMPORTANT: Remove fields that should be links or handled separately
                         }
                     };
                     // Clean up payload - remove non-Airtable fields like initial_inventory, expertise objects etc.
                     // Needs careful mapping based on your final template structure
                     delete newSheetPayload.fields.expertise;
                     delete newSheetPayload.fields.special_moves;
                     delete newSheetPayload.fields.initial_inventory;
                     // Add other template fields directly

                     console.log("Creating character sheet with payload:", newSheetPayload);
                     const createdSheet = await callAirtableProxy('POST', 'Character Sheets', newSheetPayload);

                     // 7. Create Initial Inventory Items (if any defined in template)
                     if (template.initial_inventory && template.initial_inventory.length > 0 && createdSheet?.id) {
                          const inventoryPromises = template.initial_inventory.map(item => {
                              const itemPayload = {
                                  fields: {
                                      item_name: item.item_name,
                                      quantity: item.quantity || 1,
                                      type: item.type || 'Gear', // Default to Gear
                                      character_sheet_link: [createdSheet.id] // Link to the NEW sheet
                                  }
                              };
                               console.log("Creating inventory item:", itemPayload);
                              return callAirtableProxy('POST', 'Inventory Items', itemPayload);
                          });
                          await Promise.all(inventoryPromises);
                          console.log("Initial inventory items created.");
                     } else {
                         console.log("No initial inventory defined or sheet creation failed.");
                     }


                     // 8. Update Player record with hero_type
                     console.log(`Updating Player ${state.loggedInPlayerId} with hero_type: ${determinedHeroType}`);
                     await callAirtableProxy('PATCH', `Players/${state.loggedInPlayerId}`, {
                         fields: { hero_type: determinedHeroType }
                     });

                     console.log("Onboarding quiz complete and data saved.");
                     DOMElements.quizModal.style.display = 'none';
                     DOMElements.onboardingFlow.style.display = 'none';
                      DOMElements.quizSubmitButton.removeEventListener('click', submitClickListener);
                     showLoading(false);
                     resolve(true); // Onboarding successful

                 } catch (error) {
                     console.error("Failed during quiz processing:", error);
                     alert(`Error completing onboarding: ${error.message}. Please try again.`);
                     DOMElements.quizSubmitButton.disabled = false;
                     DOMElements.quizSubmitButton.textContent = 'Submit Answers';
                     showLoading(false);
                     resolve(false); // Indicate onboarding failed
                 }
             };
              // Add ONE listener
             DOMElements.quizSubmitButton.addEventListener('click', submitClickListener, { once: true });
         });
    }

     function renderQuizQuestions(quizData) {
        // TODO: Implement logic to dynamically create HTML for questions/answers
        DOMElements.quizQuestionsContainer.innerHTML = '<p style="color:red;">Quiz rendering logic needed!</p>';
     }
     function getQuizAnswers() {
         // TODO: Implement logic to collect selected answers from the rendered quiz form
         return {}; // Placeholder
     }
     function calculateHeroType(answers) {
         // TODO: Implement the logic to determine HeroType from answers object
         console.warn("calculateHeroType logic not implemented. Returning default 'Rogue'.");
         return 'Rogue'; // Placeholder
     }


    // --- UI Rendering ---
    function renderVideo(url) {
        if (!DOMElements.videoRoom) return;
        const iframe = document.createElement('iframe');
        iframe.setAttribute('src', url);
        iframe.setAttribute('allow', 'camera; microphone; fullscreen; speaker; display-capture');
        iframe.style.width = '100%';
        iframe.style.height = '100%'; // Let container control height
        iframe.style.border = 'none';
        DOMElements.videoRoom.innerHTML = ''; // Clear placeholder
        DOMElements.videoRoom.appendChild(iframe);
         console.log("Video embedded:", url);
    }

    function renderCharacterSheets() {
        if (!DOMElements.characterSheetArea || !DOMElements.characterSheetTemplate) return;

        // Clear previous sheets (except the template itself)
        DOMElements.characterSheetArea.innerHTML = ''; // Clear placeholder/old sheets

        // Use state.teamPlayers which now contains characterSheetId and heroType
        state.teamPlayers.forEach(player => {
            const characterSheetId = player.characterSheetId;
            if (!characterSheetId || !state.characterData[characterSheetId]) {
                console.warn(`No character sheet found for player: ${player.name} (${player.playerId})`);
                // Optionally render a placeholder saying "Character not created"
                return;
            }

            const sheetData = state.characterData[characterSheetId];
            const inventory = state.inventoryData[characterSheetId] || [];
            const isOwnSheet = player.playerId === state.loggedInPlayerId;

            const sheetElement = DOMElements.characterSheetTemplate.firstElementChild.cloneNode(true);
            sheetElement.dataset.characterId = characterSheetId;
            sheetElement.dataset.playerId = player.playerId;

            // Populate fields
            populateField(sheetElement, 'playerName', player.name);
            populateField(sheetElement, 'hero_type', sheetData.hero_type || 'Unknown');
            populateField(sheetElement, 'level', sheetData.level || 1);
            // Add portraitUrl population if field exists
             const portraitImg = sheetElement.querySelector('[data-field="portraitUrl"]');
             if(portraitImg) portraitImg.src = sheetData.portraitUrl || `https://via.placeholder.com/70x70.png/cccccc/ffffff?text=${player.name.charAt(0)}`;

            // Health & Armor
            renderHealthDiamonds(sheetElement.querySelector('.health-points-container'), sheetData.health, sheetData.max_health);
            renderCounterWidget(sheetElement.querySelector('.counter-widget[data-field="armor_points"]'), sheetData.armor_points, sheetData.max_armor_points);
            populateField(sheetElement, 'armor_name', sheetData.armor_name);
            populateField(sheetElement, 'armor_name_display', `${sheetData.armor_name || 'None'} (${sheetData.armor_points || 0} Pts)`);


            // Text Areas
            populateField(sheetElement, 'backstory', sheetData.backstory || '');
            // populateField(sheetElement, 'look_personality', sheetData.look_personality || ''); // Removed

            // Expertise
            const expertiseList = sheetElement.querySelector('.expertise-list');
            expertiseList.innerHTML = ''; // Clear template content
            // Assumes expertise stored like expertise_1_name, expertise_1_desc etc. Adapt if needed.
            for (let i = 1; i <= 3; i++) {
                const name = sheetData[`expertise_${i}_name`];
                const desc = sheetData[`expertise_${i}_desc`];
                if (name) {
                    expertiseList.appendChild(renderExpertiseBlock(name, desc));
                }
            }

            // Special Moves
             const specialMovesList = sheetElement.querySelector('.special-moves-list');
             specialMovesList.innerHTML = '';
             // TODO: Needs more robust logic based on characterTemplates definition
             // This is a basic example assuming text descriptions
             for (let i = 1; i <= 3; i++) {
                 const name = sheetData[`special_move_${i}_name`];
                 const desc = sheetData[`special_move_${i}_desc`];
                  const type = ''; // Determine type from template (e.g., 'select', 'textarea')
                  const field = ''; // Determine target field from template (e.g., 'rogue_talent')
                  const options = []; // Determine options from template
                 if (name) {
                     specialMovesList.appendChild(renderSpecialMoveBlock(name, desc, type, field, options, sheetData[field]));
                 }
             }

            // Gear & Inventory
            populateField(sheetElement, 'weapon_name', sheetData.weapon_name || 'Unarmed');
            renderGearUsesDiamonds(sheetElement.querySelector('.gear-uses-container'), sheetData.adventure_gear_uses, sheetData.max_adventure_gear);
            populateField(sheetElement, 'max_adventure_gear', sheetData.max_adventure_gear || 0);
            renderCounterWidget(sheetElement.querySelector('.counter-widget[data-field="coin"]'), sheetData.coin, null); // No max for coin

             const inventoryList = sheetElement.querySelector('.inventory-list');
             inventoryList.innerHTML = '';
             inventory.forEach(item => {
                 if(item.type === 'Inventory') { // Only show type 'Inventory' here
                    inventoryList.appendChild(renderInventoryItem(item));
                 }
             });
             const gearList = sheetElement.querySelector('.gear-item-list'); // Find specific gear list if added
             if (gearList) {
                 gearList.innerHTML = '';
                 inventory.forEach(item => {
                     if (item.type === 'Gear') { // Only show type 'Gear' here
                         gearList.appendChild(renderInventoryItem(item));
                     }
                 });
             }

            // Set Editability
            setElementEditability(sheetElement, isOwnSheet);

            DOMElements.characterSheetArea.appendChild(sheetElement);
        });
        console.log("Character sheets rendered.");
    }

    function renderExpertiseBlock(name, description) {
        if (!DOMElements.expertiseBlockTemplate) return null;
        const block = DOMElements.expertiseBlockTemplate.firstElementChild.cloneNode(true);
        populateField(block, 'expertise_name', name);
        populateField(block, 'expertise_description', description);
        const button = block.querySelector('.add-to-roll-button');
        if(button) button.dataset.expertiseName = name;
        return block;
    }

     function renderSpecialMoveBlock(name, description, type = 'text', field = null, options = [], currentValue = null) {
         if (!DOMElements.specialMoveBlockTemplate) return null;
         const block = DOMElements.specialMoveBlockTemplate.firstElementChild.cloneNode(true);
         populateField(block, 'special_move_name', name);
         populateField(block, 'special_move_description', description);
          const useButton = block.querySelector('.use-special-move-button');
          if (useButton) useButton.dataset.moveName = name;

         // TODO: Handle 'select' and 'textarea' types based on template definition
         // const selectWrapper = block.querySelector('.special-move-selector-wrapper');
         // const textareaWrapper = block.querySelector('[data-field="editable_special_move_text"]');
         // Hide/show/populate based on 'type'

         return block;
     }

    function renderInventoryItem(itemData) {
        if (!DOMElements.inventoryItemTemplate) return null;
        const itemElement = DOMElements.inventoryItemTemplate.firstElementChild.cloneNode(true);
        itemElement.dataset.itemId = itemData.id;
        populateField(itemElement, 'item_name', itemData.item_name || 'Unknown Item');
        populateField(itemElement, 'quantity', `(${itemData.quantity || 1})`);
        return itemElement;
    }

     function renderHealthDiamonds(container, current, max) {
         if (!container || !DOMElements.healthDiamondTemplate) return;
         container.innerHTML = ''; // Clear existing
         current = parseInt(current) || 0;
         max = parseInt(max) || 3; // Default max
         for (let i = 0; i < max; i++) {
             const diamond = DOMElements.healthDiamondTemplate.firstElementChild.cloneNode(true);
             if (i < current) {
                 diamond.classList.add('active');
             }
             container.appendChild(diamond);
         }
     }
     function renderGearUsesDiamonds(container, current, max) {
          // Same logic as health diamonds, just using the gear container
         renderHealthDiamonds(container, current, max);
     }

    function renderCounterWidget(widgetElement, current, max = null) {
        if (!widgetElement) return;
        const currentValueSpan = widgetElement.querySelector('.current-value');
        const maxValueSpan = widgetElement.querySelector('.max-value');
        current = parseInt(current) || 0;
        if (currentValueSpan) currentValueSpan.textContent = current;
        if (maxValueSpan) maxValueSpan.textContent = parseInt(max) || '?';

        // Set max attribute if max is provided
        if (max !== null) widgetElement.dataset.max = parseInt(max); else delete widgetElement.dataset.max;
        // Set min attribute if needed (default handled in markup)
        // widgetElement.dataset.min = 0;
    }

    function setElementEditability(sheetElement, isEditable) {
        sheetElement.querySelectorAll('textarea, select, input[type="number"], .health-point-diamond, .gear-uses-container .health-point-diamond, .counter-widget button, .add-button, .delete-item-button')
            .forEach(el => {
                if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.tagName === 'INPUT') {
                    el.disabled = !isEditable;
                } else {
                    // For buttons and clickable divs, visually disable
                    el.style.pointerEvents = isEditable ? 'auto' : 'none';
                    el.style.opacity = isEditable ? '1' : '0.6';
                }
            });

        // Specifically hide Add buttons if not own sheet
        sheetElement.querySelectorAll('.add-button').forEach(btn => {
            btn.classList.toggle('hidden', !isEditable);
        });
    }

     function populateField(parentElement, fieldName, value) {
         const element = parentElement.querySelector(`[data-field="${fieldName}"]`);
         if (element) {
             if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
                 element.value = value !== null ? value : '';
             } else if (element.tagName === 'IMG') {
                 element.src = value || ''; // Handle empty image src
             } else if (element.tagName === 'P' && element.dataset.field.includes('description')) {
                 // Simple markdown for descriptions? (Optional)
                 element.innerHTML = value ? value.replace(/\n/g, '<br>') : '';
             }
             else {
                 element.textContent = value !== null ? value : '-';
             }
         } else {
            // console.warn(`populateField: Element for data-field="${fieldName}" not found.`);
         }
     }

    function renderXpControls() {
        if (state.userRole !== 'host' || !DOMElements.xpControlsArea || !DOMElements.xpControlSetTemplate) {
            // Clear area if not host (CSS also hides it)
             if(DOMElements.xpControlsArea) DOMElements.xpControlsArea.innerHTML = '';
            return;
        }

        DOMElements.xpControlsArea.innerHTML = ''; // Clear placeholder
        const template = DOMElements.xpControlSetTemplate.firstElementChild;

        state.teamPlayers.forEach(player => {
             if (player.playerId === state.loggedInPlayerId) return; // Don't show controls for self

            const controlSet = template.cloneNode(true);
            controlSet.dataset.targetPlayerId = player.playerId;
            const nameSpan = controlSet.querySelector('.xp-target-player-name');
            if (nameSpan) nameSpan.textContent = player.name;
            DOMElements.xpControlsArea.appendChild(controlSet);
        });
        console.log("XP Controls Rendered for Host.");
    }

    // --- Event Handling ---
    function setupEventListeners() {
         console.log("Setting up event listeners...");
        // Use event delegation on common parents
        DOMElements.characterSheetArea.addEventListener('click', handleSidebarInteraction);
        DOMElements.characterSheetArea.addEventListener('change', handleSidebarChange); // For select/checkbox
        DOMElements.characterSheetArea.addEventListener('blur', handleSidebarChange, true); // For textarea/input focus out

        DOMElements.diceRollerBar.addEventListener('click', handleDiceBarInteraction);
        DOMElements.difficultyInput?.addEventListener('change', handleDifficultyChange);

        DOMElements.chatSendButton?.addEventListener('click', handleSendChat);
        DOMElements.chatInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSendChat(); });
        DOMElements.chatToggleButton?.addEventListener('click', () => document.body.classList.toggle('chat-collapsed'));

        // Onboarding Listeners (if needed after initial load)
        DOMElements.waiverCheckbox?.addEventListener('change', () => {
            DOMElements.waiverAcceptButton.disabled = !DOMElements.waiverCheckbox.checked;
        });
        DOMElements.waiverAcceptButton?.addEventListener('click', async () => {
            // Re-check logic if onboarding is somehow re-triggered
             if (!DOMElements.waiverCheckbox.checked) return;
             showLoading(true);
             try {
                await callAirtableProxy('PATCH', `Players/${state.loggedInPlayerId}`, { fields: { waiver_signed: true } });
                const updatedPlayerData = await fetchPlayerData(state.loggedInPlayerId);
                showLoading(false);
                 if (updatedPlayerData && !updatedPlayerData.hero_type) {
                    await handleQuiz(); // Needs to return promise resolution
                 } else {
                     DOMElements.onboardingFlow.style.display = 'none';
                     // Re-initialize if needed, or just reload
                     window.location.reload(); // Simple way to refresh state
                 }
             } catch (error) { alert('Error saving waiver.'); showLoading(false); }
        });
         DOMElements.quizSubmitButton?.addEventListener('click', async () => {
            // Re-check logic if onboarding is somehow re-triggered
             showLoading(true);
              try {
                    // Duplicate logic from handleQuiz promise - refactor needed
                    const answers = getQuizAnswers();
                    const determinedHeroType = calculateHeroType(answers);
                     if (!determinedHeroType || !characterTemplates[determinedHeroType]) throw new Error(`Invalid Hero Type: ${determinedHeroType}`);
                     const template = characterTemplates[determinedHeroType];
                     const newSheetPayload = { fields: { /* ... build payload ... */ player_id: [state.loggedInPlayerId], hero_type: determinedHeroType } };
                      delete newSheetPayload.fields.expertise; delete newSheetPayload.fields.special_moves; delete newSheetPayload.fields.initial_inventory;
                     const createdSheet = await callAirtableProxy('POST', 'Character Sheets', newSheetPayload);
                     // Create inventory... (refactor needed)
                      if (template.initial_inventory && createdSheet?.id) { /* ... create items ... */ }
                     await callAirtableProxy('PATCH', `Players/${state.loggedInPlayerId}`, { fields: { hero_type: determinedHeroType } });
                    showLoading(false);
                    DOMElements.onboardingFlow.style.display = 'none';
                    window.location.reload(); // Simple refresh
              } catch (error) { alert(`Error saving quiz: ${error.message}`); showLoading(false); }
         });

         // XP Buttons
         DOMElements.xpControlsArea.addEventListener('click', handleXpButtonClick);
    }

    function handleSidebarInteraction(event) {
        // Add to Roll Button
        const addToRollButton = event.target.closest('.add-to-roll-button');
        if (addToRollButton && !addToRollButton.disabled) {
            handleAddDieToPool(addToRollButton);
            return;
        }
         // Use Special Move Button
         const useMoveButton = event.target.closest('.use-special-move-button');
         if (useMoveButton && !useMoveButton.disabled) {
            handleUseSpecialMove(useMoveButton);
             return;
         }
        // Add Item/Gear Button
        if (event.target.matches('#add-gear-button') || event.target.matches('#add-inventory-button')) {
             const type = event.target.id.includes('gear') ? 'Gear' : 'Inventory';
             handleAddItem(event.target.closest('.character-sheet'), type);
             return;
        }
        // Delete Item Button
        const deleteItemButton = event.target.closest('.delete-item-button');
        if (deleteItemButton) {
            const itemElement = deleteItemButton.closest('.inventory-item');
            handleDeleteItem(itemElement);
            return;
        }
        // Health/Gear Diamonds
        const diamond = event.target.closest('.health-point-diamond');
        if (diamond) {
            const container = diamond.parentElement;
            if (container?.matches('.health-points-container, .gear-uses-container')) {
                handleResourceDiamondClick(diamond, container);
                 return;
            }
        }
        // Counter Buttons
        const counterButton = event.target.closest('.decrement-button, .increment-button');
        if (counterButton) {
            handleCounterButtonClick(counterButton);
            return;
        }
    }

    function handleSidebarChange(event) {
        const target = event.target;
        const sheetElement = target.closest('.character-sheet');
        if (!sheetElement || sheetElement.dataset.playerId !== state.loggedInPlayerId) {
             // console.log("Change detected on non-editable element or other player's sheet.");
            return; // Ignore changes on non-owned sheets or non-form elements
        }

        if (target.matches('textarea[data-field], select[data-field]') || (event.type === 'blur' && target.matches('input[data-field]'))) {
             const fieldName = target.dataset.field;
             let value = target.value;
             const characterId = sheetElement.dataset.characterId;

              // Basic validation/parsing if needed
              if(target.type === 'number') value = parseInt(value) || 0;

             console.log(`Saving field ${fieldName} for ${characterId} with value: ${value}`);
             updateAirtableField(characterId, 'Character Sheets', fieldName, value); // Debounce this?
        }
    }

     function handleXpButtonClick(event) {
         const xpButton = event.target.closest('.xp-button');
         if (xpButton && state.userRole === 'host') {
             const amount = parseInt(xpButton.dataset.xpAmount);
             const targetPlayerId = xpButton.closest('.xp-control-set')?.dataset.targetPlayerId;
             if (amount && targetPlayerId) {
                 assignXp(targetPlayerId, amount);
             }
         }
     }

    async function updateAirtableField(recordId, tableName, fieldName, value, elementToUpdate = null, isSavingClass = 'is-saving') {
        // Add visual saving indicator
         if (elementToUpdate) elementToUpdate.classList.add(isSavingClass);

         try {
             const payload = { fields: { [fieldName]: value } };
             await callAirtableProxy('PATCH', `${tableName}/${recordId}`, payload);
             console.log(`Successfully updated ${tableName}/${recordId} field ${fieldName}`);
             // Update local state? For complex fields maybe, or rely on refresh?
             // state.characterData[recordId][fieldName] = value; // Example direct update

         } catch (error) {
             console.error(`Failed to update ${fieldName}:`, error);
             alert(`Error saving ${fieldName}. Please try again.`);
             // TODO: Revert visual change if needed
         } finally {
             // Remove visual saving indicator
              if (elementToUpdate) elementToUpdate.classList.remove(isSavingClass);
         }
    }

    // --- Item Management ---
     async function handleAddItem(sheetElement, type = 'Inventory') {
         if (!sheetElement) return;
         const characterId = sheetElement.dataset.characterId;
         if (sheetElement.dataset.playerId !== state.loggedInPlayerId) return; // Can only add to own sheet

         const itemName = prompt(`Enter name for new ${type} item:`);
         if (!itemName || itemName.trim() === '') return;

          const quantity = prompt(`Enter quantity for ${itemName}:`, "1");
          const qtyNum = parseInt(quantity) || 1;

         showLoading(true);
         try {
             const payload = {
                 fields: {
                     item_name: itemName.trim(),
                     quantity: qtyNum,
                     type: type,
                     character_sheet_link: [characterId]
                 }
             };
             const newItem = await callAirtableProxy('POST', 'Inventory Items', payload);

             if (newItem?.id) {
                const newItemData = { id: newItem.id, ...newItem.fields };
                 // Add to local state
                 if (!state.inventoryData[characterId]) state.inventoryData[characterId] = [];
                 state.inventoryData[characterId].push(newItemData);
                 // Add to UI
                 const listElement = sheetElement.querySelector(type === 'Gear' ? '.gear-item-list' : '.inventory-list'); // Find correct list
                  if(listElement) listElement.appendChild(renderInventoryItem(newItemData));
                  else console.warn(`List element not found for type ${type}`); // Fallback if only one list exists
             }
         } catch (error) {
             alert(`Failed to add item: ${error.message}`);
         } finally {
             showLoading(false);
         }
     }

     async function handleDeleteItem(itemElement) {
         if (!itemElement) return;
         const itemId = itemElement.dataset.itemId;
         const characterId = itemElement.closest('.character-sheet')?.dataset.characterId;
         if (!itemId || !characterId) return;
          if (itemElement.closest('.character-sheet').dataset.playerId !== state.loggedInPlayerId) return; // Can only delete from own sheet

         if (!confirm(`Are you sure you want to delete "${itemElement.querySelector('.item-name')?.textContent || 'this item'}"?`)) {
             return;
         }

         showLoading(true);
         try {
             await callAirtableProxy('DELETE', `Inventory Items/${itemId}`);
             // Remove from local state
             state.inventoryData[characterId] = state.inventoryData[characterId]?.filter(item => item.id !== itemId);
             // Remove from UI
             itemElement.remove();
         } catch (error) {
             alert(`Failed to delete item: ${error.message}`);
         } finally {
             showLoading(false);
         }
     }

    // --- Resource Management (Counters / Diamonds) ---
    function handleResourceDiamondClick(diamondElement, containerElement) {
        const sheetElement = diamondElement.closest('.character-sheet');
        const characterId = sheetElement?.dataset.characterId;
        if (!characterId || sheetElement.dataset.playerId !== state.loggedInPlayerId) return; // Only own sheet

        const field = containerElement.dataset.field;
        const diamonds = Array.from(containerElement.querySelectorAll('.health-point-diamond'));
        const clickedIndex = diamonds.indexOf(diamondElement);
        let newValue = 0;

        // If clicking an active diamond, the new value is the index before it (or 0).
        // If clicking an inactive diamond, the new value is its index + 1.
        if (diamondElement.classList.contains('active')) {
            newValue = clickedIndex; // Value becomes index (0-based) before the clicked one
        } else {
            newValue = clickedIndex + 1;
        }

        console.log(`Diamond click for ${field}: new value ${newValue}`);
        renderHealthDiamonds(containerElement, newValue, diamonds.length); // Update UI immediately
        updateAirtableField(characterId, 'Character Sheets', field, newValue); // Save update
    }

    function handleCounterButtonClick(buttonElement) {
        const widget = buttonElement.closest('.counter-widget');
        const sheetElement = widget?.closest('.character-sheet');
        const characterId = sheetElement?.dataset.characterId;

        if (!widget || !characterId || sheetElement.dataset.playerId !== state.loggedInPlayerId) return; // Only own sheet

        const field = widget.dataset.field;
        const valueSpan = widget.querySelector('.current-value');
        const maxSpan = widget.querySelector('.max-value');
        const isIncrement = buttonElement.classList.contains('increment-button');

        let currentVal = parseInt(valueSpan?.textContent) || 0;
        const maxVal = maxSpan ? (parseInt(widget.dataset.max || maxSpan.textContent) || null) : null; // Use data-max if available
        const minVal = parseInt(widget.dataset.min) || 0;

        let newValue = isIncrement ? currentVal + 1 : currentVal - 1;

        // Apply limits
        if (newValue < minVal) newValue = minVal;
        if (maxVal !== null && newValue > maxVal) newValue = maxVal;

        console.log(`Counter click for ${field}: new value ${newValue}`);
        valueSpan.textContent = newValue; // Update UI immediately
        updateAirtableField(characterId, 'Character Sheets', field, newValue); // Save update
    }

     // --- Dice Roller Logic ---
     function handleAddDieToPool(buttonElement) {
         const expertiseName = buttonElement.dataset.expertiseName;
         const sheetElement = buttonElement.closest('.character-sheet');
         const playerId = sheetElement?.dataset.playerId; // Track who added the die

         if (!expertiseName || !playerId) {
             console.warn("Could not add die: Missing expertise name or player ID.");
             return;
         }
         if (state.dicePool.length >= MAX_DICE_POOL_SIZE) {
             alert(`Maximum dice pool size (${MAX_DICE_POOL_SIZE}) reached.`);
             return;
         }

         // Add die to state
         state.dicePool.push({ expertiseName, playerId });
         console.log('Dice Pool:', state.dicePool);

         // Update UI
         renderDicePool();
         updateDicePoolStatus();
         // Visual feedback on button
         buttonElement.classList.add('added');
         buttonElement.textContent = 'Added';
         buttonElement.disabled = true;
     }

      function handleUseSpecialMove(buttonElement) {
          const moveName = buttonElement.dataset.moveName;
           const sheetElement = buttonElement.closest('.character-sheet');
          const playerId = sheetElement?.dataset.playerId;

          if (!moveName || !playerId) return;

           // TODO: Implement Special Move Logic
           // - Does it cost something? (e.g., Difficulty slot reduction?)
           // - Does it grant a bonus?
           // - Does it just happen (description)?
           console.log(`Player ${playerId} used Special Move: ${moveName}`);
           alert(`Using special move "${moveName}" - functionality pending.`);

          // Visually mark as used (optional, might reset per turn/encounter)
          buttonElement.classList.add('used');
          buttonElement.textContent = 'Used';
          buttonElement.disabled = true;
      }

     function renderDicePool() {
         if (!DOMElements.dicePoolDisplay || !DOMElements.dieTemplate) return;
         DOMElements.dicePoolDisplay.innerHTML = ''; // Clear old dice
         state.dicePool.forEach(dieInfo => {
             const dieElement = DOMElements.dieTemplate.firstElementChild.cloneNode(true);
             const visual = dieElement.querySelector('.die-visual');
             const label = dieElement.querySelector('.expertise-label');
             visual.dataset.expertiseName = dieInfo.expertiseName;
             visual.dataset.playerId = dieInfo.playerId;
             if(label) label.textContent = dieInfo.expertiseName;
             DOMElements.dicePoolDisplay.appendChild(dieElement);
         });
     }

     function updateDicePoolStatus() {
         if (!DOMElements.poolStatus) return;
         state.currentDifficulty = parseInt(DOMElements.difficultyInput?.value) || 3; // Update state from input
         const diceCount = state.dicePool.length;
         DOMElements.poolStatus.textContent = `Target: ${state.currentDifficulty} | Dice: ${diceCount}`;
         // Enable/Disable Roll button
         if (DOMElements.rollButton) DOMElements.rollButton.disabled = (diceCount === 0);
     }

     function handleDifficultyChange() {
        updateDicePoolStatus(); // Update the displayed target number
     }

     function handleDiceBarInteraction(event) {
         if (event.target.matches('#reset-button')) {
             resetDicePool();
         } else if (event.target.matches('#roll-button') && state.userRole === 'host' && state.dicePool.length > 0) {
             rollDiceSequence();
         } else if (event.target.matches('#push-luck-button') && state.userRole === 'host') {
             // TODO: Implement Push Luck logic
             alert("Push Luck logic not yet implemented.");
         } else if (event.target.matches('#pay-price-button') && state.userRole === 'host') {
             // TODO: Implement Pay Price logic
             alert("Pay Price logic not yet implemented.");
         }
     }

     function resetDicePool() {
         console.log("Resetting dice pool.");
         state.dicePool = [];
         state.currentRollResult = null;
         renderDicePool();
         updateDicePoolStatus();
         // Reset buttons on character sheets
         document.querySelectorAll('.add-to-roll-button.added').forEach(btn => {
             btn.classList.remove('added');
             btn.textContent = 'Add';
             btn.disabled = false;
         });
          document.querySelectorAll('.use-special-move-button.used').forEach(btn => {
             btn.classList.remove('used');
             btn.textContent = 'Use';
             btn.disabled = false;
         });
         // Hide results area
         DOMElements.resultsArea?.classList.add('hidden');
         DOMElements.pushLuckButton?.style.display = 'none';
         DOMElements.payPriceButton?.style.display = 'none';
         if (DOMElements.rollButton) DOMElements.rollButton.disabled = true;
     }

     async function rollDiceSequence() {
         if (state.userRole !== 'host' || state.dicePool.length === 0) return;
         console.log("Starting dice roll sequence...");

         // Disable controls during roll
         DOMElements.rollButton.disabled = true;
         DOMElements.resetButton.disabled = true;
         DOMElements.pushLuckButton.style.display = 'none';
         DOMElements.payPriceButton.style.display = 'none';
         DOMElements.resultsArea?.classList.add('hidden');

         const diceElements = DOMElements.dicePoolDisplay.querySelectorAll('.die-visual');
         let highestRoll = 0;
         let critSuccess = false;
         let critFailure = false;
         const results = []; // Store individual results { value, isSuccess, isComplication, isSilverLining }

         for (let i = 0; i < state.dicePool.length; i++) {
             const dieValue = Math.floor(Math.random() * 6) + 1;
             results.push(dieValue);

             // Animate the die (basic example)
             const dieElement = diceElements[i];
             if (dieElement) {
                 const resultSpan = dieElement.querySelector('.die-result') || dieElement; // Use element itself if no span
                 resultSpan.textContent = '?'; // Reset visual
                  // Add temporary rolling class?
                  await new Promise(resolve => setTimeout(resolve, 150)); // Short delay
                 resultSpan.textContent = dieValue;
                 // Remove old result classes
                  dieElement.classList.remove('rolled-1', 'rolled-6', 'rolled-2', 'rolled-3', 'rolled-4', 'rolled-5');
                 // Add new result class
                  dieElement.classList.add(`rolled-${dieValue}`);
             }

             await new Promise(resolve => setTimeout(resolve, 300)); // Delay between dice

             if (dieValue === 6) {
                 critSuccess = true;
                 console.log("Roll stopped: Critical Success (6)!");
                 break; // Stop rolling on 6
             }
             if (dieValue === 1) {
                 critFailure = true;
                 console.log("Roll stopped: Critical Failure (1)!");
                 // TODO: Show "Pay Price" button? For now, just stop.
                 // DOMElements.payPriceButton.style.display = 'inline-block';
                 break; // Stop rolling on 1
             }
             if (dieValue > highestRoll) {
                 highestRoll = dieValue;
             }
         }

         // Calculate Outcome
         let outcomeText = '';
         let xpText = 'No XP earned.';
         let xpAmount = 0;
         const target = state.currentDifficulty;

         if (critSuccess) {
             outcomeText = `IMMEDIATE SUCCESS! (Rolled a 6)`;
             // TODO: Check if target met for XP? Rules unclear on 6s and target. Assuming 6 always grants XP for now.
              xpAmount = state.dicePool.length * 10; // 10 XP per expertise die in the pool
             xpText = `Success! Earned ${xpAmount} XP!`;
             // TODO: Show "Push Luck" button?
             // DOMElements.pushLuckButton.style.display = 'inline-block';
         } else if (critFailure) {
             outcomeText = `AUTOMATIC FAILURE! (Rolled a 1)`;
             xpText = `Failure! No XP earned.`;
             // Pay Price button might already be visible if implemented above
         } else {
             // No 1 or 6 rolled, use highest roll vs target
             if (highestRoll >= target) { // Met or exceeded target
                 outcomeText = `SUCCESS with Complication! (Highest: ${highestRoll} vs Target: ${target})`;
                  xpAmount = state.dicePool.length * 10;
                  xpText = `Success! Earned ${xpAmount} XP!`;
             } else { // Did not meet target
                 outcomeText = `FAILURE with Silver Lining (Highest: ${highestRoll} vs Target: ${target})`;
                 xpText = `Failure! No XP earned.`;
             }
         }

        // Store result state
        state.currentRollResult = {
            outcome: outcomeText,
            rolls: results,
            isCritSuccess: critSuccess,
            isCritFailure: critFailure,
            xpEarned: xpAmount,
            usedExpertise: state.dicePool.map(d => d.expertiseName),
            involvedPlayerIds: [...new Set(state.dicePool.map(d => d.playerId))] // Unique players involved
        };

        // Display results
        if(DOMElements.outcomeDisplay) DOMElements.outcomeDisplay.textContent = outcomeText;
        if(DOMElements.xpResultDisplay) {
            DOMElements.xpResultDisplay.textContent = xpText;
             DOMElements.xpResultDisplay.classList.toggle('fail', xpAmount === 0);
        }
        DOMElements.resultsArea?.classList.remove('hidden');

         // Award XP automatically if earned (optional - could be manual via Host XP buttons)
         if (xpAmount > 0) {
             // TODO: Decide if XP is auto-awarded here or only via Host clicks
              console.log(`Roll Result: Awarding ${xpAmount} XP to players:`, state.currentRollResult.involvedPlayerIds);
             // await awardXpFromRoll(state.currentRollResult);
         }

        // Re-enable reset button
         DOMElements.resetButton.disabled = false;
         console.log("Dice roll sequence complete.");
     }

     // --- XP Management ---
     async function assignXp(playerId, amount) {
         console.log(`Assigning ${amount} XP to ${playerId} by GM`);
         showLoading(true);
         try {
            const payload = {
                fields: {
                    player_id: [playerId],
                    xp_amount: amount,
                    source: 'GM'
                }
            };
            await callAirtableProxy('POST', 'XP Logs', payload);
            alert(`Assigned ${amount} XP successfully!`);
            // TODO: Optionally update player level display if XP crosses threshold? Requires fetching Level thresholds.
         } catch(error) {
             alert(`Failed to assign XP: ${error.message}`);
         } finally {
             showLoading(false);
         }
     }
      // Optional: Auto-award XP from successful rolls
      async function awardXpFromRoll(rollResult) {
          if (!rollResult || rollResult.xpEarned <= 0) return;
          const xpPromises = rollResult.involvedPlayerIds.map(playerId => {
              const payload = {
                  fields: {
                      player_id: [playerId],
                      xp_amount: rollResult.xpEarned, // Everyone involved gets the full amount? Check rules.
                      source: 'Roll Bonus' // Or similar category
                  }
              };
               return callAirtableProxy('POST', 'XP Logs', payload);
          });
          try {
              await Promise.all(xpPromises);
              console.log("XP awarded automatically from roll.");
          } catch (error) {
              console.error("Failed to auto-award XP:", error);
              // Don't bother user? Log it.
          }
      }

    // --- Chat ---
    function handleSendChat() {
        const messageText = DOMElements.chatInput?.value.trim();
        if (!messageText) return;

        const playerName = state.teamPlayers.find(p => p.playerId === state.loggedInPlayerId)?.name || 'Unknown Player';

        // Add message locally (no persistence)
        addChatMessage(playerName, messageText);

        // Clear input
        DOMElements.chatInput.value = '';

         // TODO: Integrate with Real-time service if implemented
         // broadcastChatMessage(playerName, messageText);
    }

    function addChatMessage(name, message) {
        if (!DOMElements.chatMessages || !DOMElements.chatMessageTemplate) return;

         // Remove initial placeholder if present
         const placeholder = DOMElements.chatMessages.querySelector('p');
         if(placeholder && placeholder.textContent.includes('appear here')) placeholder.remove();

        const messageElement = DOMElements.chatMessageTemplate.firstElementChild.cloneNode(true);
        const nameSpan = messageElement.querySelector('.chat-player-name');
        const textSpan = messageElement.querySelector('.chat-message-text');
        const timeSpan = messageElement.querySelector('.chat-timestamp');

        if(nameSpan) nameSpan.textContent = name;
        if(textSpan) textSpan.textContent = message;
        if(timeSpan) timeSpan.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

        DOMElements.chatMessages.appendChild(messageElement);

        // Scroll to bottom
        DOMElements.chatMessages.scrollTop = DOMElements.chatMessages.scrollHeight;
    }

    // --- Start the App ---
    initializeApp();

}); // End DOMContentLoaded
