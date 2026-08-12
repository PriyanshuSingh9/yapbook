# Yapbook

Turn group chat histories into comic-book memories.

Yapbook is a native desktop application that takes a WhatsApp group chat export and transforms it into illustrated comic panels — capturing the moments, dynamics, and personalities that make your friend group unique.

## How It Works

1. **Export** your WhatsApp group chat as a `.zip` file
2. **Import** it into Yapbook
3. The app parses, analyzes, and processes your chat through three phases:

   **Parsing & Analytics** — Clean up and structure the raw chat export, then compute detailed statistics and visualizations about your group's messaging patterns.

   **LLM Memory Processing** — Break the chat into sessions and process them sequentially through a local LLM, building up layered memory about member personalities, relationships, group culture, and narrative arcs over time.

   **Comic Generation** — Select the best moments, design consistent characters informed by member profiles, and generate illustrated comic panels with dialogue adapted from actual conversations.

## Privacy

Yapbook is privacy-first. Chat data stays on your machine and is processed using locally running models.

## Status

Early design phase. See [`docs/`](docs/) for architecture documentation.
