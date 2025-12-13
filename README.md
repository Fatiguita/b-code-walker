# b-code-walker
### AI-Powered Architectural Code Editor (coded with gemini 3 AI model)

### 🚀 **[Play with b-code-walker Live Here](https://fatiguita.github.io/b-code-walker/)**

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/react-19.0-61dafb.svg)
![Gemini](https://img.shields.io/badge/AI-Gemini_3_Pro-8e44ad.svg)

**b-code-walker** is a next-generation "Integrated Design Environment" (IDE) that doesn't just write code—it visualizes it. Powered by the **Google Gemini 2.5 Flash** model, it bridges the gap between raw syntax and high-level architectural understanding.

It operates on a **Bring Your Own Key (BYOK)** model for complete privacy.

---

## 🚀 Key Features

### 1. The Synoptic Tree View
Unlike standard chat interfaces that dump a wall of text, **b-code-walker** parses AI responses into a structured, interactive tree.
*   **Navigate Logic**: Collapse/Expand classes, functions, and import blocks.
*   **Selective Insertion**: Inject specific functions into your active file without copying the whole response.
*   **Inline Explanation**: Click the "Chat" icon on any block to get a context-aware explanation of just that snippet.

### 2. Live Visualization Engine
The **Visualizer Tab** transforms abstract code plans into concrete visual metaphors.
*   **Mermaid.js Integration**: Automatically generates flowcharts and sequence diagrams for logic flows.
*   **Visual Metaphors**: Uses animated SVGs to represent code archetypes:
    *   🔵 **Process**: Async flows and logic loops.
    *   🟢 **Database**: Data structures and schema definitions.
    *   🟣 **UI**: Component hierarchies and render cycles.
    *   🟠 **API**: Network requests and data fetching.

### 3. Professional Editor
*   **Multi-Tab Interface**: Switch between Editor, Visualizer, and Settings seamlessy.
*   **Syntax Highlighting**: Powered by PrismJS for JS, TS, HTML, CSS, Python, SQL, and Markdown.
*   **Smart Search**: Regex-enabled find and highlight.
*   **History**: Local undo/redo stack.

---

## 🛠️ Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   npm or yarn

### Installation
1.  **Clone the repository**
    ```bash
    git clone https://github.com/Fatiguita/b-code-walker.git
    cd b-code-walker
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Start Development Server**
    ```bash
    npm run dev
    ```
    The app will open at `http://localhost:5173`.

### Configuration (BYOK)
1.  Navigate to the **Settings** tab (Gear Icon).
2.  Enter your **Google Gemini API Key**.
    *   *Need a key? Get one at [Google AI Studio](https://aistudio.google.com/app/apikey).*
3.  (Optional) Customize your theme (Dark Nebula, Cloud White, Midnight Blue).

---

## 🔒 Privacy & Security

**b-code-walker** is designed with privacy as a priority.

*   **Local Storage**: Your API Key and App Settings are stored exclusively in your browser's `localStorage`.
*   **Direct Communication**: The app communicates directly from your browser to Google's Generative AI API endpoints (`generativelanguage.googleapis.com`).
*   **No Middleman**: No intermediate backend server reads your code or prompts.

---

## 💡 How to Use

1.  **Draft**: Open the **Editor Tab**. Select a language.
2.  **Prompt**: Click "Generate Code". Describe your feature (e.g., *"Create a React hook for fetching user data with debouncing"*).
3.  **Review**: The AI generates a **Plan**.
    *   Use the **Tree View** in the sidebar to review code blocks.
    *   Click **Insert** (+) to add code to your file.
4.  **Visualize**: Switch to the **Visualizer Tab** to see the architectural diagram of the code you just generated.

---

## 📦 Tech Stack

*   **Core**: React 19 + Vite
*   **AI**: Google GenAI SDK (`@google/genai`)
*   **Styling**: Tailwind CSS
*   **Editor**: `react-simple-code-editor` + `prismjs`
*   **Diagrams**: `mermaid`

## License

MIT License. Feel free to fork, modify, and distribute.
