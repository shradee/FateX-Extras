# FateX Extras

**FateX Extras** is a comprehensive module for the [FateX system](https://github.com/anvil-vtt/FateX) in Foundry VTT. It enhances the gameplay experience by adding a robust Scene Aspect Manager, automated subtractions for invokes/rerolls, global aspect tracking, and various quality-of-life improvements.

![Foundry Version](https://img.shields.io/badge/Foundry-v14-orange) ![Downloads](https://img.shields.io/github/downloads/shradee/FateX-Extras/total)  ![Language](https://img.shields.io/badge/Language-English%20%7C%20Russian-green)

[![Support modules I create on](https://img.shields.io/badge/Support_modules_I_create_on-Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/shrade_himself)

## Features

### 🎭 Scene Aspect Manager
A powerful, drag-and-drop enabled interface for managing scene aspects.
*   **Categories:** Organize aspects into custom categories (e.g., "Scene", "Situation", "Advantages").
*   **Flexible Layout:** A responsive grid layout that adapts to your window size.
*   **Tags:** Create and assign color-coded tags to aspects for quick identification.
*   **Drag & Drop:** Easily reorder categories and aspects using intuitive drag-and-drop indicators.
*   **Visibility:** Toggle visibility for individual aspects or entire categories (GM only).
*   **Free Invokes:** Track free invokes directly on the aspect card.
*   **GM Invokes:** Track hostile/GM invokes separately (visible only to GM).
*   **Drag and Drop aspects on Canvas:** Simply take the aspect from the manager and put it on the scene.

### 💰 Cost Automation & Payment
Intercepts standard roll actions to offer payment choices.
*   **Cost Dialog:** When you click "+2" or "Reroll" on a chat card, a dialog appears asking how you want to pay.
*   **Payment Options:**
    *   **Fate Point:** Deduct a Fate Point from the current character.
    *   **Free Invoke:** Select a relevant Scene Aspect or Character Aspect to use a free invoke.
    *   **GM Invoke:** (GM Only) Spend a hostile invoke.
*   **Automatic Updates:** Automatically updates aspect counters, character Fate Points, and chat card history.

### 🎲 Enhanced Chat Rolls
*   **Quick Modifiers:** Adds **+1** and **-1** buttons to chat cards for quick GM adjustments.
*   **Permission Handling:** Allows players to modify their own rolls (e.g., spending invokes) even if they don't own the chat message document, via secure socket delegation.
*   **Dice So Nice:** Includes a custom "dc" die preset with a dedicated [3D model](https://cults3d.com/en/3d-model/game/fate-point-tokens) for immersive rolling.

### 🌓 Dark Mode
A built-in dark theme for all module windows and sheets, perfect for late-night sessions.
*   Toggle via Module Settings.
*   Applies a sleek, modern dark interface with glassmorphism effects.

### 🔄 Session Management
*   **New Session Button:** Adds a refresh button to the character sheet header.
*   **Fate Point Refresh:** One-click confirmation to reset current Fate Points to the Refresh value.

### 🌍 Global Aspect Sync
*   **Cross-Client Sync:** Character aspect invokes are synchronized globally, ensuring all players see the correct invoke counts in real-time.
*   **Centralized Storage:** Uses a hidden "Global FateX Aspects" journal entry to maintain state across the game.

## Installation
1.  Open the Foundry VTT Setup screen.
2.  Go to the **Add-on Modules** tab.
3.  Click **Install Module**.
4.  Search for "FateX Extras" or paste the manifest URL.
5.  Click **Install**.

## Usage
1.  **Aspect Manager:** Open via the "Aspect Manager" button in the Token Controls (left sidebar).
2.  **Cost Dialog:** Simply click "+2" or "Reroll" on any FateX chat card.
3.  **Dark Mode:** Go to **Game Settings > Module Settings > FateX Extras** to enable.

## Localization
The module includes full localization for:
*   🇬🇧 English
*   🇷🇺 Russian

## Credits
Built to extend the amazing [FateX system](https://github.com/anvil-vtt/FateX).

[3D model of a fate point](https://cults3d.com/en/3d-model/game/fate-point-tokens)
