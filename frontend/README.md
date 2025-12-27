# Liquidity Pulse Frontend

Next.js frontend for the Liquidity Pulse visualization.

## Setup

```bash
cd frontend
npm install
cp env.example .env.local
```

## Development

Run the Python API in one terminal:

```bash
# From project root
make run
```

Run the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Open http://localhost:3000

## Structure

```
src/
├── app/              # Next.js app router
│   ├── layout.tsx    # Root layout
│   ├── page.tsx      # Home page
│   └── globals.css   # Global styles
├── components/       # React components
│   ├── chart.tsx     # ECharts visualization
│   ├── indicator-panel.tsx
│   └── series-panel.tsx
└── lib/              # Utilities
    ├── api.ts        # API client
    └── utils.ts      # Formatting helpers
```

## Deployment

Deploy to Vercel:

1. Connect your GitHub repo
2. Set `NEXT_PUBLIC_API_URL` env var to your Railway API URL
3. Deploy
