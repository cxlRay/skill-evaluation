# Skill Evaluation Platform

A web-based platform for evaluating AI agent skills with automated test case generation and scoring.

## Features

- **Multi-Provider Support**: Compatible with OpenAI, Anthropic, DeepSeek, SiliconFlow, Zhipu GLM, Moonshot, Ollama, and custom endpoints
- **Automated Testing**: Generates test cases from SKILL.md definitions
- **Multi-Dimension Scoring**: Evaluates trigger accuracy, output quality, instruction following, robustness, and efficiency
- **Visual Reports**: Radar charts and bar charts for result visualization
- **Export Options**: Export results as JSON or HTML reports

## Quick Start

```bash
# Install dependencies
npm install

# Build bundle
npm run build

# Start server
npm run start
```

Open http://localhost:3001 in your browser.

## Usage

1. **Configure API**: Select a provider and enter your API key
2. **Upload Skills**: Upload SKILL.md files or ZIP packages containing skill definitions
3. **Set Options**: Configure number of test cases per skill
4. **Run Evaluation**: Click "开始评测" to start evaluation
5. **View Results**: Review scores, charts, and detailed reports

## Development

```bash
# Watch mode (future)
npm run dev
```

## Project Structure

```
├── ts/              # TypeScript source files
├── dist/            # Build output
├── index.html       # Main HTML file
├── server.js        # Static file server
├── package.json     # Project configuration
└── tsconfig.json    # TypeScript configuration
```

## License

MIT License - see [LICENSE](LICENSE) for details.