# Sharene Prototype

A privacy-first photo sharing app with end-to-end encryption.

## Project Structure

```
sharing-app/
├── supabase/              # Backend infrastructure
│   ├── functions/         # Edge Functions
│   │   ├── create-link/   # Link creation handler
│   │   └── get-link/      # Link retrieval handler
│   ├── migrations/        # Database migrations
│   └── README.md          # Supabase setup guide
├── mobile/                # React Native app (iOS) - Phase 2
├── viewer/                # Next.js web viewer - Phase 3
└── docs/                  # Documentation
    ├── prototype_plan.md
    ├── implementation_plan.md
    └── task.md
```

## Phase 1: Infrastructure Setup ✅

### Completed
- ✅ Database schema (shared_links, link_secrets)
- ✅ Row Level Security (RLS) policies
- ✅ Storage bucket configuration
- ✅ Edge Functions (create-link, get-link)
- ✅ Setup documentation

### Next Steps

1. **Install Prerequisites**
   ```bash
   # Install Node.js (if not installed)
   # Visit: https://nodejs.org/
   
   # Install Supabase CLI
   brew install supabase/tap/supabase
   ```

2. **Create Supabase Project**
   - Go to https://app.supabase.com
   - Create new project
   - Note down: Project URL, Anon Key, Service Role Key

3. **Configure Environment**
   ```bash
   # Copy environment template
   cp .env.example .env.local
   
   # Edit .env.local with your Supabase credentials
   ```

4. **Deploy Infrastructure**
   ```bash
   # Login to Supabase
   supabase login
   
   # Link to your project
   supabase link --project-ref your-project-ref
   
   # Push database migrations
   supabase db push
   
   # Deploy Edge Functions
   supabase functions deploy create-link
   supabase functions deploy get-link
   ```

5. **Enable Anonymous Auth**
   - Go to Supabase Dashboard > Authentication > Settings
   - Enable "Anonymous sign-ins"

## Development

See individual component READMEs:
- [Supabase Setup](./supabase/README.md)
- Mobile App (coming in Phase 2)
- Web Viewer (coming in Phase 3)

## License

Private project
