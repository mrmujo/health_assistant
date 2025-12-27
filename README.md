# Health Assistant

A personal health assistant that connects to your Garmin Connect account and uses AI to analyze your health data. Get insights about your sleep, activity, stress levels, and more through natural conversation.

## Important note

This is 100% vibecoded, use at your own discretion.

## Features

- **Garmin Connect Integration** - Sync sleep, activity, stress, and body battery data
- **AI-Powered Analysis** - Chat with AI about your health patterns
- **Multiple AI Providers** - Choose between Claude (Anthropic), GPT-4 (OpenAI), or Ollama (local)
- **Conversation History** - Organized chat conversations with full history
- **Manual Logging** - Track food intake, medications, and health notes
- **Privacy-Focused** - All Garmin data is de-personalized (no names, emails, or account IDs stored)

## Pages

- **Dashboard** - Overview of your recent health metrics
- **Sleep Analysis** - Sleep duration, stages, quality scores, and heart rate during sleep
- **Activity** - Steps, calories, heart rate, and expandable individual workouts
- **Stress & Body Battery** - Stress distribution and energy levels throughout the day
- **Chat** - AI-powered health conversations with conversation history
- **Logs** - Manual food, medication, and health notes

## Requirements

- Node.js 18+
- Python 3.8+ (for Garmin Connect integration)
- A Garmin Connect account
- API key for Claude, OpenAI, or a local Ollama instance

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/health-assistant.git
   cd health-assistant
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Set up Python environment**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install garminconnect
   ```

4. **Initialize the database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open the app** at `http://localhost:5173`

## Configuration

### Garmin Connect

1. Go to **Settings** in the app
2. Enter your Garmin Connect email and password
3. Click **Connect Garmin**
4. Use **Sync Now** to fetch your health data

Your credentials are only used to obtain OAuth tokens and are not stored. Tokens are saved locally in `~/.garminconnect`.

### AI Provider

Choose one of three AI providers in Settings:

#### Claude (Anthropic)
- Get an API key from [console.anthropic.com](https://console.anthropic.com)
- Paste your API key in Settings

#### GPT-4 (OpenAI)
- Get an API key from [platform.openai.com](https://platform.openai.com)
- Paste your API key in Settings

#### Ollama (Local)
- Install Ollama from [ollama.ai](https://ollama.ai)
- Run a model: `ollama run llama2`
- Enter your Ollama endpoint (e.g., `http://localhost:11434`)
- Enter the model name (e.g., `llama2`, `mistral`, `codellama`)

## Usage

### Syncing Data

1. Go to **Settings**
2. Select how many days to sync (1-30 days)
3. Click **Sync Now**

Data is stored locally in SQLite and includes:
- Sleep stages, duration, and quality
- Daily steps, calories, and heart rate
- Stress levels and body battery
- Individual workout activities

### Chatting with AI

1. Go to **Chat**
2. Ask questions about your health data:
   - "How was my sleep this week?"
   - "What patterns do you see in my activity?"
   - "Analyze my stress levels"

The AI has access to your last 7 days of health data and provides personalized insights.

**Chat shortcuts:**
- `Enter` - Send message
- `Shift+Enter` - New line

### Analyzing Specific Days

Each page (Sleep, Activity, Stress) has an **Analyze** button (🔍) next to each day. Click it to start a new conversation focused on that specific day's data.

On the Activity page, you can expand each day to see individual workouts and analyze them separately.

### Manual Logging

Use the **Logs** page to track:
- **Food** - Meals with optional calories and macros
- **Medications** - Name, dosage, and timing
- **Notes** - General health observations with tags

## Project Structure

```
health-assistant/
├── src/
│   ├── lib/server/       # Server-side code
│   │   ├── db/           # Database schema and client
│   │   ├── ai/           # AI provider integration
│   │   └── garmin/       # Garmin API wrapper
│   ├── routes/           # SvelteKit pages and API routes
│   └── app.css           # Global styles
├── python/
│   └── garmin_service.py # Garmin data fetcher
└── data/                 # SQLite database (created automatically)
```

## Tech Stack

- **Frontend/Backend**: SvelteKit 2 with Svelte 5
- **Database**: SQLite with Drizzle ORM
- **AI**: Anthropic Claude, OpenAI GPT-4, or Ollama
- **Garmin**: Python `garminconnect` library via subprocess

## Privacy

This app is designed for personal, self-hosted use:

- All data stays on your machine
- Garmin data is de-personalized (no names, emails, or account IDs)
- No analytics or tracking
- API keys are stored locally in SQLite
- OAuth tokens stored in `~/.garminconnect`

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Push database schema changes
npm run db:push
```

## License

MIT
