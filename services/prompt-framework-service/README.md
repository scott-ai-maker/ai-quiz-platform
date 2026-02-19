# Prompt Framework Service

Template management system for prompt engineering in production AI workflows.

## Features

- Create and version prompt templates
- List and retrieve templates by key
- Render templates with variables
- Track active template versions

## API

- `POST /api/prompts/templates`
- `GET /api/prompts/templates`
- `GET /api/prompts/templates/:key`
- `POST /api/prompts/render`
- `GET /health`
