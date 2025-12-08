
# b-code-walker

**b-code-walker** is a lightweight, syntax-highlighting text editor and integrated design environment (IDE) powered by the Google Gemini API. It bridges the gap between raw code and architectural visualization.

## Features

*   **Smart Editor**: Syntax highlighting for JS, TS, HTML, CSS, Python, SQL, and JSON.
*   **AI Architect**: Generates complex code structures with "Synoptic Tree Views".
*   **Visualizer**: Automatically converts AI-generated code plans into Mermaid flowcharts and interactive SVG diagrams (UI, Database, Logic flows).
*   **No Build Required**: Uses ES Modules and Import Maps for instant startup.
*   **BYOK (Bring Your Own Key)**: Securely use your own Google Gemini API key, stored locally in your browser.

## Getting Started

### Prerequisites

*   A modern web browser (Chrome, Edge, Firefox).
*   A Google Gemini API Key. Get one here: [Google AI Studio](https://aistudio.google.com/app/apikey).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Fatiguita/b-code-walker.git
    cd b-code-walker
    ```

2.  **Run the app:**
    *   Since this app uses ES Modules, you need a local server.
    *   **Python:** `python3 -m http.server 8000`
    *   **Node (http-server):** `npx http-server .`
    *   **VS Code:** Use the "Live Server" extension.

3.  **Open in Browser:**
    Navigate to `http://localhost:8000` (or the port shown in your terminal).

### Configuration

1.  Go to the **Settings** tab (Gear icon).
2.  Paste your **Gemini API Key** in the API Configuration section.
3.  The key is saved to your browser's `localStorage` and is never sent to any server other than Google's API endpoints.

## Tech Stack

*   **React 19**: UI Library (via ESM).
*   **Google GenAI SDK**: For AI logic and reasoning.
*   **PrismJS**: Syntax highlighting.
*   **Mermaid.js**: Diagram generation.
*   **Tailwind CSS**: Styling (via CDN).

## License

MIT
